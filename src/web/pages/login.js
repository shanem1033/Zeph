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
  const [role, setRole] = useState('passenger')
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

    // Verify the email domain matches the selected role
    const detectedRole = getRoleFromEmail(email)
    if (role === 'airline' && detectedRole !== 'airline') {
      await supabase.auth.signOut()
      setError('Airline login requires an airline email address (e.g. @ryanair.com)')
      setLoading(false)
      return
    }
    if (role === 'passenger' && detectedRole === 'airline') {
      await supabase.auth.signOut()
      setError('This is an airline account. Please select "Airline" to log in.')
      setLoading(false)
      return
    }

    // Redirect based on role — admin takes priority
    if (isAdminEmail(email)) {
      router.push('/admin')
    } else if (role === 'airline') {
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

            <div style={{ marginTop: '8px' }}>
              <label style={{ fontWeight: '500', color: 'var(--text-secondary)' }}>Login as:</label>
              <div style={{ display: 'flex', gap: '16px', marginTop: '8px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                  <input
                    type="radio"
                    name="role"
                    value="passenger"
                    checked={role === 'passenger'}
                    onChange={(e) => setRole(e.target.value)}
                  />
                  Passenger
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-secondary)' }}>
                  <input
                    type="radio"
                    name="role"
                    value="airline"
                    checked={role === 'airline'}
                    onChange={(e) => setRole(e.target.value)}
                  />
                  Airline
                </label>
              </div>
            </div>

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
