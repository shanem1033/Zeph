/**
 * Tests for POST /api/bookings
 *
 * Creates a flight booking: looks up route, upserts flight, inserts booking.
 */
import { createMocks, mockSupabase, resetSupabaseMock } from '../../helpers/setup'

jest.mock('../../../utils/supabaseServer')

import handler from '../../../pages/api/bookings/index'

afterEach(() => resetSupabaseMock())

const validBody = {
  departureCity: 'Dublin',
  arrivalCity: 'London',
  departureDate: '2026-03-01',
  departureTime: '08:00',
  passportNumber: 'P1234567',
  email: 'test@example.com',
  cabinClass: 'economy',
  airline: 'BA',
  phone: '0851234567',
}

describe('POST /api/bookings', () => {
  test('rejects non-POST methods with 405', async () => {
    mockSupabase()
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })

  test('returns 400 when departureCity is missing', async () => {
    mockSupabase()
    const { req, res } = createMocks({
      method: 'POST',
      body: { ...validBody, departureCity: undefined },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res._getJSONData().error).toMatch(/route/i)
  })

  test('returns 400 when arrivalCity is missing', async () => {
    mockSupabase()
    const { req, res } = createMocks({
      method: 'POST',
      body: { ...validBody, arrivalCity: undefined },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
  })

  test('returns 400 when departureDate is missing', async () => {
    mockSupabase()
    const { req, res } = createMocks({
      method: 'POST',
      body: { ...validBody, departureDate: undefined },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res._getJSONData().error).toMatch(/departureDate/i)
  })

  test('returns 400 when passportNumber is missing', async () => {
    mockSupabase()
    const { req, res } = createMocks({
      method: 'POST',
      body: { ...validBody, passportNumber: undefined },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
  })

  test('returns 400 when email is missing', async () => {
    mockSupabase()
    const { req, res } = createMocks({
      method: 'POST',
      body: { ...validBody, email: undefined },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
  })

  test('returns 400 when route is not found', async () => {
    const sb = mockSupabase()
    // .single() returns { data: null, error: ... } when no row found
    sb.forTable('routes').returnSingle(null)
    sb.forTable('routes').returnError({ message: 'not found', code: 'PGRST116' })

    const { req, res } = createMocks({ method: 'POST', body: validBody })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res._getJSONData().error).toMatch(/no route/i)
  })

  test('returns 200 with bookingRef on success', async () => {
    const sb = mockSupabase()
    sb.forTable('routes').returnSingle({ flight_code: 'BA214', duration_minutes: 90 })
    sb.forTable('flights').returnData(null) // upsert OK
    sb.forTable('bookings').returnSingle({
      booking_ref: '11111111-1111-1111-9111-111111111111',
      flight_id: 'BA214-2026-03-01-0800',
    })

    const { req, res } = createMocks({ method: 'POST', body: validBody })
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    const data = res._getJSONData()
    expect(data.ok).toBe(true)
    expect(data.bookingRef).toBeDefined()
    expect(data.flightId).toMatch(/BA214/)
  })

  test('returns 400 when selected airline does not match the route flight code', async () => {
    const sb = mockSupabase()
    sb.forTable('routes').returnSingle({ flight_code: 'BA214', duration_minutes: 90 })

    const { req, res } = createMocks({
      method: 'POST',
      body: { ...validBody, airline: 'Ryanair' },
    })

    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res._getJSONData().error).toMatch(/does not operate/i)
  })

  test('returns 400 for invalid departureDate/time', async () => {
    mockSupabase()
    const { req, res } = createMocks({
      method: 'POST',
      body: { ...validBody, departureDate: 'not-a-date' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
  })

  test('uses default time of 08:00 when departureTime is omitted', async () => {
    const sb = mockSupabase()
    sb.forTable('routes').returnSingle({ flight_code: 'BA214', duration_minutes: 90 })
    sb.forTable('flights').returnData(null)
    sb.forTable('bookings').returnSingle({
      booking_ref: '22222222-2222-2222-9222-222222222222',
      flight_id: 'BA214-2026-03-01-0800',
    })

    const { req, res } = createMocks({
      method: 'POST',
      body: { ...validBody, departureTime: undefined },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res._getJSONData().flightId).toContain('0800')
  })
})
