import { getSupabaseAdmin } from '../../../utils/supabaseServer'

function badRequest(res, message) {
  return res.status(400).json({ ok: false, error: message })
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

  const supabase = getSupabaseAdmin()

  // Look up the flight to get scheduled arrival time
  const { data: flight, error: flightError } = await supabase
    .from('flights')
    .select('flight_id, scheduled_arrival_at, actual_arrival_at')
    .eq('flight_id', flightId)
    .single()

  if (flightError || !flight) {
    return res.status(404).json({ ok: false, error: `Flight not found: ${flightId}` })
  }

  // Check if landing already recorded
  if (flight.actual_arrival_at) {
    return res.status(409).json({ 
      ok: false, 
      error: 'Landing already recorded for this flight' 
    })
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

  return res.status(200).json({
    ok: true,
    flightId,
    scheduledArrival: scheduledArrival.toISOString(),
    actualArrival: actualArrival.toISOString(),
    delayMinutes,
    delayed: isDelayed,
  })
}
