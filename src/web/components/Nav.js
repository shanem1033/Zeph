import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'

export default function Nav(){
  const [user, setUser] = useState(null)
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const u = JSON.parse(localStorage.getItem('user') || 'null')
      setUser(u)
    } catch {
      setUser(null)
    }
  }, [])

  const logout = () => {
    if (typeof window !== 'undefined') localStorage.removeItem('user')
    router.push('/login')
  }

  return (
    <nav className="nav">
      <Link href="/">Home</Link>
      {!user && <Link href="/login">Login</Link>}
      {!user && <Link href="/create-user">Create User</Link>}
      {user && <span>Welcome {user.username}</span>}
      {user && <a onClick={logout} style={{marginLeft:12,cursor:'pointer'}}>Logout</a>}
    </nav>
  )
}
