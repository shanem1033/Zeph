import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useAuth } from '../../context/AuthContext'

export default function AirlineLayout({ children }) {
  const { user, loading, logout, isAirline } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    } else if (!loading && user && !isAirline) {
      // Redirect if logged in but not an airline
      router.push(user.role === 'passenger' ? '/passenger/dashboard' : '/login')
    }
  }, [user, loading, isAirline, router])

  if (loading || !user || !isAirline) {
    return <div className="container">Loading...</div>
  }

  return (
    <div className="container">
      <nav className="nav">
        <Link href="/airline/dashboard">Dashboard</Link>
        <Link href="/airline/claims">Claims</Link>
        <Link href="/airline/flights">Flights</Link>
        <Link href="/airline/profile">Profile</Link>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span>Welcome, {user.username}</span>
          <a onClick={logout} style={{ cursor: 'pointer' }}>Logout</a>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  )
}
