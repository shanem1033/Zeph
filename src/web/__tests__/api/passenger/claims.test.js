/**
 * Tests for POST /api/passenger/claims
 *
 * This endpoint lets a passenger look up the claim status for their registered
 * flights.  The last two tests assert the CORRECT expected behaviour — they
 * will FAIL until the endpoint is fixed to authenticate users and filter
 * claims by ownership.
 */
import { createMocks, mockSupabase, resetSupabaseMock } from '../../helpers/setup'

jest.mock('../../../utils/supabaseServer')

// Must import handler AFTER jest.mock so the mock is active
import handler from '../../../pages/api/passenger/claims/index'

const VALID_UUID_A = '11111111-1111-1111-9111-111111111111'
const VALID_UUID_B = '22222222-2222-2222-9222-222222222222'
const VALID_UUID_C = '33333333-3333-3333-9333-333333333333'

afterEach(() => resetSupabaseMock())

// Method guard

describe('POST /api/passenger/claims', () => {
  test('rejects non-POST methods with 405', async () => {
    mockSupabase()
    const { req, res } = createMocks({ method: 'GET', headers: { Authorization: 'Bearer user-a' } })
    await handler(req, res)
    expect(res.statusCode).toBe(405)
    expect(res._getJSONData().error).toMatch(/method not allowed/i)
  })

  // Input validation

  test('returns empty claims when bookingRefs is missing', async () => {
    mockSupabase()
    const { req, res } = createMocks({ method: 'POST', body: {}, headers: { Authorization: 'Bearer user-a' } })
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res._getJSONData().claims).toEqual([])
  })

  test('returns empty claims when bookingRefs is empty array', async () => {
    mockSupabase()
    const { req, res } = createMocks({ method: 'POST', body: { bookingRefs: [] }, headers: { Authorization: 'Bearer user-a' } })
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res._getJSONData().claims).toEqual([])
  })

  test('filters out non-UUID values from bookingRefs', async () => {
    const sb = mockSupabase()
    sb.forTable('registered_flights').returnData([])
    const { req, res } = createMocks({
      method: 'POST',
      body: { bookingRefs: ['not-a-uuid', '12345', null] },
      headers: { Authorization: 'Bearer user-a' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res._getJSONData().claims).toEqual([])
  })

  // Happy path

  test('returns claim data for valid bookingRefs', async () => {
    const sb = mockSupabase()
    sb.forTable('bookings').returnData([
      { booking_ref: VALID_UUID_A, flight_id: 'BA214-2026-02-15-0800', passenger_email: 'a@example.com' },
    ])
    sb.forTable('registered_flights').returnData([
      {
        booking_ref: VALID_UUID_A,
        claim_status: 'registered',
        bookings: { flight_id: 'BA214-2026-02-15-0800', passenger_email: 'a@example.com' },
      },
    ])

    const { req, res } = createMocks({
      method: 'POST',
      body: { bookingRefs: [VALID_UUID_A] },
      headers: { Authorization: 'Bearer user-a' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(200)

    const { claims } = res._getJSONData()
    expect(claims).toHaveLength(1)
    expect(claims[0]).toEqual({
      bookingRef: VALID_UUID_A,
      flightId: 'BA214-2026-02-15-0800',
      claimStatus: 'registered',
    })
  })

  test('returns multiple claims when multiple refs provided', async () => {
    const sb = mockSupabase()
    sb.forTable('bookings').returnData([
      { booking_ref: VALID_UUID_A, flight_id: 'FL-001', passenger_email: 'a@example.com' },
      { booking_ref: VALID_UUID_B, flight_id: 'FL-002', passenger_email: 'a@example.com' },
    ])
    sb.forTable('registered_flights').returnData([
      { booking_ref: VALID_UUID_A, claim_status: 'registered', bookings: { flight_id: 'FL-001', passenger_email: 'a@example.com' } },
      { booking_ref: VALID_UUID_B, claim_status: 'accepted', bookings: { flight_id: 'FL-002', passenger_email: 'a@example.com' } },
    ])

    const { req, res } = createMocks({
      method: 'POST',
      body: { bookingRefs: [VALID_UUID_A, VALID_UUID_B] },
      headers: { Authorization: 'Bearer user-a' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res._getJSONData().claims).toHaveLength(2)
  })

  // DB error

  test('returns 500 when Supabase query fails', async () => {
    const sb = mockSupabase()
    sb.forTable('bookings').returnData([{ booking_ref: VALID_UUID_A, passenger_email: 'a@example.com' }])
    sb.forTable('registered_flights').returnError({ message: 'connection refused' })
    // When there's an error, the handler throws — our mock needs to make
    // the awaited query reject.
    const { req, res } = createMocks({ method: 'POST', body: { bookingRefs: [VALID_UUID_A] }, headers: { Authorization: 'Bearer user-a' } })
    await handler(req, res)
    expect(res.statusCode).toBe(500)
  })

  // ── User-scoped filtering (these should FAIL until the fix is applied) ─────

  test('should only return claims belonging to the authenticated user', async () => {
    /**
     * User A owns VALID_UUID_A.
     * User B owns VALID_UUID_B and VALID_UUID_C.
     *
     * When User A is authenticated, the endpoint should only return
     * User A's claim — even if the request includes other users' refs.
     */
    const sb = mockSupabase()
    sb.forTable('bookings').returnData([
      { booking_ref: VALID_UUID_A, passenger_email: 'a@example.com' },
      { booking_ref: VALID_UUID_B, passenger_email: 'b@example.com' },
      { booking_ref: VALID_UUID_C, passenger_email: 'b@example.com' },
    ])
    sb.forTable('registered_flights').returnData([
      { booking_ref: VALID_UUID_A, claim_status: 'registered', bookings: { flight_id: 'FL-A', passenger_email: 'a@example.com' } },
      { booking_ref: VALID_UUID_B, claim_status: 'accepted', bookings: { flight_id: 'FL-B', passenger_email: 'b@example.com' } },
      { booking_ref: VALID_UUID_C, claim_status: 'rejected', bookings: { flight_id: 'FL-C', passenger_email: 'b@example.com' } },
    ])

    // Simulate User A sending ALL booking refs (including B's and C's)
    const { req, res } = createMocks({
      method: 'POST',
      body: { bookingRefs: [VALID_UUID_A, VALID_UUID_B, VALID_UUID_C] },
      headers: { Authorization: 'Bearer user-a' },
    })

    await handler(req, res)

    const { claims } = res._getJSONData()

    // The handler should authenticate the caller and only return claims
    // where bookings.passenger_email matches the authenticated user.
    expect(claims).toHaveLength(1)
    expect(claims[0].bookingRef).toBe(VALID_UUID_A)
  })

  test('should return 401 when no auth header is provided', async () => {
    /**
     * An unauthenticated request should be rejected with 401.
     */
    const sb = mockSupabase()
    sb.forTable('registered_flights').returnData([])

    const { req, res } = createMocks({ method: 'POST', body: { bookingRefs: [VALID_UUID_A] }, headers: {} })

    await handler(req, res)

    expect(res.statusCode).toBe(401)
  })
})
