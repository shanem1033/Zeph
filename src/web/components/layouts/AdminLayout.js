import { useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { useAuth } from '../../context/AuthContext'

export default function AdminLayout({ children }) {
    const { user, loading, logout, isAdmin } = useAuth()
    const router = useRouter()

    useEffect(() => {
        if (!loading && !user) {
            router.push('/login')
        } else if (!loading && user && !isAdmin) {
            router.push('/login')
        }
    }, [user, loading, isAdmin, router])

    if (loading || !user || !isAdmin) {
        return <div className="container">Loading...</div>
    }

    return (
        <>
            <nav className="nav admin-nav">
                <Link href="/admin" className="nav-brand admin-brand">
                    Zeph <span className="admin-badge">Admin</span>
                </Link>
                <div className="nav-links">
                    <Link href="/admin" className={`nav-link ${router.pathname === '/admin' ? 'active' : ''}`}>
                        Flight Control
                    </Link>
                </div>
                <div className="nav-user">
                    <span className="nav-username">{user.email?.split('@')[0]}</span>
                    <button onClick={logout} className="nav-logout">Logout</button>
                </div>
            </nav>
            <main>{children}</main>

            <style jsx>{`
        .admin-nav {
          background: #1a1a2e;
          border-bottom: 2px solid #e94560;
        }
        .admin-brand {
          color: #fff !important;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        .admin-badge {
          background: #e94560;
          color: #fff;
          font-size: 0.65rem;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 999px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
      `}</style>
        </>
    )
}
