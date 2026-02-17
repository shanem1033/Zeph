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
    <>
      <nav className="nav">
        <Link href="/airline/dashboard" className="nav-brand">
          Zeph
        </Link>
        <div className="nav-links">
          <Link href="/airline/dashboard" className={`nav-link ${router.pathname === '/airline/dashboard' ? 'active' : ''}`}>
            Dashboard
          </Link>
          <Link href="/airline/claims" className={`nav-link ${router.pathname === '/airline/claims' ? 'active' : ''}`}>
            Claims
          </Link>
          <Link href="/airline/flights" className={`nav-link ${router.pathname === '/airline/flights' ? 'active' : ''}`}>
            Flights
          </Link>
          <Link href="/airline/profile" className={`nav-link ${router.pathname === '/airline/profile' ? 'active' : ''}`}>
            Profile
          </Link>
        </div>
        <div className="nav-user">
          <span className="nav-username">Welcome, {user.email?.split('@')[0]}</span>
          <button onClick={logout} className="nav-logout">Logout</button>
        </div>
      </nav>
      <main>{children}</main>
    </>
  )
}
