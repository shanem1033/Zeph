import { getSupabaseAdmin } from '../../../utils/supabaseServer'
import { isUuid } from '../../../utils/apiHelpers'

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

  if (!isUuid(bookingRef)) {
    return res.status(400).json({ ok: false, error: 'Invalid bookingRef (expected UUID)' })
  }

  const supabase = getSupabaseAdmin()

  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('booking_ref, flight_id')
    .eq('booking_ref', bookingRef)
    .maybeSingle()

  if (bookingError) {
    return res.status(500).json({ ok: false, error: bookingError.message })
  }

  if (!booking) {
    return res.status(404).json({ ok: false, error: 'Booking reference not found' })
  }

  const { data: existing, error: existingError } = await supabase
    .from('registered_flights')
    .select('booking_ref, status')
    .eq('booking_ref', bookingRef)
    .maybeSingle()

  if (existingError) {
    return res.status(500).json({ ok: false, error: existingError.message })
  }

  if (existing?.status === 'confirmed') {
    return res.status(409).json({ ok: false, error: 'This booking has already been registered' })
  }

  // Create/refresh a pending row so the booking is effectively "reserved" for registration.
  const { error: upsertError } = await supabase
    .from('registered_flights')
    .upsert(
      {
        booking_ref: bookingRef,
        status: 'pending',
        tx_hash: null,
        chain_id: null,
        contract_address: null,
        confirmed_at: null,
        failed_at: null,
        error_message: null,
      },
      { onConflict: 'booking_ref' }
    )

  if (upsertError) {
    return res.status(500).json({ ok: false, error: upsertError.message })
  }

  return res.status(200).json({ ok: true, flightId: booking.flight_id })
}
