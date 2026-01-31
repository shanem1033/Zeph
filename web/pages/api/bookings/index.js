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

  // Placeholder: assume 2h duration until we have real schedules
  const arrival = new Date(departure.getTime() + 2 * 60 * 60 * 1000)

  // Deterministic flight id for now (later: airline-provided unique flight number)
  const flightId = `${departureCity}-${arrivalCity}-${departureDate}-${time}`

  const supabase = getSupabaseAdmin()

  const { data, error } = await supabase
    .from('bookings')
    .insert({
      flight_id: flightId,
      passenger_name: null,
      passenger_email: email,
      passport_number: passportNumber,
      scheduled_departure_at: departure.toISOString(),
      scheduled_arrival_at: arrival.toISOString(),
      status: 'booked',
      qr_issued_at: new Date().toISOString(),
      // Extra UI fields are not stored yet; keep them client-side for now
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
    // echo a tiny bit of context (optional)
    meta: { cabinClass, airline, phone },
  })
}
