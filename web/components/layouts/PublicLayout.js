import Link from 'next/link'

export default function PublicLayout({ children }) {
  return (
    <div className="container">
      <nav className="nav">
        <Link href="/">Home</Link>
        <Link href="/login">Login</Link>
        <Link href="/create-account">Create Account</Link>
      </nav>
      <main>{children}</main>
    </div>
  )
}
