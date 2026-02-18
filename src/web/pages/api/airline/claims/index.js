import { getSupabaseAdmin } from '../../../../utils/supabaseServer'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  try {
    const supabase = getSupabaseAdmin()

    // Find all registered_flights currently awaiting decision, and map to unique flightIds.
    const { data: rows, error } = await supabase
      .from('registered_flights')
      .select('booking_ref, bookings!inner(flight_id)')
      .eq('claim_status', 'awaiting_decision')
      .eq('status', 'confirmed')
      .limit(500)

    if (error) throw error

    const flightIds = Array.from(
      new Set(
        (Array.isArray(rows) ? rows : [])
          .map((r) => r?.bookings?.flight_id)
          .filter(Boolean)
      )
    )

    if (flightIds.length === 0) {
      return res.status(200).json({ ok: true, flights: [] })
    }

    const [{ data: flights, error: flightsError }, { data: decisions, error: decisionsError }] =
      await Promise.all([
        supabase
          .from('flights')
          .select(
            'flight_id,flight_code,origin,destination,scheduled_departure_at,scheduled_arrival_at,actual_arrival_at,delay_minutes,oracle_processed_at,oracle_tx_hash'
          )
          .in('flight_id', flightIds)
          .order('scheduled_departure_at', { ascending: false }),
        supabase
          .from('flight_claim_decisions')
          .select('flight_id,decision,evidence_hash,decided_at,tx_hash')
          .in('flight_id', flightIds),
      ])

    if (flightsError) throw flightsError
    if (decisionsError) throw decisionsError

    const decisionByFlightId = new Map(
      (Array.isArray(decisions) ? decisions : []).map((d) => [d.flight_id, d])
    )

    const result = (Array.isArray(flights) ? flights : []).map((f) => ({
      ...f,
      decision: decisionByFlightId.get(f.flight_id) || null,
    }))

    return res.status(200).json({ ok: true, flights: result })
  } catch (err) {
    console.error('GET /api/airline/claims error:', err)
    return res.status(500).json({ ok: false, error: err.message || 'Server error' })
  }
}
