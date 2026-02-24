/**
 * Global test setup & helpers.
 *
 * – Stubs environment variables so Supabase client constructors never throw.
 * – Exports `createMocks` (from node-mocks-http) pre-configured for JSON APIs.
 * – Exports a `mockSupabase` builder that returns chainable Supabase-shaped
 *   objects, making it easy to control what the DB returns per-test.
 *
 * Usage in a test file:
 *   import { createMocks, mockSupabase, resetSupabaseMock } from '../helpers/setup'
 */
import { createMocks as _createMocks } from 'node-mocks-http'

// env stubs (must run before any handler imports)
process.env.SUPABASE_URL = 'http://localhost:54321'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'

// Supabase mock

/**
 * Build an object that mirrors the Supabase JS client interface so API route
 * handlers can call `.from(...).select(...).eq(...)` etc. without hitting a
 * real database.
 *
 * Call `mockSupabase()` at the top of each test to get a fresh mock.
 * Customise the return values by chaining `.resolves(data)` or
 * `.rejects(error)` on any query-builder method.
 *
 * Example:
 *   const sb = mockSupabase()
 *   sb.from('bookings').returnData([{ booking_ref: 'abc' }])
 */
let _currentMock = null

/**
 * Creates a fresh Supabase mock and installs it as the return value of
 * `getSupabaseAdmin()`.  Returns a `MockSupabase` instance whose `.from()`
 * calls can be configured per-table.
 */
export function mockSupabase() {
  const mock = new MockSupabase()
  _currentMock = mock
  return mock
}

/** Reset the active mock (useful in afterEach). */
export function resetSupabaseMock() {
  _currentMock = null
}

/**
 * The mock that `getSupabaseAdmin` returns when it's been jest-mocked.
 * Handlers call `getSupabaseAdmin()` which returns `_currentMock.client`.
 */
export function getActiveMock() {
  if (!_currentMock) throw new Error('Call mockSupabase() before invoking the handler')
  return _currentMock.client
}

// Internal mock implementation

class MockSupabase {
  constructor() {
    this._tables = {}
    // The object actually returned by getSupabaseAdmin()
    this.client = {
      from: (table) => this._tableBuilder(table),
      auth: {
        admin: {
          createUser: jest.fn().mockResolvedValue({ data: { user: { id: 'mock-user-id' } }, error: null }),
        },
        // Server-side helpers used by handlers to validate access tokens.
        // Tests can pass Authorization: 'Bearer user-a' or 'Bearer user-b' and
        // this mock will return an email derived from the token string.
        getUser: jest.fn().mockImplementation((token) => {
          if (!token) return Promise.resolve({ data: { user: null }, error: { message: 'missing token' } })
          // token may be like 'user-a' or 'user-b' in tests
          const t = String(token)
          let email = 'test@example.com'
          if (t.includes('user-a') || t === 'user-a') email = 'a@example.com'
          else if (t.includes('user-b') || t === 'user-b') email = 'b@example.com'
          return Promise.resolve({ data: { user: { email } }, error: null })
        }),
      },
    }
  }

  /**
   * Convenience: pre-configure the data a table query should return.
   *
   *   sb.forTable('bookings').returnData([{ booking_ref: '...' }])
   *   sb.forTable('bookings').returnError({ message: 'not found' })
   */
  forTable(name) {
    if (!this._tables[name]) {
      this._tables[name] = { data: null, error: null, singleData: undefined }
    }
    return {
      returnData: (data) => {
        this._tables[name].data = data
        return this
      },
      returnError: (error) => {
        this._tables[name].error = error
        return this
      },
      /** When `.single()` or `.maybeSingle()` is called, return this value. */
      returnSingle: (data) => {
        this._tables[name].singleData = data
        return this
      },
    }
  }

  _tableBuilder(name) {
    if (!this._tables[name]) {
      this._tables[name] = { data: null, error: null, singleData: undefined }
    }
    const cfg = this._tables[name]

    // Chainable query builder that resolves to { data, error }
    const builder = {
      _filters: [],
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      neq: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      single: jest.fn().mockImplementation(() => {
        const d = cfg.singleData !== undefined ? cfg.singleData : cfg.data
        const filtered = applyFilters(d, builder._filters)
        return Promise.resolve({ data: filtered, error: cfg.error })
      }),
      maybeSingle: jest.fn().mockImplementation(() => {
        const d = cfg.singleData !== undefined ? cfg.singleData : cfg.data
        const filtered = applyFilters(d, builder._filters)
        return Promise.resolve({ data: filtered, error: cfg.error })
      }),
      then: (resolve) => {
        const filtered = applyFilters(cfg.data, builder._filters)
        return resolve({ data: filtered, error: cfg.error })
      },
    }

    // Make every chainable method that should resolve (e.g. after .eq()) also
    // expose a .then so it can be awaited directly.
    for (const method of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'neq', 'in', 'order', 'limit']) {
      const orig = builder[method]
      builder[method] = jest.fn((...args) => {
        // record simple filters for later application
        if (method === 'eq') {
          builder._filters.push({ op: 'eq', col: args[0], val: args[1] })
        }
        if (method === 'in') {
          builder._filters.push({ op: 'in', col: args[0], vals: args[1] })
        }
        orig(...args)
        return builder
      })
    }

    // Simple filtering implementation to support tests that rely on .eq/.in
    function applyFilters(data, filters) {
      if (!Array.isArray(data)) return data
      let result = data
      for (const f of filters || []) {
        if (f.op === 'in') {
          // f.vals expected to be an array. Match against the requested
          // column name (e.g. 'booking_ref' or 'flight_id'). If the row
          // doesn't have the field, don't filter it out (tests often
          // provide minimal rows).
          result = result.filter((row) => {
            if (!f.vals || !Array.isArray(f.vals)) return true
            const val = row && Object.prototype.hasOwnProperty.call(row, f.col) ? row[f.col] : undefined
            return val === undefined ? true : f.vals.includes(val)
          })
        }
        if (f.op === 'eq') {
          // support 'bookings.passenger_email' equals
          if (f.col === 'bookings.passenger_email') {
            result = result.filter((row) => row.bookings && row.bookings.passenger_email === f.val)
          }
          // generic equality on top-level fields
          else {
            // If the row doesn't include the field the test provided, don't
            // filter it out — many tests supply minimal rows and rely on
            // the query to match conceptually. Only exclude rows that have
            // the field but don't match the expected value.
            result = result.filter((row) => (row[f.col] === undefined ? true : row[f.col] === f.val))
          }
        }
      }
      return result
    }

    return builder
  }
}

// ─ createMocks wrapper 

/**
 * Thin wrapper around `node-mocks-http` createMocks configured for JSON APIs.
 * Pass `{ method, body, query }` and get back `{ req, res }`.
 */
export function createMocks(opts = {}) {
  const { req, res } = _createMocks({
    method: opts.method || 'GET',
    body: opts.body || {},
    query: opts.query || {},
    headers: { 'content-type': 'application/json', ...(opts.headers || {}) },
  })
  return { req, res }
}
