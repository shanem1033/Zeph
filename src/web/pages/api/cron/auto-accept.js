import { getSupabaseAdmin } from '../../../utils/supabaseServer'

/**
 * POST /api/cron/auto-accept
 *
 * Automatically accepts claims on delayed flights (≥ 180 min) where the
 * airline has not made a decision within 7 days of the flight landing.
 *
 * Protected by x-cron-secret header (must match ADMIN_SECRET env var).
 * Designed to be called by an external cron scheduler on a daily cadence.
 */

const AUTO_ACCEPT_DAYS = 7

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  // Auth check — re-uses the same ADMIN_SECRET pattern as set-flight-delayed
  if (req.headers['x-cron-secret'] !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ ok: false, error: 'Forbidden' })
  }

  try {
    const supabase = getSupabaseAdmin()

    // Calculate the cutoff: flights that landed more than 7 days ago
    const cutoff = new Date(Date.now() - AUTO_ACCEPT_DAYS * 24 * 60 * 60 * 1000)

    // 1. Find all delayed flights (≥ 180 min) that landed before the cutoff
    const { data: flights, error: flightsErr } = await supabase
      .from('flights')
      .select('flight_id')
      .gte('delay_minutes', 180)
      .not('actual_arrival_at', 'is', null)
      .lte('actual_arrival_at', cutoff.toISOString())

    if (flightsErr) throw flightsErr

    if (!flights || flights.length === 0) {
      return res.status(200).json({ ok: true, autoAcceptedFlights: [], count: 0 })
    }

    const flightIds = flights.map((f) => f.flight_id)

    // 2. Exclude flights that already have a decision
    const { data: existingDecisions, error: decisionsErr } = await supabase
      .from('flight_claim_decisions')
      .select('flight_id')
      .in('flight_id', flightIds)

    if (decisionsErr) throw decisionsErr

    const decidedFlightIds = new Set(
      (existingDecisions || []).map((d) => d.flight_id)
    )
    const undecidedFlightIds = flightIds.filter((id) => !decidedFlightIds.has(id))

    if (undecidedFlightIds.length === 0) {
      return res.status(200).json({ ok: true, autoAcceptedFlights: [], count: 0 })
    }

    // 3. For each undecided flight, check if there are awaiting_decision claims
    const autoAcceptedFlights = []

    for (const flightId of undecidedFlightIds) {
      // Get booking refs for this flight
      const { data: bookings, error: bookingsErr } = await supabase
        .from('bookings')
        .select('booking_ref')
        .eq('flight_id', flightId)

      if (bookingsErr) throw bookingsErr

      const bookingRefs = (bookings || []).map((b) => b.booking_ref).filter(Boolean)
      if (bookingRefs.length === 0) continue

      // Check for awaiting_decision claims
      const { data: awaitingClaims, error: awaitingErr } = await supabase
        .from('registered_flights')
        .select('booking_ref')
        .in('booking_ref', bookingRefs)
        .eq('status', 'confirmed')
        .eq('claim_status', 'awaiting_decision')
        .limit(1)

      if (awaitingErr) throw awaitingErr
      if (!awaitingClaims || awaitingClaims.length === 0) continue

      // 4. Insert auto-accept decision
      const now = new Date().toISOString()
      const { error: insertErr } = await supabase
        .from('flight_claim_decisions')
        .insert({
          flight_id: flightId,
          decision: 'auto_accepted',
          auto_accepted_at: now,
          decided_at: now,
        })

      if (insertErr) throw insertErr

      // 5. Update all awaiting claims to auto_accepted
      const { error: updateErr } = await supabase
        .from('registered_flights')
        .update({ claim_status: 'auto_accepted' })
        .in('booking_ref', bookingRefs)
        .eq('status', 'confirmed')
        .eq('claim_status', 'awaiting_decision')

      if (updateErr) throw updateErr

      autoAcceptedFlights.push(flightId)
    }

    return res.status(200).json({
      ok: true,
      autoAcceptedFlights,
      count: autoAcceptedFlights.length,
    })
  } catch (err) {
    console.error('POST /api/cron/auto-accept error:', err)
    return res.status(500).json({ ok: false, error: err.message || 'Server error' })
  }
}
