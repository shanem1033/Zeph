import { getSupabaseAdmin } from '../../../utils/supabaseServer'

function isUuid(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function isTxHash(value) {
  return typeof value === 'string' && /^0x([A-Fa-f0-9]{64})$/.test(value)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid JSON body' })
  }

  const bookingRef = body?.bookingRef
  const txHash = body?.txHash
  const chainId = body?.chainId ?? null
  const contractAddress = body?.contractAddress ?? null
  const registeredByWallet = body?.registeredByWallet ?? null

  if (!isUuid(bookingRef)) {
    return res.status(400).json({ ok: false, error: 'Invalid bookingRef (expected UUID)' })
  }

  if (!isTxHash(txHash)) {
    return res.status(400).json({ ok: false, error: 'Invalid txHash' })
  }

  const supabase = getSupabaseAdmin()

  // Ensure booking exists
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('booking_ref')
    .eq('booking_ref', bookingRef)
    .maybeSingle()

  if (bookingError) {
    return res.status(500).json({ ok: false, error: bookingError.message })
  }

  if (!booking) {
    return res.status(404).json({ ok: false, error: 'Booking reference not found' })
  }

  const now = new Date().toISOString()

  // Mark registration confirmed
  const { error: regError } = await supabase
    .from('registered_flights')
    .upsert(
      {
        booking_ref: bookingRef,
        status: 'confirmed',
        tx_hash: txHash,
        chain_id: chainId,
        contract_address: contractAddress,
        registered_by_wallet: registeredByWallet,
        confirmed_at: now,
        failed_at: null,
        error_message: null,
      },
      { onConflict: 'booking_ref' }
    )

  if (regError) {
    return res.status(500).json({ ok: false, error: regError.message })
  }

  // Mark booking as redeemed (one-time use)
  const { error: redeemError } = await supabase
    .from('bookings')
    .update({ redeemed_at: now })
    .eq('booking_ref', bookingRef)

  if (redeemError) {
    return res.status(500).json({ ok: false, error: redeemError.message })
  }

  return res.status(200).json({ ok: true })
}
