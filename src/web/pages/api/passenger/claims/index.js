import { getSupabaseAdmin } from '../../../../utils/supabaseServer'

function isUuid(value) {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
}

function isMissingTableError(error, tableName) {
  const message = String(error?.message || error?.details || '').toLowerCase()
  if (!message) return false
  return (
    message.includes(`could not find the table 'public.${String(tableName).toLowerCase()}'`) ||
    message.includes(`relation "public.${String(tableName).toLowerCase()}" does not exist`) ||
    message.includes(`relation "${String(tableName).toLowerCase()}" does not exist`)
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
      .select('booking_ref, status, claim_status, confirmed_at, bookings!inner(flight_id)')
      .in('booking_ref', allowedRefs)
      .eq('status', 'confirmed')
      .limit(500)

    if (error) throw error

    const flightIds = [
      ...new Set(
        (Array.isArray(rows) ? rows : [])
          .map((r) => r?.bookings?.flight_id)
          .filter(Boolean)
      ),
    ]

    let flightMap = {}
    if (flightIds.length > 0) {
      const { data: flights, error: flightsError } = await supabase
        .from('flights')
        .select(
          'flight_id, flight_code, origin, destination, scheduled_departure_at, scheduled_arrival_at, actual_arrival_at, delay_minutes'
        )
        .in('flight_id', flightIds)

      if (flightsError) throw flightsError

      flightMap = Object.fromEntries(
        (Array.isArray(flights) ? flights : []).map((flight) => [flight.flight_id, flight])
      )
    }

    let paymentMap = {}
    if (allowedRefs.length > 0) {
      const { data: payments, error: paymentsError } = await supabase
        .from('claim_payments')
        .select('booking_ref, amount_eur, source_status, credited_at')
        .in('booking_ref', allowedRefs)

      if (paymentsError && !isMissingTableError(paymentsError, 'claim_payments')) throw paymentsError

      if (!isMissingTableError(paymentsError, 'claim_payments')) {
        paymentMap = Object.fromEntries(
          (Array.isArray(payments) ? payments : []).map((payment) => [payment.booking_ref, payment])
        )
      }
    }

    // For rejected claims, look up the rejection report path so passengers
    // can download the airline's PDF explanation.
    const rejectedFlightIds = [
      ...new Set(
        (Array.isArray(rows) ? rows : [])
          .filter((r) => r.claim_status === 'rejected')
          .map((r) => r?.bookings?.flight_id)
          .filter(Boolean)
      ),
    ]

    let decisionMap = {}
    if (rejectedFlightIds.length > 0) {
      const { data: decisions, error: decisionsError } = await supabase
        .from('flight_claim_decisions')
        .select('flight_id, rejection_report_path, evidence')
        .in('flight_id', rejectedFlightIds)

      if (!decisionsError && Array.isArray(decisions)) {
        for (const d of decisions) {
          // Build a public URL for the report if a path exists
          let reportUrl = null
          if (d.rejection_report_path) {
            const { data: urlData } = supabase.storage
              .from('rejection-reports')
              .getPublicUrl(d.rejection_report_path)
            reportUrl = urlData?.publicUrl || null
          }
          decisionMap[d.flight_id] = {
            rejectionReportPath: d.rejection_report_path || null,
            rejectionReportUrl: reportUrl,
            rejectionReason: d.evidence?.description || null,
          }
        }
      }
    }

    const claims = (Array.isArray(rows) ? rows : []).map((r) => {
      const flightId = r?.bookings?.flight_id || null
      const decision = flightId ? decisionMap[flightId] : null
      const flight = flightId ? flightMap[flightId] : null
      const payment = paymentMap[r.booking_ref] || null
      const fallbackPaid = !payment && ['accepted', 'auto_accepted'].includes(r.claim_status)
      return {
        bookingRef: r.booking_ref,
        flightId,
        flightCode: flight?.flight_code || null,
        origin: flight?.origin || null,
        destination: flight?.destination || null,
        scheduledDeparture: flight?.scheduled_departure_at || null,
        scheduledArrival: flight?.scheduled_arrival_at || null,
        actualArrival: flight?.actual_arrival_at || null,
        delayMinutes: flight?.delay_minutes ?? null,
        claimStatus: r.claim_status || 'registered',
        isPaid: !!payment || fallbackPaid,
        paymentAmountEur: payment?.amount_eur ?? (fallbackPaid ? 300 : null),
        paymentCreditedAt: payment?.credited_at || null,
        paymentSourceStatus: payment?.source_status || (fallbackPaid ? r.claim_status : null),
        rejectionReportUrl: decision?.rejectionReportUrl || null,
        rejectionReason: decision?.rejectionReason || null,
      }
    })

    return res.status(200).json({ ok: true, claims })
  } catch (err) {
    console.error('POST /api/passenger/claims error:', err)
    return res.status(500).json({ ok: false, error: err.message || 'Server error' })
  }
}
