import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import PublicLayout from '../components/layouts/PublicLayout'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import Alert from '../components/ui/Alert'
import { validateRegistration } from '../utils/auth'

export default function CreateAccount() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const router = useRouter()

  const submit = (e) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    // Validate inputs
    const validation = validateRegistration(username, password, confirmPassword)
    if (!validation.valid) {
      setError(validation.error)
      return
    }

    // TODO: Replace with actual registration logic
    setSuccess(true)
    setTimeout(() => {
      router.push('/login')
    }, 2000)
  }

  return (
    <PublicLayout>
      <div className="auth-container">
        <div className="auth-form-wrapper">
          <h1>Create Account</h1>
          {error && <Alert type="error" message={error} onClose={() => setError('')} />}
          {success && <Alert type="success" message="Account created successfully! Redirecting to login..." />}
          
          <form onSubmit={submit} className="form">
            <Input
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Choose a username (min 3 characters)"
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

            <Button type="submit" variant="primary" style={{ marginTop: '16px', width: '100%' }}>
              Create Account
            </Button>
          </form>

          <p className="auth-footer">
            Already have an account? <Link href="/login">Log in here</Link>
          </p>
        </div>
      </div>
    </PublicLayout>
  )
}
