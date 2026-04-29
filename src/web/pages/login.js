import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import PublicLayout from '../components/layouts/PublicLayout'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import Alert from '../components/ui/Alert'
import { supabase } from '../utils/supabaseClient'
import { getRoleFromEmail, isAdminEmail } from '../utils/auth'

const AIRLINE_HOME_ROUTE = '/airline/claims'
const PASSENGER_HOME_ROUTE = '/passenger/register-flight'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const submit = async (e) => {
    e.preventDefault()
    setError('')

    if (!email || !password) {
      setError('Please fill in all fields')
      return
    }

    setLoading(true)

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }

    // Redirect based on role — auto-detected from email
    if (isAdminEmail(email)) {
      router.push('/admin')
    } else if (getRoleFromEmail(email) === 'airline') {
      router.push(AIRLINE_HOME_ROUTE)
    } else {
      router.push(PASSENGER_HOME_ROUTE)
    }
  }

  return (
    <PublicLayout>
      <div className="auth-container">
        <div className="auth-form-wrapper">
          <h1>Log In</h1>
          {error && <Alert type="error" message={error} onClose={() => setError('')} />}

          <form onSubmit={submit} className="form">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />

            <Button type="submit" variant="primary" disabled={loading} style={{ marginTop: '16px', width: '100%' }}>
              {loading ? 'Logging in...' : 'Log In'}
            </Button>
          </form>

          <p className="auth-footer">
            Don't have an account? <Link href="/create-account">Create one here</Link>
          </p>
        </div>
      </div>
    </PublicLayout>
  )
}
