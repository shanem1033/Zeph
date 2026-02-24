/**
 * Tests for POST /api/airline/claims/decide
 *
 * Lets the airline accept or reject claims for a given flight.
 */
import { createMocks, mockSupabase, resetSupabaseMock } from '../../helpers/setup'

jest.mock('../../../utils/supabaseServer')

import handler from '../../../pages/api/airline/claims/decide'

afterEach(() => resetSupabaseMock())

describe('POST /api/airline/claims/decide', () => {
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
      body: { decision: 'accepted' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res._getJSONData().error).toMatch(/flightId/i)
  })

  test('returns 400 for invalid decision value', async () => {
    mockSupabase()
    const { req, res } = createMocks({
      method: 'POST',
      body: { flightId: 'FL-001', decision: 'maybe' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res._getJSONData().error).toMatch(/decision/i)
  })

  test('returns 400 when rejecting without evidence', async () => {
    mockSupabase()
    const { req, res } = createMocks({
      method: 'POST',
      body: { flightId: 'FL-001', decision: 'rejected' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res._getJSONData().error).toMatch(/evidence/i)
  })

  test('returns 404 when no bookings exist for flight', async () => {
    const sb = mockSupabase()
    sb.forTable('bookings').returnData([])

    const { req, res } = createMocks({
      method: 'POST',
      body: { flightId: 'FL-001', decision: 'accepted' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(404)
  })

  test('returns 409 when no claims are awaiting decision', async () => {
    const sb = mockSupabase()
    sb.forTable('bookings').returnData([{ booking_ref: 'ref-1' }])
    sb.forTable('registered_flights').returnData([]) // no awaiting rows

    const { req, res } = createMocks({
      method: 'POST',
      body: { flightId: 'FL-001', decision: 'accepted' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(409)
  })

  test('accepts claims successfully', async () => {
    const sb = mockSupabase()
    sb.forTable('bookings').returnData([{ booking_ref: 'ref-1' }])
    sb.forTable('registered_flights').returnData([{ booking_ref: 'ref-1' }])
    sb.forTable('flight_claim_decisions').returnData(null) // upsert OK

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        flightId: 'FL-001',
        decision: 'accepted',
        txHash: '0x' + 'a'.repeat(64),
      },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    const data = res._getJSONData()
    expect(data.ok).toBe(true)
    expect(data.decision).toBe('accepted')
    expect(data.claimStatus).toBe('accepted')
  })

  test('rejects claims with evidence successfully', async () => {
    const sb = mockSupabase()
    sb.forTable('bookings').returnData([{ booking_ref: 'ref-1' }])
    sb.forTable('registered_flights').returnData([{ booking_ref: 'ref-1' }])
    sb.forTable('flight_claim_decisions').returnData(null)

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        flightId: 'FL-001',
        decision: 'rejected',
        evidence: { reason: 'Weather delay', documentation: 'METAR report' },
      },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    const data = res._getJSONData()
    expect(data.decision).toBe('rejected')
    expect(data.claimStatus).toBe('rejected')
    expect(data.evidenceHash).toBeDefined()
  })
})
