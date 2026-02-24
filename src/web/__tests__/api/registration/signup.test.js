/**
 * Tests for POST /api/registration/signup
 *
 * Creates a new Supabase user with role metadata.
 */
import { createMocks, mockSupabase, resetSupabaseMock } from '../../helpers/setup'

jest.mock('../../../utils/supabaseServer')

import handler from '../../../pages/api/registration/signup'

afterEach(() => resetSupabaseMock())

describe('POST /api/registration/signup', () => {
  test('rejects non-POST methods with 405', async () => {
    mockSupabase()
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })

  test('returns 400 when required fields are missing', async () => {
    mockSupabase()
    const { req, res } = createMocks({ method: 'POST', body: { email: 'a@b.com' } })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res._getJSONData().error).toMatch(/required/i)
  })

  test('returns 400 when password is too short', async () => {
    mockSupabase()
    const { req, res } = createMocks({
      method: 'POST',
      body: { email: 'a@b.com', password: '12345', name: 'Test', role: 'passenger' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res._getJSONData().error).toMatch(/6 characters/i)
  })

  test('returns 400 for invalid role', async () => {
    mockSupabase()
    const { req, res } = createMocks({
      method: 'POST',
      body: { email: 'a@b.com', password: 'password123', name: 'Test', role: 'admin' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res._getJSONData().error).toMatch(/role/i)
  })

  test('returns 201 on successful registration', async () => {
    const sb = mockSupabase()
    // createUser is pre-mocked to succeed in setup.js

    const { req, res } = createMocks({
      method: 'POST',
      body: { email: 'a@b.com', password: 'password123', name: 'Test User', role: 'passenger' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(201)
    expect(res._getJSONData().ok).toBe(true)
    expect(res._getJSONData().userId).toBeDefined()
  })

  test('returns 409 when email already registered', async () => {
    const sb = mockSupabase()
    sb.client.auth.admin.createUser = jest.fn().mockResolvedValue({
      data: null,
      error: { message: 'User already been registered' },
    })

    const { req, res } = createMocks({
      method: 'POST',
      body: { email: 'a@b.com', password: 'password123', name: 'Test', role: 'passenger' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(409)
  })
})
