import { useEffect, useState, useRef } from 'react'
import AirlineLayout from '../../components/layouts/AirlineLayout'
import { useAuth } from '../../context/AuthContext'
import { getAirlineCodeFromEmail, getAirlineNameFromCode } from '../../utils/auth'

function fmtEuro(amount) {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(amount || 0)
}

function fmtDate(value) {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return date.toLocaleString('en-IE', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function AirlineProfile() {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const requestIdRef = useRef(0)

  useEffect(() => {
    let mounted = true

    async function loadStats() {
      const requestId = ++requestIdRef.current
      try {
        if (authLoading) return
        setLoading(true)
        setError('')
        const airlineCode = getAirlineCodeFromEmail(user?.email)
        if (!airlineCode) throw new Error('Could not determine airline account')

        const res = await fetch(`/api/flights/claims?airlineCode=${airlineCode}`, { cache: 'no-store' })
        const json = await res.json().catch(() => null)
        if (!res.ok || !json?.ok) throw new Error(json?.error || 'Failed to load airline claims')

        const claims = Array.isArray(json?.claims) ? json.claims : []
        const confirmedPassengers = claims.flatMap((claim) =>
          (claim.passengers || [])
            .filter((passenger) => passenger?.registration?.status === 'confirmed')
            .map((passenger) => ({ ...passenger, flight: claim }))
        )

        const acceptedClaimsCount = confirmedPassengers.filter((passenger) => passenger.registration?.claim_status === 'accepted').length
        const rejectedClaimsCount = confirmedPassengers.filter((passenger) => passenger.registration?.claim_status === 'rejected').length
        const autoAcceptedClaimsCount = confirmedPassengers.filter((passenger) => passenger.registration?.claim_status === 'auto_accepted').length
        const awaitingClaimsCount = confirmedPassengers.filter((passenger) => passenger.registration?.claim_status === 'awaiting_decision').length
        const paidClaimsCount = acceptedClaimsCount + autoAcceptedClaimsCount

        const recentPayments = confirmedPassengers
          .filter((passenger) => ['accepted', 'auto_accepted'].includes(passenger.registration?.claim_status))
          .map((passenger) => ({
            bookingRef: passenger.booking_ref,
            flightId: passenger.flight?.flight_id || null,
            passengerEmail: passenger.passenger_email || null,
            amountEur: 300,
            sourceStatus: passenger.registration?.claim_status,
            creditedAt:
              passenger.flight?.decision?.auto_accepted_at ||
              passenger.flight?.decision?.decided_at ||
              passenger.registration?.confirmed_at ||
              passenger.flight?.actual_arrival ||
              null,
          }))
          .sort((a, b) => new Date(b.creditedAt || 0).getTime() - new Date(a.creditedAt || 0).getTime())
          .slice(0, 10)

        if (mounted && requestId === requestIdRef.current) {
          setData({
            airline: {
              totalPaidEur: paidClaimsCount * 300,
              paidClaimsCount,
              acceptedClaimsCount,
              rejectedClaimsCount,
              autoAcceptedClaimsCount,
              awaitingClaimsCount,
              delayedFlightsCount: claims.length,
              onTimeFlightsCount: 0,
            },
            recentPayments,
          })
        }
      } catch (err) {
        if (mounted && requestId === requestIdRef.current) setError(err.message || 'Failed to load airline stats')
      } finally {
        if (mounted && requestId === requestIdRef.current) setLoading(false)
      }
    }

    loadStats()

    return () => {
      mounted = false
    }
  }, [authLoading, user?.email])

  const airlineCode = getAirlineCodeFromEmail(user?.email)
  const airline = data?.airline
  const recentPayments = data?.recentPayments || []
  const fallbackAirlineName = getAirlineNameFromCode(airlineCode) || 'Airline Profile'

  return (
    <AirlineLayout>
      <div className="profile-page">
        <div className="hero">
          <div className="hero-copy">
            <span className="hero-kicker">Airline Profile</span>
            <h1>{airline?.name || fallbackAirlineName}</h1>
          </div>
          <div className="hero-card">
            <span className="hero-label">Total Paid</span>
            <strong>{fmtEuro(airline?.totalPaidEur)}</strong>
          </div>
        </div>

        {error && <div className="alert">{error}</div>}

        {loading ? (
          <p className="loading">Loading airline stats…</p>
        ) : (
          <>
            <div className="stats-grid">
              <div className="stat-card stat-paid"><span className="stat-value">{fmtEuro(airline?.totalPaidEur)}</span><span className="stat-label">Total Paid</span></div>
              <div className="stat-card stat-paid-claims"><span className="stat-value">{airline?.paidClaimsCount || 0}</span><span className="stat-label">Paid Claims</span></div>
              <div className="stat-card stat-accepted"><span className="stat-value">{airline?.acceptedClaimsCount || 0}</span><span className="stat-label">Accepted</span></div>
              <div className="stat-card stat-rejected"><span className="stat-value">{airline?.rejectedClaimsCount || 0}</span><span className="stat-label">Rejected</span></div>
              <div className="stat-card stat-auto"><span className="stat-value">{airline?.autoAcceptedClaimsCount || 0}</span><span className="stat-label">Auto-Accepted</span></div>
              <div className="stat-card stat-awaiting"><span className="stat-value">{airline?.awaitingClaimsCount || 0}</span><span className="stat-label">Awaiting</span></div>
              <div className="stat-card stat-delayed"><span className="stat-value">{airline?.delayedFlightsCount || 0}</span><span className="stat-label">Delayed Flights</span></div>
              <div className="stat-card stat-on-time"><span className="stat-value">{airline?.onTimeFlightsCount || 0}</span><span className="stat-label">On-Time Flights</span></div>
            </div>

            <div className="history-card">
              <div className="section-head">
                <h2>Recent Compensation Credits</h2>
                <span>{recentPayments.length} entries</span>
              </div>
              {recentPayments.length === 0 ? (
                <p className="empty">No compensation credits have been recorded for this airline yet.</p>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Flight ID</th>
                        <th>Passenger</th>
                        <th>Amount</th>
                        <th>Source</th>
                        <th>Credited</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentPayments.map((payment) => (
                        <tr key={payment.bookingRef}>
                          <td>{payment.flightId}</td>
                          <td>{payment.passengerEmail}</td>
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
          .profile-page { max-width: 1120px; margin: 0 auto; }
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
            grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
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
          .stat-value { font-size: 1.7rem; font-weight: 700; }
          .stat-label { color: var(--text-muted); text-transform: uppercase; font-size: 0.78rem; letter-spacing: 0.08em; }
          .stat-paid .stat-value { color: #2563eb; }
          .stat-paid-claims .stat-value { color: #0f766e; }
          .stat-accepted .stat-value { color: #16a34a; }
          .stat-rejected .stat-value { color: #dc2626; }
          .stat-auto .stat-value { color: #0284c7; }
          .stat-awaiting .stat-value { color: #d97706; }
          .stat-delayed .stat-value { color: #7c3aed; }
          .stat-on-time .stat-value { color: #475569; }
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
          tbody tr:last-child td { border-bottom: none; }
          @media (max-width: 720px) {
            .hero { flex-direction: column; align-items: flex-start; }
            .hero-card { width: 100%; }
          }
        `}</style>
      </div>
    </AirlineLayout>
  )
}
