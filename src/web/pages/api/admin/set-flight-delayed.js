import { getSupabaseAdmin } from '../../../utils/supabaseServer'
import { badRequest } from '../../../utils/apiHelpers'

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST'])
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  if (req.headers['x-admin-secret'] !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ ok: false, error: 'Forbidden' })
  }

  const supabase = getSupabaseAdmin()

  /* ── GET: return all flights that haven't landed yet ── */
  if (req.method === 'GET') {
    const { data: flights, error } = await supabase
      .from('flights')
      .select('flight_id, flight_code, origin, destination, scheduled_departure_at, scheduled_arrival_at')
      .is('actual_arrival_at', null)
      .order('scheduled_departure_at', { ascending: true })

    if (error) return res.status(500).json({ ok: false, error: error.message })
    return res.status(200).json({ ok: true, flights: flights || [] })
  }

  /* ── POST: mark a flight as delayed ── */
  let body
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
  } catch {
    return badRequest(res, 'Invalid JSON body')
  }

  const { flightId, actualArrivalAt } = body || {}

  if (!flightId) return badRequest(res, 'Missing flightId')
  if (!actualArrivalAt) return badRequest(res, 'Missing actualArrivalAt')

  // Parse the actual arrival time
  const actualArrival = new Date(actualArrivalAt)
  if (Number.isNaN(actualArrival.getTime())) {
    return badRequest(res, 'Invalid actualArrivalAt format')
  }

  // Look up the flight to get scheduled arrival time
  const { data: flight, error: flightError } = await supabase
    .from('flights')
    .select('flight_id, scheduled_arrival_at, actual_arrival_at')
    .eq('flight_id', flightId)
    .single()

  if (flightError || !flight) {
    return res.status(404).json({ ok: false, error: `Flight not found: ${flightId}` })
  }


  // Calculate delay in minutes
  const scheduledArrival = new Date(flight.scheduled_arrival_at)
  const delayMs = actualArrival.getTime() - scheduledArrival.getTime()
  const delayMinutes = Math.round(delayMs / (1000 * 60))

  // Update the flight with actual arrival and delay
  const { error: updateError } = await supabase
    .from('flights')
    .update({
      actual_arrival_at: actualArrival.toISOString(),
      delay_minutes: delayMinutes,
    })
    .eq('flight_id', flightId)

  if (updateError) {
    return res.status(500).json({ ok: false, error: updateError.message })
  }

  // Note: this is just informational - the smart contract is the actual authority
  // on whether a flight qualifies for compensation (when the oracle reports to it)
  const isDelayed = delayMinutes >= 180

  // If the flight is delayed ≥ 180 min, transition all registered claims
  // from 'registered' → 'awaiting_decision' so they show up immediately
  // on the passenger and airline dashboards.
  if (isDelayed) {
    await updateClaimStatuses(supabase, flightId)
  }

  return res.status(200).json({
    ok: true,
    flightId,
    scheduledArrival: scheduledArrival.toISOString(),
    actualArrival: actualArrival.toISOString(),
    delayMinutes,
    delayed: isDelayed,
  })
}

/**
 * Transition all registered claims on a flight to 'awaiting_decision'.
 */
async function updateClaimStatuses(supabase, flightId) {
  const { data: bookings } = await supabase
    .from('bookings')
    .select('booking_ref')
    .eq('flight_id', flightId)

  const bookingRefs = (bookings || []).map((b) => b.booking_ref).filter(Boolean)

  if (bookingRefs.length > 0) {
    await supabase
      .from('registered_flights')
      .update({ claim_status: 'awaiting_decision' })
      .in('booking_ref', bookingRefs)
      .eq('claim_status', 'registered')
  }
}