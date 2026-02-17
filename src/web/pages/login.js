import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import PublicLayout from '../components/layouts/PublicLayout'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import Alert from '../components/ui/Alert'
import { supabase } from '../utils/supabaseClient'
import { validateLoginRole } from '../utils/auth'

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

    // Verify the selected role matches the role the user signed up with
    const registeredRole = data.user?.user_metadata?.role
    const roleCheck = validateLoginRole(role, registeredRole)
    if (!roleCheck.valid) {
      await supabase.auth.signOut()
      setError(roleCheck.error)
      setLoading(false)
      return
    }

    // Redirect based on role
    if (role === 'airline') {
      router.push('/airline/dashboard')
    } else {
      router.push('/passenger/dashboard')
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
              <label style={{ fontWeight: '500', color: 'var(--text-secondary)' }}>User Type:</label>
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
