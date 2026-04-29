import { createMocks, mockSupabase, resetSupabaseMock } from '../../helpers/setup'

jest.mock('../../../src/web/utils/supabaseServer')

import handler from '../../../src/web/pages/api/admin/set-flight-delayed'

const ADMIN_SECRET = 'test-admin-secret'

beforeEach(() => {
  process.env.ADMIN_SECRET = ADMIN_SECRET
})

afterEach(() => {
  resetSupabaseMock()
})

function authHeaders() {
  return { 'x-admin-secret': ADMIN_SECRET }
}

describe('GET /api/admin/set-flight-delayed', () => {
  it('returns list of un-landed flights', async () => {
    const sb = mockSupabase()
    sb.forTable('flights').returnData([
      { flight_id: 'FR340', flight_code: 'FR340', origin: 'DUB', destination: 'LHR' },
    ])

    const { req, res } = createMocks({ method: 'GET', headers: authHeaders() })
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const body = res._getJSONData()
    expect(body.ok).toBe(true)
    expect(body.flights).toHaveLength(1)
  })
})

describe('POST /api/admin/set-flight-delayed', () => {
  it('returns 405 for disallowed methods', async () => {
    const sb = mockSupabase()
    const { req, res } = createMocks({ method: 'DELETE', headers: authHeaders() })
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })

  it('returns 403 when x-admin-secret is missing', async () => {
    const sb = mockSupabase()
    const { req, res } = createMocks({ method: 'POST' })
    await handler(req, res)
    expect(res.statusCode).toBe(403)
  })

  it('returns 403 when x-admin-secret is wrong', async () => {
    const sb = mockSupabase()
    const { req, res } = createMocks({
      method: 'POST',
      headers: { 'x-admin-secret': 'wrong-secret' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(403)
  })

  it('returns 400 when flightId is missing', async () => {
    const sb = mockSupabase()
    const { req, res } = createMocks({
      method: 'POST',
      headers: authHeaders(),
      body: { actualArrivalAt: '2025-01-01T12:00:00Z' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res._getJSONData().error).toMatch(/flightId/i)
  })

  it('returns 400 when actualArrivalAt is missing', async () => {
    const sb = mockSupabase()
    const { req, res } = createMocks({
      method: 'POST',
      headers: authHeaders(),
      body: { flightId: 'FR340' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res._getJSONData().error).toMatch(/actualArrivalAt/i)
  })

  it('returns 400 for invalid actualArrivalAt format', async () => {
    const sb = mockSupabase()
    const { req, res } = createMocks({
      method: 'POST',
      headers: authHeaders(),
      body: { flightId: 'FR340', actualArrivalAt: 'not-a-date' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res._getJSONData().error).toMatch(/invalid/i)
  })

  it('returns 404 when flight not found in DB', async () => {
    const sb = mockSupabase()
    sb.forTable('flights').returnSingle(null)

    const { req, res } = createMocks({
      method: 'POST',
      headers: authHeaders(),
      body: { flightId: 'UNKNOWN', actualArrivalAt: '2025-01-01T15:00:00Z' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(404)
  })

  it('calculates delay correctly and returns delayed=true for >= 180 min', async () => {
    const sb = mockSupabase()
    // Scheduled arrival: 12:00, actual arrival: 15:10 → 190 min delay
    sb.forTable('flights').returnSingle({
      flight_id: 'FR340',
      scheduled_arrival_at: '2025-01-01T12:00:00Z',
      actual_arrival_at: null,
    })
    sb.forTable('bookings').returnData([])

    const { req, res } = createMocks({
      method: 'POST',
      headers: authHeaders(),
      body: { flightId: 'FR340', actualArrivalAt: '2025-01-01T15:10:00Z' },
    })
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const body = res._getJSONData()
    expect(body.ok).toBe(true)
    expect(body.delayed).toBe(true)
    expect(body.delayMinutes).toBe(190)
  })

  it('calculates delay correctly and returns delayed=false for < 180 min', async () => {
    const sb = mockSupabase()
    // Scheduled arrival: 12:00, actual arrival: 12:30 → 30 min delay
    sb.forTable('flights').returnSingle({
      flight_id: 'FR340',
      scheduled_arrival_at: '2025-01-01T12:00:00Z',
      actual_arrival_at: null,
    })

    const { req, res } = createMocks({
      method: 'POST',
      headers: authHeaders(),
      body: { flightId: 'FR340', actualArrivalAt: '2025-01-01T12:30:00Z' },
    })
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const body = res._getJSONData()
    expect(body.ok).toBe(true)
    expect(body.delayed).toBe(false)
    expect(body.delayMinutes).toBe(30)
  })
})
