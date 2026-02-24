/**
 * Tests for GET /api/airline/claims
 *
 * Returns flights that have registered claims in 'awaiting_decision' status.
 */
import { createMocks, mockSupabase, resetSupabaseMock } from '../../helpers/setup'

jest.mock('../../../utils/supabaseServer')

import handler from '../../../pages/api/airline/claims/index'

afterEach(() => resetSupabaseMock())

describe('GET /api/airline/claims', () => {
  test('rejects non-GET methods with 405', async () => {
    mockSupabase()
    const { req, res } = createMocks({ method: 'POST' })
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })

  test('returns empty flights array when no claims are awaiting decision', async () => {
    const sb = mockSupabase()
    sb.forTable('registered_flights').returnData([])

    const { req, res } = createMocks({ method: 'GET' })
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res._getJSONData()).toEqual({ ok: true, flights: [] })
  })

  test('returns flight details with decision info for awaiting claims', async () => {
    const sb = mockSupabase()
    sb.forTable('registered_flights').returnData([
      { booking_ref: 'ref-1', bookings: { flight_id: 'FL-001' } },
    ])
    sb.forTable('flights').returnData([
      {
        flight_id: 'FL-001',
        flight_code: 'BA214',
        origin: 'Dublin',
        destination: 'London',
        scheduled_departure_at: '2026-02-15T08:00:00Z',
        scheduled_arrival_at: '2026-02-15T09:30:00Z',
        actual_arrival_at: '2026-02-15T13:00:00Z',
        delay_minutes: 210,
        oracle_processed_at: null,
        oracle_tx_hash: null,
      },
    ])
    sb.forTable('flight_claim_decisions').returnData([])

    const { req, res } = createMocks({ method: 'GET' })
    await handler(req, res)
    expect(res.statusCode).toBe(200)

    const { flights } = res._getJSONData()
    expect(flights).toHaveLength(1)
    expect(flights[0].flight_id).toBe('FL-001')
    expect(flights[0].decision).toBeNull()
  })

  test('handles Supabase error gracefully', async () => {
    const sb = mockSupabase()
    sb.forTable('registered_flights').returnError({ message: 'db error' })

    const { req, res } = createMocks({ method: 'GET' })
    await handler(req, res)
    expect(res.statusCode).toBe(500)
  })
})
