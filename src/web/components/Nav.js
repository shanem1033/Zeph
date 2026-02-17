import Link from 'next/link'
import { useAuth } from '../context/AuthContext'

export default function Nav() {
  const { user, isAuthenticated, logout } = useAuth()

  // Display the part before @ from the email, or fallback
  const displayName = user?.email ? user.email.split('@')[0] : ''

  return (
    <nav className="nav">
      <Link href="/">Home</Link>
      {!isAuthenticated && <Link href="/login">Login</Link>}
      {!isAuthenticated && <Link href="/create-account">Create Account</Link>}
      {isAuthenticated && <span>Welcome, {displayName}</span>}
      {isAuthenticated && <a onClick={logout} style={{ marginLeft: 12, cursor: 'pointer' }}>Logout</a>}
    </nav>
  )
}
