import { getSupabaseAdmin } from '../../../utils/supabaseServer'

export default async function handler(req, res) {
  const supabase = getSupabaseAdmin()

  /* ─── GET: fetch all delayed flights with their claims ─── */
  if (req.method === 'GET') {
    // 1. All flights that have actually landed and are delayed ≥ 180 min
    const { data: flights, error: flightsErr } = await supabase
      .from('flights')
      .select('*')
      .gte('delay_minutes', 180)
      .not('actual_arrival_at', 'is', null)
      .order('actual_arrival_at', { ascending: false })

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
    if (!['accepted', 'rejected'].includes(claimStatus)) {
      return res.status(400).json({ ok: false, error: 'claimStatus must be "accepted" or "rejected"' })
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

  res.setHeader('Allow', ['GET', 'PATCH'])
  return res.status(405).json({ ok: false, error: 'Method not allowed' })
}
