import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../utils/supabaseClient'
import PublicLayout from '../../components/layouts/PublicLayout'

const AIRLINE_HOME_ROUTE = '/airline/claims'
const PASSENGER_HOME_ROUTE = '/passenger/register-flight'

export default function ConfirmEmail() {
    const router = useRouter()
    const [status, setStatus] = useState('Verifying your email...')
    const [error, setError] = useState(false)

    useEffect(() => {
        // Supabase v2 puts the token in the URL hash fragment (#access_token=...&type=signup)
        // The JS client auto-detects this and establishes a session.
        // We just need to wait for the auth state to update.

        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (event, session) => {
                if (event === 'SIGNED_IN' && session) {
                    setStatus('Email confirmed! Redirecting...')
                    const role = session.user?.user_metadata?.role || 'passenger'
                    setTimeout(() => {
                        router.push(role === 'airline' ? AIRLINE_HOME_ROUTE : PASSENGER_HOME_ROUTE)
                    }, 2000)
                }
            }
        )

        // Also check if there's already a session (in case the event fired before we subscribed)
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                setStatus('Email confirmed! Redirecting...')
                const role = session.user?.user_metadata?.role || 'passenger'
                setTimeout(() => {
                    router.push(role === 'airline' ? AIRLINE_HOME_ROUTE : PASSENGER_HOME_ROUTE)
                }, 2000)
            } else {
                // Give a few seconds for the hash fragment to be processed
                setTimeout(() => {
                    supabase.auth.getSession().then(({ data: { session: s } }) => {
                        if (!s) {
                            setError(true)
                            setStatus('Email verification failed. The link may have expired.')
                        }
                    })
                }, 3000)
            }
        })

        return () => subscription.unsubscribe()
    }, [router])

    return (
        <PublicLayout>
            <div className="auth-container">
                <div className="auth-form-wrapper" style={{ textAlign: 'center' }}>
                    <h1>Email Confirmation</h1>
                    <p style={{ color: error ? 'var(--error)' : 'var(--text-secondary)', marginTop: '16px' }}>
                        {status}
                    </p>
                    {error && (
                        <p style={{ marginTop: '16px' }}>
                            <a href="/create-account" style={{ color: 'var(--primary)' }}>
                                Try signing up again
                            </a>
                        </p>
                    )}
                </div>
            </div>
        </PublicLayout>
    )
}
