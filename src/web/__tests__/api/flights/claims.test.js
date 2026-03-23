import { createMocks, mockSupabase, resetSupabaseMock } from '../../helpers/setup'

jest.mock('../../../utils/supabaseServer')
jest.mock('../../../utils/airlineClaims')

import handler from '../../../pages/api/flights/claims'
import { fetchAirlineClaimFlights } from '../../../utils/airlineClaims'

afterEach(() => {
  resetSupabaseMock()
  jest.clearAllMocks()
})

describe('GET /api/flights/claims', () => {
  it('returns claims from fetchAirlineClaimFlights', async () => {
    mockSupabase()
    const mockClaims = [{ flightId: 'FR340', claimStatus: 'awaiting_decision' }]
    fetchAirlineClaimFlights.mockResolvedValue(mockClaims)

    const { req, res } = createMocks({ method: 'GET', query: { airlineCode: 'FR' } })
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const body = res._getJSONData()
    expect(body.ok).toBe(true)
    expect(body.claims).toEqual(mockClaims)
    expect(fetchAirlineClaimFlights).toHaveBeenCalledWith(expect.anything(), 'FR')
  })

  it('returns 500 when fetchAirlineClaimFlights throws', async () => {
    mockSupabase()
    fetchAirlineClaimFlights.mockRejectedValue(new Error('DB error'))

    const { req, res } = createMocks({ method: 'GET' })
    await handler(req, res)

    expect(res.statusCode).toBe(500)
    expect(res._getJSONData().ok).toBe(false)
  })
})

describe('PATCH /api/flights/claims', () => {
  it('returns 400 when bookingRef is missing', async () => {
    mockSupabase()
    const { req, res } = createMocks({
      method: 'PATCH',
      body: { claimStatus: 'accepted' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res._getJSONData().error).toMatch(/bookingRef/i)
  })

  it('returns 400 for invalid claimStatus value', async () => {
    mockSupabase()
    const { req, res } = createMocks({
      method: 'PATCH',
      body: { bookingRef: 'some-ref', claimStatus: 'invalid_status' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res._getJSONData().error).toMatch(/claimStatus/i)
  })

  it('updates claim status successfully', async () => {
    const sb = mockSupabase()
    sb.forTable('registered_flights').returnSingle({
      booking_ref: 'abc-123',
      claim_status: 'accepted',
    })

    const { req, res } = createMocks({
      method: 'PATCH',
      body: { bookingRef: 'abc-123', claimStatus: 'accepted' },
    })
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const body = res._getJSONData()
    expect(body.ok).toBe(true)
    expect(body.updated.claim_status).toBe('accepted')
  })

  it('returns 500 on DB error', async () => {
    const sb = mockSupabase()
    sb.forTable('registered_flights').returnError({ message: 'DB failure' })

    const { req, res } = createMocks({
      method: 'PATCH',
      body: { bookingRef: 'abc-123', claimStatus: 'accepted' },
    })
    await handler(req, res)

    expect(res.statusCode).toBe(500)
  })
})

describe('POST /api/flights/claims', () => {
  it('returns 400 when flightId is missing', async () => {
    mockSupabase()
    const { req, res } = createMocks({ method: 'POST', body: {} })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res._getJSONData().error).toMatch(/flightId/i)
  })

  it('returns 404 when flight not found', async () => {
    const sb = mockSupabase()
    sb.forTable('flights').returnSingle(null)

    const { req, res } = createMocks({
      method: 'POST',
      body: { flightId: 'UNKNOWN' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(404)
  })

  it('returns 400 when flight delay is less than 180 min', async () => {
    const sb = mockSupabase()
    sb.forTable('flights').returnSingle({
      flight_id: 'FR340',
      delay_minutes: 60,
      actual_arrival_at: '2025-01-01T13:00:00Z',
    })

    const { req, res } = createMocks({
      method: 'POST',
      body: { flightId: 'FR340' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res._getJSONData().error).toMatch(/180/i)
  })

  it('transitions registered claims to awaiting_decision', async () => {
    const sb = mockSupabase()
    sb.forTable('flights').returnSingle({
      flight_id: 'FR340',
      delay_minutes: 200,
      actual_arrival_at: '2025-01-01T15:20:00Z',
    })
    sb.forTable('bookings').returnData([
      { booking_ref: 'ref-001' },
      { booking_ref: 'ref-002' },
    ])
    sb.forTable('registered_flights').returnData([
      { booking_ref: 'ref-001', claim_status: 'registered' },
      { booking_ref: 'ref-002', claim_status: 'registered' },
    ])

    const { req, res } = createMocks({
      method: 'POST',
      body: { flightId: 'FR340' },
    })
    await handler(req, res)

    expect(res.statusCode).toBe(200)
    const body = res._getJSONData()
    expect(body.ok).toBe(true)
    expect(body.updated).toBe(2)
  })
})

describe('method guard', () => {
  it('returns 405 for unsupported methods', async () => {
    mockSupabase()
    const { req, res } = createMocks({ method: 'DELETE' })
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })
})
