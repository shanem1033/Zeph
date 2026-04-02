import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function checkColumn() {
  console.log('Checking database for auto_accepted_at column...')
  // We'll intentionally try to insert a dummy record and look at the exact error
  const { data, error } = await supabase
    .from('flight_claim_decisions')
    .insert([{ flight_id: 'nonexistent-flight', decision: 'auto_accepted', auto_accepted_at: new Date().toISOString() }])
    
  if (error) {
    console.error('Supabase returned error:', error.message)
    console.error('Error details:', error.details || error.hint || error)
  } else {
    console.log('Column exists! Insert succeeded (or failed for another reason)')
  }
}

checkColumn()
