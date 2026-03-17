import { getSupabaseAdmin } from '../../../utils/supabaseServer'
import { fetchAirlineClaimFlights } from '../../../utils/airlineClaims'

export default async function handler(req, res) {
  const supabase = getSupabaseAdmin()
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'GET') {
    const { airlineCode } = req.query

    try {
      const claims = await fetchAirlineClaimFlights(supabase, airlineCode)
      return res.status(200).json({ ok: true, claims })
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message })
    }
  }

  if (req.method === 'PATCH') {
    let body
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    } catch {
      return res.status(400).json({ ok: false, error: 'Invalid JSON body' })
    }

    const { bookingRef, claimStatus } = body || {}

    if (!bookingRef) {
      return res.status(400).json({ ok: false, error: 'Missing bookingRef' })
    }
    if (!['awaiting_decision', 'accepted', 'rejected'].includes(claimStatus)) {
      return res.status(400).json({ ok: false, error: 'claimStatus must be "awaiting_decision", "accepted" or "rejected"' })
    }

    const { data, error } = await supabase
      .from('registered_flights')
      .update({ claim_status: claimStatus })
      .eq('booking_ref', bookingRef)
      .select('booking_ref, claim_status')
      .single()

    if (error) {
      return res.status(500).json({ ok: false, error: error.message })
    }

    return res.status(200).json({ ok: true, updated: data })
  }

  if (req.method === 'POST') {
    let body
    try {
      body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    } catch {
      return res.status(400).json({ ok: false, error: 'Invalid JSON body' })
    }

    const { flightId } = body || {}
    if (!flightId || typeof flightId !== 'string') {
      return res.status(400).json({ ok: false, error: 'Missing flightId' })
    }

    const { data: flight, error: flightErr } = await supabase
      .from('flights')
      .select('flight_id, delay_minutes, actual_arrival_at')
      .eq('flight_id', flightId)
      .single()

    if (flightErr || !flight) {
      return res.status(404).json({ ok: false, error: 'Flight not found' })
    }

    if (!flight.actual_arrival_at || (flight.delay_minutes || 0) < 180) {
      return res.status(400).json({ ok: false, error: 'Flight is not delayed >= 180 minutes' })
    }

    const { data: bookings, error: bookingsErr } = await supabase
      .from('bookings')
      .select('booking_ref')
      .eq('flight_id', flightId)

    if (bookingsErr) {
      return res.status(500).json({ ok: false, error: bookingsErr.message })
    }

    const bookingRefs = (bookings || []).map((b) => b.booking_ref).filter(Boolean)
    if (bookingRefs.length === 0) {
      return res.status(200).json({ ok: true, updated: 0, message: 'No bookings found for this flight' })
    }

    const { data: updated, error: updateErr } = await supabase
      .from('registered_flights')
      .update({ claim_status: 'awaiting_decision' })
      .in('booking_ref', bookingRefs)
      .eq('claim_status', 'registered')
      .select('booking_ref, claim_status')

    if (updateErr) {
      return res.status(500).json({ ok: false, error: updateErr.message })
    }

    return res.status(200).json({ ok: true, updated: (updated || []).length })
  }

  res.setHeader('Allow', ['GET', 'PATCH', 'POST'])
  return res.status(405).json({ ok: false, error: 'Method not allowed' })
}
