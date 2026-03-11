import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useAuth } from '../../context/AuthContext'

const PASSENGER_HOME_ROUTE = '/passenger/register-flight'

export default function PassengerLayout({ children }) {
  const { user, loading, logout, isPassenger } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    } else if (!loading && user && !isPassenger) {
      // Redirect if logged in but not a passenger
      router.push(user.role === 'airline' ? '/airline/claims' : '/login')
    }
  }, [user, loading, isPassenger, router])

  if (loading || !user || !isPassenger) {
    return <div className="container">Loading...</div>
  }

  return (
    <>
      <nav className="nav">
        <Link href={PASSENGER_HOME_ROUTE} className="nav-brand">
          Zeph
        </Link>
        <div className="nav-links">
          <Link href="/passenger/register-flight" className={`nav-link ${router.pathname === '/passenger/register-flight' ? 'active' : ''}`}>
            Register Flight
          </Link>
          <Link href="/passenger/my-claims" className={`nav-link ${router.pathname === '/passenger/my-claims' ? 'active' : ''}`}>
            My Claims
          </Link>
          <Link href="/passenger/profile" className={`nav-link ${router.pathname === '/passenger/profile' ? 'active' : ''}`}>
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
