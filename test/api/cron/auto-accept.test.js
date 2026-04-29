/**
 * Tests for POST /api/cron/auto-accept
 *
 * Auto-accepts claims on flights where the airline has not responded
 * within 7 days of the flight landing.
 */
import { createMocks, mockSupabase, resetSupabaseMock } from '../../helpers/setup'

jest.mock('../../../src/web/utils/supabaseServer')

process.env.ADMIN_SECRET = 'test-cron-secret'

import handler from '../../../src/web/pages/api/cron/auto-accept'

afterEach(() => resetSupabaseMock())

describe('POST /api/cron/auto-accept', () => {
  test('rejects non-POST methods with 405', async () => {
    mockSupabase()
    const { req, res } = createMocks({ method: 'GET', headers: { 'x-cron-secret': 'test-cron-secret' } })
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })

  test('rejects request with missing or wrong secret with 403', async () => {
    mockSupabase()
    const { req, res } = createMocks({ method: 'POST', headers: { 'x-cron-secret': 'wrong-secret' } })
    await handler(req, res)
    expect(res.statusCode).toBe(403)
    expect(res._getJSONData().error).toMatch(/forbidden/i)
  })

  test('returns count 0 when no eligible delayed flights exist', async () => {
    const sb = mockSupabase()
    sb.forTable('flights').returnData([])

    const { req, res } = createMocks({
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res._getJSONData()).toEqual({ ok: true, autoAcceptedFlights: [], count: 0 })
  })

  test('returns count 0 when all eligible flights already have decisions', async () => {
    const sb = mockSupabase()
    sb.forTable('flights').returnData([{ flight_id: 'FL-OLD' }])
    sb.forTable('flight_claim_decisions').returnData([{ flight_id: 'FL-OLD' }])

    const { req, res } = createMocks({
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res._getJSONData()).toEqual({ ok: true, autoAcceptedFlights: [], count: 0 })
  })

  test('auto-accepts a flight with awaiting claims older than 7 days', async () => {
    const sb = mockSupabase()
    sb.forTable('flights').returnData([{ flight_id: 'FL-EXPIRED' }])
    sb.forTable('flight_claim_decisions').returnData([])
    sb.forTable('bookings').returnData([
      { booking_ref: 'ref-1', flight_id: 'FL-EXPIRED' },
      { booking_ref: 'ref-2', flight_id: 'FL-EXPIRED' },
    ])
    sb.forTable('registered_flights').returnData([
      { booking_ref: 'ref-1', status: 'confirmed', claim_status: 'awaiting_decision' },
    ])

    const { req, res } = createMocks({
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(200)

    const data = res._getJSONData()
    expect(data.ok).toBe(true)
    expect(data.count).toBe(1)
    expect(data.autoAcceptedFlights).toContain('FL-EXPIRED')
  })

  test('skips flights with no awaiting claims', async () => {
    const sb = mockSupabase()
    sb.forTable('flights').returnData([{ flight_id: 'FL-NODECISION' }])
    sb.forTable('flight_claim_decisions').returnData([])
    sb.forTable('bookings').returnData([
      { booking_ref: 'ref-x', flight_id: 'FL-NODECISION' },
    ])
    // No awaiting_decision claims — all already accepted
    sb.forTable('registered_flights').returnData([])

    const { req, res } = createMocks({
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res._getJSONData().count).toBe(0)
  })

  test('handles Supabase error gracefully', async () => {
    const sb = mockSupabase()
    sb.forTable('flights').returnError({ message: 'db error' })

    const { req, res } = createMocks({
      method: 'POST',
      headers: { 'x-cron-secret': 'test-cron-secret' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(500)
  })
})
