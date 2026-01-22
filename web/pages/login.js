import { useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import PublicLayout from '../components/layouts/PublicLayout'
import { useAuth } from '../context/AuthContext'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import Alert from '../components/ui/Alert'

export default function Login(){
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('passenger')
  const [error, setError] = useState('')
  const router = useRouter()
  const { login } = useAuth()

  const submit = (e) => {
    e.preventDefault()
    setError('')

    // Basic validation
    if (!username || !password) {
      setError('Please fill in all fields')
      return
    }

    // Demo authentication - replace with actual auth later
    if (username === 'airline' && password === 'airline' && role === 'airline') {
      login('airline', 'airline', 'airline')
      router.push('/airline/dashboard')
      return
    }
    if (username === 'passenger' && password === 'passenger' && role === 'passenger') {
      login('passenger', 'passenger', 'passenger')
      router.push('/passenger/dashboard')
      return
    }
    
    setError('Invalid credentials. Demo accounts: airline/airline or passenger/passenger')
  }

  return (
    <PublicLayout>
      <div className="auth-container">
        <div className="auth-form-wrapper">
          <h1>Log In</h1>
          {error && <Alert type="error" message={error} onClose={() => setError('')} />}
          
          <form onSubmit={submit} className="form">
            <Input
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
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

            <Button type="submit" variant="primary" style={{ marginTop: '16px', width: '100%' }}>
              Log In
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
