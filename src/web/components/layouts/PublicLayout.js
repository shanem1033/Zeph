import Link from 'next/link'
import { useRouter } from 'next/router'

export default function PublicLayout({ children }) {
  const router = useRouter()
  
  return (
    <>
      <nav className="nav">
        <Link href="/" className="nav-brand">
          Zeph
        </Link>
        <div className="nav-links">
          <Link href="/" className="nav-link">
            Home
          </Link>
        </div>
        <div className="nav-user">
          <Link href="/login" className="nav-link">
            Log In
          </Link>
          <Link href="/create-account">
            <button className="btn btn-primary btn-sm">Create Account</button>
          </Link>
        </div>
      </nav>
      <main>{children}</main>
    </>
  )
}
