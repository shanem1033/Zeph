import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useAuth } from '../../context/AuthContext'

export default function PassengerLayout({ children }) {
  const { user, loading, logout, isPassenger } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    } else if (!loading && user && !isPassenger) {
      // Redirect if logged in but not a passenger
      router.push(user.role === 'airline' ? '/airline/dashboard' : '/login')
    }
  }, [user, loading, isPassenger, router])

  if (loading || !user || !isPassenger) {
    return <div className="container">Loading...</div>
  }

  return (
    <div className="container">
      <nav className="nav">
        <Link href="/passenger/dashboard">Dashboard</Link>
        <Link href="/passenger/register-flight">Register Flight</Link>
        <Link href="/passenger/my-claims">My Claims</Link>
        <Link href="/passenger/profile">Profile</Link>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span>Welcome, {user.username}</span>
          <a onClick={logout} style={{ cursor: 'pointer' }}>Logout</a>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}
