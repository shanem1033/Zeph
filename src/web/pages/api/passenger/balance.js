import { getSupabaseAdmin } from '../../../utils/supabaseServer'
import { getAirlineCodeFromFlightCode } from '../../../utils/auth'

const COMPENSATION_AMOUNT_EUR = 300

function isMissingTableError(error, tableName) {
  const message = String(error?.message || error?.details || '').toLowerCase()
  if (!message) return false
  return (
    message.includes(`could not find the table 'public.${String(tableName).toLowerCase()}'`) ||
    message.includes(`relation "public.${String(tableName).toLowerCase()}" does not exist`) ||
    message.includes(`relation "${String(tableName).toLowerCase()}" does not exist`)
  )
}

async function buildDerivedPassengerPayments(supabase, userEmail) {
  const { data: bookings, error: bookingsError } = await supabase
    .from('bookings')
    .select('booking_ref, flight_id')
    .eq('passenger_email', userEmail)

  if (bookingsError) throw bookingsError

  const bookingRows = Array.isArray(bookings) ? bookings : []
  const bookingRefs = bookingRows.map((booking) => booking.booking_ref).filter(Boolean)
  if (bookingRefs.length === 0) return []

  const { data: registrations, error: registrationsError } = await supabase
    .from('registered_flights')
    .select('booking_ref, claim_status, confirmed_at')
    .in('booking_ref', bookingRefs)
    .eq('status', 'confirmed')

  if (registrationsError) throw registrationsError

  const paidRegistrations = (Array.isArray(registrations) ? registrations : [])
    .filter((registration) => ['accepted', 'auto_accepted'].includes(registration?.claim_status))

  if (paidRegistrations.length === 0) return []

  const bookingMap = Object.fromEntries(bookingRows.map((booking) => [booking.booking_ref, booking]))
  const flightIds = [...new Set(paidRegistrations.map((registration) => bookingMap[registration.booking_ref]?.flight_id).filter(Boolean))]

  let flightMap = {}
  if (flightIds.length > 0) {
    const { data: flights, error: flightsError } = await supabase
      .from('flights')
      .select('flight_id, flight_code')
      .in('flight_id', flightIds)

    if (flightsError) throw flightsError
    flightMap = Object.fromEntries((Array.isArray(flights) ? flights : []).map((flight) => [flight.flight_id, flight]))
  }

  let decisionMap = {}
  if (flightIds.length > 0) {
    const { data: decisions, error: decisionsError } = await supabase
      .from('flight_claim_decisions')
      .select('flight_id, decided_at, auto_accepted_at')
      .in('flight_id', flightIds)

    if (!decisionsError) {
      decisionMap = Object.fromEntries((Array.isArray(decisions) ? decisions : []).map((decision) => [decision.flight_id, decision]))
    }
  }

  return paidRegistrations
    .map((registration) => {
      const booking = bookingMap[registration.booking_ref]
      const flightId = booking?.flight_id || null
      const flight = flightId ? flightMap[flightId] : null
      const decision = flightId ? decisionMap[flightId] : null
      return {
        booking_ref: registration.booking_ref,
        flight_id: flightId,
        airline_code: getAirlineCodeFromFlightCode(flight?.flight_code),
        amount_eur: COMPENSATION_AMOUNT_EUR,
        source_status: registration.claim_status,
        credited_at:
          registration.claim_status === 'auto_accepted'
            ? (decision?.auto_accepted_at || decision?.decided_at || registration.confirmed_at || null)
            : (decision?.decided_at || registration.confirmed_at || null),
      }
    })
    .sort((a, b) => new Date(b.credited_at || 0).getTime() - new Date(a.credited_at || 0).getTime())
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  try {
    const supabase = getSupabaseAdmin()
    const authHeader = req.headers?.authorization || req.headers?.Authorization
    if (!authHeader || typeof authHeader !== 'string' || !authHeader.toLowerCase().startsWith('bearer ')) {
      return res.status(401).json({ ok: false, error: 'Missing Authorization header' })
    }

    const token = authHeader.split(' ')[1]
    const { data: userData, error: userErr } = await supabase.auth.getUser(token)
    if (userErr || !userData?.user?.email) {
      return res.status(401).json({ ok: false, error: 'Invalid token' })
    }

    const userEmail = userData.user.email

    const { data: paymentsRows, error } = await supabase
      .from('claim_payments')
      .select('booking_ref, flight_id, airline_code, amount_eur, source_status, credited_at')
      .eq('passenger_email', userEmail)
      .order('credited_at', { ascending: false })

    if (error && !isMissingTableError(error, 'claim_payments')) throw error

    const derivedRows = await buildDerivedPassengerPayments(supabase, userEmail)
    const rows = isMissingTableError(error, 'claim_payments')
      ? derivedRows
      : ((Array.isArray(paymentsRows) ? paymentsRows : []).length > 0 ? paymentsRows : derivedRows)
    const balanceEur = rows.reduce((sum, payment) => sum + Number(payment.amount_eur || 0), 0)

    return res.status(200).json({
      ok: true,
      balanceEur,
      creditedClaimsCount: rows.length,
      payments: rows.map((payment) => ({
        bookingRef: payment.booking_ref,
        flightId: payment.flight_id,
        airlineCode: payment.airline_code,
        amountEur: payment.amount_eur,
        sourceStatus: payment.source_status,
        creditedAt: payment.credited_at,
      })),
    })
  } catch (err) {
    console.error('GET /api/passenger/balance error:', err)
    return res.status(500).json({ ok: false, error: err.message || 'Server error' })
  }
}
