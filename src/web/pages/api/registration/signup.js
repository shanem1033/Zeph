import { getSupabaseAdmin } from '../../../utils/supabaseServer'

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

  const { email, password, name, role } = body || {}

  if (!email || !password || !name || !role) {
    return res.status(400).json({ ok: false, error: 'email, password, name, and role are required' })
  }
  if (password.length < 6) {
    return res.status(400).json({ ok: false, error: 'Password must be at least 6 characters' })
  }
  if (!['passenger', 'airline'].includes(role)) {
    return res.status(400).json({ ok: false, error: 'role must be "passenger" or "airline"' })
  }

  const supabase = getSupabaseAdmin()

  // Use admin API to create a pre-confirmed user (bypasses email rate limits)
  const { data, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,          // auto-confirm, no verification email sent
    user_metadata: { name, role },
  })

  if (createError) {
    console.error('[signup] createUser error:', createError.message)
    const status = createError.message.includes('already been registered') ? 409 : 500
    return res.status(status).json({ ok: false, error: createError.message })
  }

  return res.status(201).json({ ok: true, userId: data.user.id })
}
