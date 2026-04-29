/**
 * Tests for POST /api/registration/prepare
 *
 * Validates a bookingRef, checks for duplicate registration, and upserts a
 * 'pending' row in registered_flights.
 */
import { createMocks, mockSupabase, resetSupabaseMock } from '../../helpers/setup'

jest.mock('../../../src/web/utils/supabaseServer')

import handler from '../../../src/web/pages/api/registration/prepare'

const VALID_UUID = '11111111-1111-1111-9111-111111111111'

afterEach(() => resetSupabaseMock())

describe('POST /api/registration/prepare', () => {
  test('rejects non-POST methods with 405', async () => {
    mockSupabase()
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })

  test('returns 400 for missing bookingRef', async () => {
    mockSupabase()
    const { req, res } = createMocks({ method: 'POST', body: {} })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res._getJSONData().error).toMatch(/invalid bookingRef/i)
  })

  test('returns 400 for non-UUID bookingRef', async () => {
    mockSupabase()
    const { req, res } = createMocks({ method: 'POST', body: { bookingRef: 'not-a-uuid' } })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
  })

  test('returns 404 when booking does not exist', async () => {
    const sb = mockSupabase()
    sb.forTable('bookings').returnSingle(null)
    sb.forTable('registered_flights').returnSingle(null)

    const { req, res } = createMocks({ method: 'POST', body: { bookingRef: VALID_UUID } })
    await handler(req, res)
    expect(res.statusCode).toBe(404)
    expect(res._getJSONData().error).toMatch(/not found/i)
  })

  test('returns 409 when booking is already confirmed', async () => {
    const sb = mockSupabase()
    sb.forTable('bookings').returnSingle({ booking_ref: VALID_UUID, flight_id: 'FL-001' })
    sb.forTable('registered_flights').returnSingle({ booking_ref: VALID_UUID, status: 'confirmed' })

    const { req, res } = createMocks({ method: 'POST', body: { bookingRef: VALID_UUID } })
    await handler(req, res)
    expect(res.statusCode).toBe(409)
    expect(res._getJSONData().error).toMatch(/already been registered/i)
  })

  test('returns 200 with flightId on success', async () => {
    const sb = mockSupabase()
    sb.forTable('bookings').returnSingle({ booking_ref: VALID_UUID, flight_id: 'BA214-2026-02-15-0800' })
    sb.forTable('registered_flights').returnSingle(null) // not yet registered

    const { req, res } = createMocks({ method: 'POST', body: { bookingRef: VALID_UUID } })
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res._getJSONData()).toEqual({ ok: true, flightId: 'BA214-2026-02-15-0800' })
  })

  test('handles Supabase booking-lookup error', async () => {
    const sb = mockSupabase()
    sb.forTable('bookings').returnError({ message: 'db down' })

    const { req, res } = createMocks({ method: 'POST', body: { bookingRef: VALID_UUID } })
    await handler(req, res)
    expect(res.statusCode).toBe(500)
  })

  test('handles JSON string body', async () => {
    const sb = mockSupabase()
    sb.forTable('bookings').returnSingle({ booking_ref: VALID_UUID, flight_id: 'FL-X' })
    sb.forTable('registered_flights').returnSingle(null)

    const { req, res } = createMocks({
      method: 'POST',
      body: JSON.stringify({ bookingRef: VALID_UUID }),
    })
    await handler(req, res)
    expect(res.statusCode).toBe(200)
  })
})
