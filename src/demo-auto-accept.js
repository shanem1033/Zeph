import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function run() {
  console.log('1. Finding the previously auto-accepted flight...')
  const { data: decisions, error } = await supabase
    .from('flight_claim_decisions')
    .select('flight_id, decision')
    .eq('decision', 'auto_accepted')
    .limit(1)

  if (error || !decisions || decisions.length === 0) {
    console.log('❌ Could not find a flight that was auto_accepted. Make sure you ran the cron job earlier.')
    return
  }

  const flightId = decisions[0].flight_id
  console.log(`Found auto-accepted flight: ${flightId}`)

  console.log('\n2. Reverting decision and moving flight back to awaiting_decision...')
  
  // A. Delete the decision
  await supabase
    .from('flight_claim_decisions')
    .delete()
    .eq('flight_id', flightId)

  // B. Reset the passenger claims back to awaiting_decision
  // First, find all bookings for this flight
  const { data: bookings } = await supabase
    .from('bookings')
    .select('booking_ref')
    .eq('flight_id', flightId)
    
  if (bookings && bookings.length > 0) {
    const bookingRefs = bookings.map(b => b.booking_ref)
    await supabase
      .from('registered_flights')
      .update({ claim_status: 'awaiting_decision' })
      .in('booking_ref', bookingRefs)
      // Note: We're purposefully keeping the flight itself "aged" > 7 days
      // so you can immediately run the cron job again.
  }

  console.log(`✅ Flight ${flightId} is now reset and waiting for the cron job again.`)
  console.log('\n3. Run your curl command one more time!')
}

run()
