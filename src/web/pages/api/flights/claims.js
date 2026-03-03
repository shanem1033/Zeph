import { getSupabaseAdmin } from '../../../utils/supabaseServer'

export default async function handler(req, res) {
  const supabase = getSupabaseAdmin()

  /* ─── GET: fetch delayed flights with their claims ─── */
  if (req.method === 'GET') {
    const { airlineCode } = req.query

    // 1. All flights that have actually landed and are delayed ≥ 180 min
    let query = supabase
      .from('flights')
      .select('*')
      .gte('delay_minutes', 180)
      .not('actual_arrival_at', 'is', null)
      .order('actual_arrival_at', { ascending: false })

    // If an airline code is provided, only return flights whose code starts with it
    if (airlineCode) {
      query = query.like('flight_code', `${airlineCode}%`)
    }

    const { data: flights, error: flightsErr } = await query

    if (flightsErr) {
      return res.status(500).json({ ok: false, error: flightsErr.message })
    }

    if (!flights || flights.length === 0) {
      return res.status(200).json({ ok: true, claims: [] })
    }

    // 2. For those flights, get all bookings
    const flightIds = flights.map((f) => f.flight_id)

    const { data: bookings, error: bookingsErr } = await supabase
      .from('bookings')
      .select('booking_ref, flight_id, passenger_name, passenger_email, passport_number')
      .in('flight_id', flightIds)

    if (bookingsErr) {
      return res.status(500).json({ ok: false, error: bookingsErr.message })
    }

    // 3. For those bookings, get registered_flights (Zeph registrations)
    const bookingRefs = (bookings || []).map((b) => b.booking_ref)

    let registrations = []
    if (bookingRefs.length > 0) {
      const { data: regs, error: regsErr } = await supabase
        .from('registered_flights')
        .select('booking_ref, status, claim_status, registered_by_wallet, tx_hash')
        .in('booking_ref', bookingRefs)

      if (regsErr) {
        return res.status(500).json({ ok: false, error: regsErr.message })
      }
      registrations = regs || []
    }

    // 4. Build a lookup map
    const regMap = Object.fromEntries(registrations.map((r) => [r.booking_ref, r]))
    const bookingsByFlight = {}
    for (const b of bookings || []) {
      if (!bookingsByFlight[b.flight_id]) bookingsByFlight[b.flight_id] = []
      bookingsByFlight[b.flight_id].push({
        ...b,
        registration: regMap[b.booking_ref] || null,
      })
    }

    // 5. Shape the response
    const claims = flights.map((f) => ({
      flight_id: f.flight_id,
      flight_code: f.flight_code,
      origin: f.origin,
      destination: f.destination,
      scheduled_departure: f.scheduled_departure_at,
      scheduled_arrival: f.scheduled_arrival_at,
      actual_arrival: f.actual_arrival_at,
      delay_minutes: f.delay_minutes,
      passengers: bookingsByFlight[f.flight_id] || [],
    }))

    return res.status(200).json({ ok: true, claims })
  }

  /* ─── PATCH: update a claim status (accept / reject) ─── */
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

  /* ─── POST: mark all registered claims on a delayed flight as awaiting_decision ─── */
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

    // Verify the flight exists and is delayed ≥ 180 min
    const { data: flight, error: flightErr } = await supabase
      .from('flights')
      .select('flight_id, delay_minutes, actual_arrival_at')
      .eq('flight_id', flightId)
      .single()

    if (flightErr || !flight) {
      return res.status(404).json({ ok: false, error: 'Flight not found' })
    }

    if (!flight.actual_arrival_at || (flight.delay_minutes || 0) < 180) {
      return res.status(400).json({ ok: false, error: 'Flight is not delayed ≥ 180 minutes' })
    }

    // Find all bookings for this flight
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

    // Update all registered_flights that are still in 'registered' status
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
