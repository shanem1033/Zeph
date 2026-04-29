/**
 * Tests for POST /api/registration/complete
 *
 * Confirms an on-chain registration by updating registered_flights to
 * 'confirmed' and marking the booking as redeemed.
 */
import { createMocks, mockSupabase, resetSupabaseMock } from '../../helpers/setup'

jest.mock('../../../src/web/utils/supabaseServer')

import handler from '../../../src/web/pages/api/registration/complete'

const VALID_UUID = '11111111-1111-1111-9111-111111111111'
const VALID_TX = '0x' + 'a'.repeat(64)

afterEach(() => resetSupabaseMock())

describe('POST /api/registration/complete', () => {
  test('rejects non-POST methods with 405', async () => {
    mockSupabase()
    const { req, res } = createMocks({ method: 'GET' })
    await handler(req, res)
    expect(res.statusCode).toBe(405)
  })

  test('returns 400 for missing bookingRef', async () => {
    mockSupabase()
    const { req, res } = createMocks({ method: 'POST', body: { txHash: VALID_TX } })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res._getJSONData().error).toMatch(/invalid bookingRef/i)
  })

  test('returns 400 for invalid txHash', async () => {
    mockSupabase()
    const { req, res } = createMocks({
      method: 'POST',
      body: { bookingRef: VALID_UUID, txHash: 'bad' },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(400)
    expect(res._getJSONData().error).toMatch(/invalid txHash/i)
  })

  test('returns 404 when booking does not exist', async () => {
    const sb = mockSupabase()
    sb.forTable('bookings').returnSingle(null)

    const { req, res } = createMocks({
      method: 'POST',
      body: { bookingRef: VALID_UUID, txHash: VALID_TX },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(404)
  })

  test('returns 200 on successful completion', async () => {
    const sb = mockSupabase()
    sb.forTable('bookings').returnSingle({ booking_ref: VALID_UUID })
    sb.forTable('registered_flights').returnData(null) // upsert OK

    const { req, res } = createMocks({
      method: 'POST',
      body: {
        bookingRef: VALID_UUID,
        txHash: VALID_TX,
        chainId: 31337,
        contractAddress: '0x' + 'b'.repeat(40),
        registeredByWallet: '0x' + 'c'.repeat(40),
      },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res._getJSONData().ok).toBe(true)
  })

  test('handles Supabase upsert error', async () => {
    const sb = mockSupabase()
    sb.forTable('bookings').returnSingle({ booking_ref: VALID_UUID })
    sb.forTable('registered_flights').returnError({ message: 'upsert failed' })

    const { req, res } = createMocks({
      method: 'POST',
      body: { bookingRef: VALID_UUID, txHash: VALID_TX },
    })
    await handler(req, res)
    expect(res.statusCode).toBe(500)
  })
})
