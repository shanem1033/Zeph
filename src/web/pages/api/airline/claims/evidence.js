import { getSupabaseAdmin } from '../../../../utils/supabaseServer'
import { getAirlineCodeFromEmail, flightCodeMatchesAirlineCode } from '../../../../utils/auth'
import { isUuid, generateEvidenceZip } from '../../../../utils/evidenceReport'

async function getAuthenticatedAirlineCode(supabase, req) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization
  if (!authHeader || typeof authHeader !== 'string' || !authHeader.toLowerCase().startsWith('bearer ')) {
    throw new Error('Missing Authorization header')
  }

  const token = authHeader.split(' ')[1]
  const { data: userData, error: userErr } = await supabase.auth.getUser(token)
  if (userErr || !userData?.user?.email) {
    throw new Error('Invalid token')
  }

  const airlineCode = getAirlineCodeFromEmail(userData.user.email)
  if (!airlineCode) {
    throw new Error('Not an airline account')
  }

  return airlineCode
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

  const bookingRef = body?.bookingRef
  if (!isUuid(bookingRef)) {
    return res.status(400).json({ ok: false, error: 'Invalid bookingRef' })
  }

  try {
    const supabase = getSupabaseAdmin()

    let airlineCode
    try {
      airlineCode = await getAuthenticatedAirlineCode(supabase, req)
    } catch (authErr) {
      return res.status(401).json({ ok: false, error: authErr.message })
    }

    // Verify the booking's flight belongs to this airline
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .select('booking_ref, flight_id')
      .eq('booking_ref', bookingRef)
      .single()

    if (bookingError || !booking) {
      return res.status(404).json({ ok: false, error: 'Booking not found' })
    }

    const { data: flight, error: flightError } = await supabase
      .from('flights')
      .select('flight_code')
      .eq('flight_id', booking.flight_id)
      .single()

    if (flightError || !flight) {
      return res.status(404).json({ ok: false, error: 'Flight not found' })
    }

    if (!flightCodeMatchesAirlineCode(flight.flight_code, airlineCode)) {
      return res.status(403).json({ ok: false, error: 'This booking is not for a flight operated by your airline' })
    }

    const { zipBuffer, safeBookingRef } = await generateEvidenceZip(supabase, bookingRef)

    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="claim-evidence-${safeBookingRef}.zip"`)
    return res.status(200).send(zipBuffer)
  } catch (err) {
    if (err.status === 404) {
      return res.status(404).json({ ok: false, error: err.message })
    }
    console.error('POST /api/airline/claims/evidence error:', err)
    return res.status(500).json({ ok: false, error: err.message || 'Server error' })
  }
}
