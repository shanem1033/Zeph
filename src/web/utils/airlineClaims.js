import { flightCodeMatchesAirlineCode } from './auth'

export async function fetchAirlineClaimFlights(supabase, airlineCode) {
  const query = supabase
    .from('flights')
    .select('*')
    .gte('delay_minutes', 180)
    .not('actual_arrival_at', 'is', null)
    .order('actual_arrival_at', { ascending: false })

  const { data: flights, error: flightsErr } = await query
  if (flightsErr) throw flightsErr

  const filteredFlights = Array.isArray(flights)
    ? flights.filter((flight) => !airlineCode || flightCodeMatchesAirlineCode(flight.flight_code, airlineCode))
    : []

  if (filteredFlights.length === 0) {
    return []
  }

  const flightIds = filteredFlights.map((flight) => flight.flight_id).filter(Boolean)

  const [{ data: bookings, error: bookingsErr }, { data: decisions, error: decisionsErr }] = await Promise.all([
    supabase
      .from('bookings')
      .select('booking_ref, flight_id, passenger_name, passenger_email, passport_number')
      .in('flight_id', flightIds),
    supabase
      .from('flight_claim_decisions')
      .select('flight_id, decision, evidence_hash, decided_at, auto_accepted_at, tx_hash')
      .in('flight_id', flightIds),
  ])

  if (bookingsErr) throw bookingsErr
  if (decisionsErr) throw decisionsErr

  const bookingRows = Array.isArray(bookings) ? bookings : []
  const bookingRefs = bookingRows.map((booking) => booking.booking_ref).filter(Boolean)

  let registrations = []
  if (bookingRefs.length > 0) {
    const { data: regs, error: regsErr } = await supabase
      .from('registered_flights')
      .select('booking_ref, status, claim_status, registered_by_wallet, tx_hash, confirmed_at')
      .in('booking_ref', bookingRefs)

    if (regsErr) throw regsErr
    registrations = Array.isArray(regs) ? regs : []
  }

  const regMap = Object.fromEntries(registrations.map((registration) => [registration.booking_ref, registration]))
  const decisionMap = Object.fromEntries((Array.isArray(decisions) ? decisions : []).map((decision) => [decision.flight_id, decision]))
  const bookingsByFlight = {}

  for (const booking of bookingRows) {
    if (!bookingsByFlight[booking.flight_id]) bookingsByFlight[booking.flight_id] = []
    bookingsByFlight[booking.flight_id].push({
      ...booking,
      registration: regMap[booking.booking_ref] || null,
    })
  }

  return filteredFlights.map((flight) => ({
    flight_id: flight.flight_id,
    flight_code: flight.flight_code,
    origin: flight.origin,
    destination: flight.destination,
    scheduled_departure: flight.scheduled_departure_at,
    scheduled_arrival: flight.scheduled_arrival_at,
    actual_arrival: flight.actual_arrival_at,
    delay_minutes: flight.delay_minutes,
    decision: decisionMap[flight.flight_id] || null,
    passengers: bookingsByFlight[flight.flight_id] || [],
  }))
}
