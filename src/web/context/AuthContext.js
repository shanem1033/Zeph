import { createContext, useContext, useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../utils/supabaseClient'
import { getRoleFromEmail, isAdminEmail } from '../utils/auth'

const AuthContext = createContext()

function buildUser(supabaseUser) {
  const email = supabaseUser.email
  const role = getRoleFromEmail(email)
  return { id: supabaseUser.id, email, role }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // Load the current Supabase session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(buildUser(session.user))
      }
      setLoading(false)
    })

    // Listen for auth state changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setUser(buildUser(session.user))
        } else {
          setUser(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const logout = async () => {
    await supabase.auth.signOut()
    setUser(null)
    router.push('/login')
  }

  const value = {
    user,
    loading,
    logout,
    isAuthenticated: !!user,
    isPassenger: user?.role === 'passenger',
    isAirline: user?.role === 'airline',
    isAdmin: isAdminEmail(user?.email),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
