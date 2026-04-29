import { createMocks, mockSupabase, resetSupabaseMock } from '../../helpers/setup'

jest.mock('../../../src/web/utils/supabaseServer')

import handler from '../../../src/web/pages/api/passenger/balance'

afterEach(() => resetSupabaseMock())

describe('GET /api/passenger/balance', () => {
  test('rejects non-GET methods with 405', async () => {
    mockSupabase()
    const { req, res } = createMocks({ method: 'POST', headers: { Authorization: 'Bearer user-a' } })
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })

  test('returns 401 when auth header is missing', async () => {
    mockSupabase()
    const { req, res } = createMocks({ method: 'GET', headers: {} })
    await handler(req, res)
    expect(res.statusCode).toBe(401)
  })

  test('returns zero balance when no payments exist', async () => {
    const sb = mockSupabase()
    sb.forTable('claim_payments').returnData([])

    const { req, res } = createMocks({ method: 'GET', headers: { Authorization: 'Bearer user-a' } })
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    expect(res._getJSONData()).toEqual({
      ok: true,
      balanceEur: 0,
      creditedClaimsCount: 0,
      payments: [],
    })
  })

  test('returns summed balance and payment history', async () => {
    const sb = mockSupabase()
    sb.forTable('claim_payments').returnData([
      {
        booking_ref: 'ref-1',
        flight_id: 'BA214-2026-02-15-0800',
        airline_code: 'BA',
        amount_eur: 300,
        source_status: 'accepted',
        credited_at: '2026-03-01T10:00:00Z',
        passenger_email: 'a@example.com',
      },
      {
        booking_ref: 'ref-2',
        flight_id: 'FR201-2026-02-16-0800',
        airline_code: 'FR',
        amount_eur: 300,
        source_status: 'auto_accepted',
        credited_at: '2026-03-02T10:00:00Z',
        passenger_email: 'a@example.com',
      },
    ])

    const { req, res } = createMocks({ method: 'GET', headers: { Authorization: 'Bearer user-a' } })
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const data = res._getJSONData()
    expect(data.balanceEur).toBe(600)
    expect(data.creditedClaimsCount).toBe(2)
    expect(data.payments).toHaveLength(2)
    expect(data.payments[0].bookingRef).toBe('ref-1')
  })
})
