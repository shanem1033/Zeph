import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../utils/supabaseClient'
import PublicLayout from '../../components/layouts/PublicLayout'

export default function ConfirmEmail() {
    const router = useRouter()
    const [status, setStatus] = useState('Verifying your email...')
    const [error, setError] = useState(false)

    useEffect(() => {
        const { token_hash, type, next } = router.query

        if (!token_hash || !type) return

        async function verify() {
            const { error } = await supabase.auth.verifyOtp({
                type,
                token_hash,
            })

            if (error) {
                setError(true)
                setStatus('Email verification failed. The link may have expired.')
            } else {
                setStatus('Email confirmed! Redirecting...')
                setTimeout(() => {
                    window.location.href = next || '/login'
                }, 2000)
            }
        }

        verify()
    }, [router.query])

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
