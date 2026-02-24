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

  try {
    const supabase = getSupabaseAdmin()

    // Require an Authorization header with a Supabase access token. This
    // endpoint returns only claims belonging to the authenticated user.
    const authHeader = req.headers?.authorization || req.headers?.Authorization
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.toLowerCase().startsWith('bearer ')) {
      return res.status(401).json({ ok: false, error: 'Missing Authorization header' })
    }

    const token = authHeader.split(' ')[1]

    // Attempt to resolve the user from the token. Some test mocks may not
    // implement auth.getUser; handle that gracefully.
    let userEmail = null
    try {
      if (supabase.auth && typeof supabase.auth.getUser === 'function') {
        const { data: userData, error: userErr } = await supabase.auth.getUser(token)
        if (userErr || !userData?.user) {
          return res.status(401).json({ ok: false, error: 'Invalid token' })
        }
        userEmail = userData.user.email
      } else {
        // If the auth helper isn't available, reject the request to be safe.
        return res.status(401).json({ ok: false, error: 'Auth unavailable' })
      }
    } catch (e) {
      return res.status(401).json({ ok: false, error: 'Invalid token' })
    }

    // Determine which booking refs to fetch claims for. If the client
    // supplied explicit bookingRefs we'll restrict to those that belong to
    // the authenticated user. If the client supplied none, return all
    // booking refs belonging to this user so the UI shows registrations
    // made on other devices as well.
    let bookingsRows
    if (bookingRefs.length === 0) {
      const { data: allBookings, error: allBookingsErr } = await supabase
        .from('bookings')
        .select('booking_ref, flight_id')
        .eq('passenger_email', userEmail)

      if (allBookingsErr) throw allBookingsErr
      bookingsRows = allBookings || []
    } else {
      const { data: ownedBookings, error: bookingsErr } = await supabase
        .from('bookings')
        .select('booking_ref, flight_id, passenger_email')
        .in('booking_ref', bookingRefs)
        .eq('passenger_email', userEmail)

      if (bookingsErr) throw bookingsErr
      bookingsRows = ownedBookings || []
    }

    const allowedRefs = (Array.isArray(bookingsRows) ? bookingsRows.map((b) => b.booking_ref) : [])

    if (allowedRefs.length === 0) {
      return res.status(200).json({ ok: true, claims: [] })
    }

    const { data: rows, error } = await supabase
      .from('registered_flights')
      .select('booking_ref, claim_status, bookings!inner(flight_id)')
      .in('booking_ref', allowedRefs)
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
