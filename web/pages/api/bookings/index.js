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

  const {
    departureCity,
    arrivalCity,
    departureDate,
    departureTime,
    passportNumber,
    email,
    cabinClass,
    airline,
    phone,
  } = body || {}

  if (!departureCity || !arrivalCity) return badRequest(res, 'Missing route')
  if (!departureDate) return badRequest(res, 'Missing departureDate')
  if (!passportNumber) return badRequest(res, 'Missing passportNumber')
  if (!email) return badRequest(res, 'Missing email')

  const time = departureTime || '08:00'
  const departure = new Date(`${departureDate}T${time}`)
  if (Number.isNaN(departure.getTime())) {
    return badRequest(res, 'Invalid departureDate/departureTime')
  }

  const supabase = getSupabaseAdmin()

  // Look up the route to get flight code and duration
  const { data: route, error: routeError } = await supabase
    .from('routes')
    .select('flight_code, duration_minutes')
    .eq('origin', departureCity)
    .eq('destination', arrivalCity)
    .single()

  if (routeError || !route) {
    return badRequest(res, `No route found for ${departureCity} -> ${arrivalCity}`)
  }

  // Calculate arrival time from route duration
  const arrival = new Date(departure.getTime() + route.duration_minutes * 60 * 1000)

  // Generate flight ID: e.g. "BA214-2026-02-15-0800"
  // Includes time to handle multiple flights on the same day
  const timeFormatted = time.replace(':', '')
  const flightId = `${route.flight_code}-${departureDate}-${timeFormatted}`

  // Create the flight record if it doesn't exist yet (first booking for this flight)
  const { error: flightError } = await supabase
    .from('flights')
    .upsert({
      flight_id: flightId,
      flight_code: route.flight_code,
      origin: departureCity,
      destination: arrivalCity,
      scheduled_departure_at: departure.toISOString(),
      scheduled_arrival_at: arrival.toISOString(),
    }, { onConflict: 'flight_id', ignoreDuplicates: true })

  if (flightError) {
    return res.status(500).json({ ok: false, error: `Failed to create flight: ${flightError.message}` })
  }

  // Create the booking
  const { data, error } = await supabase
    .from('bookings')
    .insert({
      flight_id: flightId,
      origin: departureCity,
      destination: arrivalCity,
      passenger_name: null,
      passenger_email: email,
      passport_number: passportNumber,
      scheduled_departure_at: departure.toISOString(),
      scheduled_arrival_at: arrival.toISOString(),
      status: 'booked',
      qr_issued_at: new Date().toISOString(),
    })
    .select('booking_ref, flight_id')
    .single()

  if (error) {
    return res.status(500).json({ ok: false, error: error.message })
  }

  return res.status(200).json({
    ok: true,
    bookingRef: data.booking_ref,
    flightId: data.flight_id,
    meta: { cabinClass, airline, phone },
  })
}
