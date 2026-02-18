import { getSupabaseAdmin } from '../../../../utils/supabaseServer'

function isUuid(value) {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
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

  const rawRefs = Array.isArray(body?.bookingRefs) ? body.bookingRefs : []
  const bookingRefs = Array.from(new Set(rawRefs.filter(isUuid))).slice(0, 100)

  if (bookingRefs.length === 0) {
    return res.status(200).json({ ok: true, claims: [] })
  }

  try {
    const supabase = getSupabaseAdmin()

    const { data: rows, error } = await supabase
      .from('registered_flights')
      .select('booking_ref, claim_status, bookings!inner(flight_id)')
      .in('booking_ref', bookingRefs)
      .limit(500)

    if (error) throw error

    const claims = (Array.isArray(rows) ? rows : []).map((r) => ({
      bookingRef: r.booking_ref,
      flightId: r?.bookings?.flight_id || null,
      claimStatus: r.claim_status || 'registered',
    }))

    return res.status(200).json({ ok: true, claims })
  } catch (err) {
    console.error('POST /api/passenger/claims error:', err)
    return res.status(500).json({ ok: false, error: err.message || 'Server error' })
  }
}
