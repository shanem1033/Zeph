import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import PublicLayout from '../components/layouts/PublicLayout'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import Alert from '../components/ui/Alert'
import { getRoleFromEmail } from '../utils/auth'

export default function CreateAccount() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    // Validate inputs
    if (!name || !email || !password || !confirmPassword) {
      setError('All fields are required')
      return
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)

    const role = getRoleFromEmail(email)

    // Use server-side admin API to create pre-confirmed user (bypasses email rate limits)
    try {
      const resp = await fetch('/api/registration/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, name, role }),
      })
      const json = await resp.json()

      if (!resp.ok) {
        setError(json.error || 'Sign-up failed')
        setLoading(false)
        return
      }
    } catch (err) {
      setError(err.message || 'Network error')
      setLoading(false)
      return
    }

    setSuccess(true)
    setLoading(false)
  }

  return (
    <PublicLayout>
      <div className="auth-container">
        <div className="auth-form-wrapper">
          <h1>Create Account</h1>
          {error && <Alert type="error" message={error} onClose={() => setError('')} />}
          {success && (
            <Alert type="success" message="Account created successfully! You can now log in." />
          )}

          {!success && (
            <form onSubmit={submit} className="form">
              <Input
                label="Name"
                type="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                required
              />
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
                placeholder="Choose a password (min 6 characters)"
                required
              />
              <Input
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                required
              />

              <Button type="submit" variant="primary" disabled={loading} style={{ marginTop: '16px', width: '100%' }}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </Button>
            </form>
          )}

          <p className="auth-footer">
            Already have an account? <Link href="/login">Log in here</Link>
          </p>
        </div>
      </div>
    </PublicLayout>
  )
}
