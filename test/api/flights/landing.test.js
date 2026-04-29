/**
 * Tests for POST /api/flights/landing
 *
 * Records the actual arrival time for a flight and computes the delay.
 */
import { createMocks, mockSupabase, resetSupabaseMock } from '../../helpers/setup'

jest.mock('../../../src/web/utils/supabaseServer')

import handler from '../../../src/web/pages/api/flights/landing'

afterEach(() => resetSupabaseMock())

describe('POST /api/flights/landing', () => {
  test('rejects non-POST methods with 405', async () => {
    mockSupabase()
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })

  test('returns 400 when flightId is missing', async () => {
    mockSupabase()
    const { req, res } = createMocks({
      method: 'POST',
      body: { actualArrivalAt: '2026-02-15T13:00:00Z' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res._getJSONData().error).toMatch(/flightId/i)
  })

  test('returns 400 when actualArrivalAt is missing', async () => {
    mockSupabase()
    const { req, res } = createMocks({
      method: 'POST',
      body: { flightId: 'FL-001' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res._getJSONData().error).toMatch(/actualArrivalAt/i)
  })

  test('returns 400 for invalid date format', async () => {
    mockSupabase()
    const { req, res } = createMocks({
      method: 'POST',
      body: { flightId: 'FL-001', actualArrivalAt: 'not-a-date' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
  })

  test('returns 404 when flight does not exist', async () => {
    const sb = mockSupabase()
    // .single() returns { data: null, error: ... } when no row found
    sb.forTable('flights').returnSingle(null)
    sb.forTable('flights').returnError({ message: 'not found', code: 'PGRST116' })

    const { req, res } = createMocks({
      method: 'POST',
      body: { flightId: 'FL-NONEXIST', actualArrivalAt: '2026-02-15T13:00:00Z' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(404)
  })

  test('returns 409 when landing already recorded', async () => {
    const sb = mockSupabase()
    sb.forTable('flights').returnSingle({
      flight_id: 'FL-001',
      scheduled_arrival_at: '2026-02-15T09:30:00Z',
      actual_arrival_at: '2026-02-15T13:00:00Z', // already set
    })

    const { req, res } = createMocks({
      method: 'POST',
      body: { flightId: 'FL-001', actualArrivalAt: '2026-02-15T14:00:00Z' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(409)
    expect(res._getJSONData().error).toMatch(/already recorded/i)
  })

  test('records landing and calculates delay correctly', async () => {
    const sb = mockSupabase()
    sb.forTable('flights').returnSingle({
      flight_id: 'FL-001',
      scheduled_arrival_at: '2026-02-15T09:30:00Z',
      actual_arrival_at: null,
    })

    // actual arrival is 3.5 hours late = 210 minutes
    const { req, res } = createMocks({
      method: 'POST',
      body: { flightId: 'FL-001', actualArrivalAt: '2026-02-15T13:00:00Z' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    const data = res._getJSONData()
    expect(data.ok).toBe(true)
    expect(data.delayMinutes).toBe(210)
    expect(data.delayed).toBe(true) // >= 180 min
  })

  test('marks flight as not delayed when under 180 minutes', async () => {
    const sb = mockSupabase()
    sb.forTable('flights').returnSingle({
      flight_id: 'FL-002',
      scheduled_arrival_at: '2026-02-15T09:30:00Z',
      actual_arrival_at: null,
    })

    // On time (0 delay)
    const { req, res } = createMocks({
      method: 'POST',
      body: { flightId: 'FL-002', actualArrivalAt: '2026-02-15T09:30:00Z' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    const data = res._getJSONData()
    expect(data.delayMinutes).toBe(0)
    expect(data.delayed).toBe(false)
  })
})
