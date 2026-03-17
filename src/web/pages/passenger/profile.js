import { useEffect, useState } from 'react'
import PassengerLayout from '../../components/layouts/PassengerLayout'
import { supabase } from '../../utils/supabaseClient'
import { useAuth } from '../../context/AuthContext'

function fmtEuro(amount) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount || 0)
}

function fmtDate(value) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleString('en-IE', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function PassengerProfile() {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true

    async function loadBalance() {
      try {
        if (authLoading) return
        setLoading(true)
        setError('')
        if (!user?.email) throw new Error('Not authenticated')
        const {
          data: { session },
        } = await supabase.auth.getSession()

        const token = session?.access_token
        if (!token) throw new Error('Not authenticated')

        const res = await fetch('/api/passenger/balance', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to load balance')
        if (mounted) setData(json)
      } catch (err) {
        if (mounted) setError(err.message || 'Failed to load balance')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    loadBalance()
    return () => { mounted = false }
  }, [authLoading, user?.email])

  const payments = data?.payments || []

  return (
    <PassengerLayout>
      <div className="profile-page">
        <div className="hero">
          <div className="hero-copy">
            <span className="hero-kicker">Passenger Profile</span>
            <h1>Compensation Balance</h1>
          </div>
          <div className="hero-card">
            <span className="hero-label">Current Balance</span>
            <strong>{fmtEuro(data?.balanceEur)}</strong>
          </div>
        </div>

        {error && <div className="alert">{error}</div>}

        {loading ? (
          <p className="loading">Loading balance…</p>
        ) : (
          <>
            <div className="stats-grid">
              <div className="stat-card stat-total-credited">
                <span className="stat-value">{fmtEuro(data?.balanceEur)}</span>
                <span className="stat-label">Total Credited</span>
              </div>
              <div className="stat-card stat-paid-claims">
                <span className="stat-value">{data?.creditedClaimsCount || 0}</span>
                <span className="stat-label">Paid Claims</span>
              </div>
            </div>

            <div className="history-card">
              <div className="section-head">
                <h2>Recent Payments</h2>
                <span>{payments.length} entries</span>
              </div>
              {payments.length === 0 ? (
                <p className="empty">No compensation has been credited yet.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Flight ID</th>
                        <th>Amount</th>
                        <th>Source</th>
                        <th>Credited</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.bookingRef}>
                          <td>{payment.flightId}</td>
                          <td>{fmtEuro(payment.amountEur)}</td>
                          <td>{payment.sourceStatus === 'auto_accepted' ? 'Auto-Accepted' : 'Accepted'}</td>
                          <td>{fmtDate(payment.creditedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        <style jsx>{`
          .profile-page { max-width: 1100px; margin: 0 auto; padding: 0 0 2rem; }
          .hero {
            display: flex;
            justify-content: space-between;
            align-items: stretch;
            gap: 1.5rem;
            margin-bottom: 1.5rem;
            padding: 1.75rem;
            border-radius: 22px;
            background: var(--bg-secondary);
            border: 1px solid var(--gray-200);
            box-shadow: 0 8px 20px rgba(15, 23, 42, 0.04);
          }
          .hero-copy {
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 0.5rem;
            max-width: 620px;
          }
          .hero-kicker {
            display: inline-flex;
            width: fit-content;
            padding: 0.35rem 0.75rem;
            border-radius: 999px;
            background: var(--bg-tertiary);
            border: 1px solid var(--gray-200);
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.12em;
            font-size: 0.72rem;
            font-weight: 700;
          }
          .hero h1 {
            margin: 0;
            font-size: clamp(2rem, 4vw, 2.6rem);
            letter-spacing: -0.035em;
            line-height: 1;
            color: var(--text-primary);
          }
          .hero-card {
            min-width: 260px;
            padding: 1.5rem 1.6rem;
            border-radius: 18px;
            background: var(--bg-primary);
            border: 1px solid var(--gray-200);
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 0.45rem;
            box-shadow:
              inset 0 1px 0 rgba(255, 255, 255, 0.82),
              0 6px 16px rgba(15, 23, 42, 0.04);
          }
          .hero-card strong {
            font-size: clamp(2.1rem, 4vw, 3rem);
            line-height: 1;
            letter-spacing: -0.05em;
            color: #ffffff;
          }
          .hero-label {
            color: #64748b;
            text-transform: uppercase;
            font-size: 0.74rem;
            letter-spacing: 0.16em;
            font-weight: 700;
          }
          .alert {
            margin-bottom: 1rem;
            padding: 0.85rem 1rem;
            border-radius: 10px;
            background: var(--error-bg, #fef2f2);
            color: var(--error-color, #dc2626);
            border: 1px solid var(--error-color, #dc2626);
          }
          .loading, .empty { color: var(--text-muted); }
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 1rem;
            margin-bottom: 1.5rem;
          }
          .stat-card {
            background: var(--bg-secondary);
            border: 1px solid var(--gray-200);
            border-radius: 18px;
            padding: 1.25rem;
            display: flex;
            flex-direction: column;
            gap: 0.35rem;
          }
          .stat-value { font-size: 1.8rem; font-weight: 700; color: var(--text-primary); }
          .stat-label { color: var(--text-muted); text-transform: uppercase; font-size: 0.78rem; letter-spacing: 0.08em; }
          .stat-total-credited .stat-value { color: #2563eb; }
          .stat-paid-claims .stat-value { color: #0f766e; }
          .history-card {
            background: var(--bg-secondary);
            border: 1px solid var(--gray-200);
            border-radius: 18px;
            padding: 1.25rem;
          }
          .section-head {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 1rem;
            margin-bottom: 1rem;
          }
          .section-head h2 { margin: 0; }
          .section-head span { color: var(--text-muted); font-size: 0.9rem; }
          .table-wrap { overflow-x: auto; }
          table { width: 100%; border-collapse: collapse; }
          th, td { text-align: left; padding: 0.85rem 0.75rem; border-bottom: 1px solid var(--gray-200); }
          th { color: var(--text-muted); text-transform: uppercase; font-size: 0.75rem; letter-spacing: 0.08em; }
          td { color: var(--text-primary); }
          tbody tr:last-child td { border-bottom: none; }
          @media (max-width: 720px) {
            .hero { flex-direction: column; align-items: flex-start; }
            .hero-card { width: 100%; }
          }
        `}</style>
      </div>
    </PassengerLayout>
  )
}
