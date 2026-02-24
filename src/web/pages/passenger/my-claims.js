import { useState, useEffect } from 'react'
import PassengerLayout from '../../components/layouts/PassengerLayout'
import { supabase } from '../../utils/supabaseClient'

export default function MyClaims() {
  const [flights, setFlights] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)

  async function refreshFromServer(currentFlights) {
    const refs = (Array.isArray(currentFlights) ? currentFlights : []).map((f) => f?.bookingRef).filter(Boolean)

    // Ensure we include the user's access token so the server can authenticate
    // and return only this passenger's claims. If `refs` is empty we still
    // call the server; the API will return all booking refs belonging to
    // the authenticated user (registrations made on other devices).
    const {
      data: { session },
    } = await supabase.auth.getSession()

    const token = session?.access_token
    if (!token) {
      throw new Error('Not authenticated')
    }

    const res = await fetch('/api/passenger/claims', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ bookingRefs: refs }),
    })

    const data = await res.json().catch(() => null)
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'Failed to refresh claim status')
    }

    const claims = Array.isArray(data?.claims) ? data.claims : []

    // Server returns the list of confirmed claims for this user. Merge the
    // server results with any locally-cached flights and add any claims
    // that exist server-side but not in localStorage (registrations from
    // other devices).
    const allowedRefs = claims.map((c) => c.bookingRef)
    const byRef = new Map(claims.map((c) => [c.bookingRef, c]))

    // Start from any existing local flights that the server still confirms.
    const existing = (Array.isArray(currentFlights) ? currentFlights : []).filter((f) => allowedRefs.includes(f?.bookingRef))

    // Add or update entries from server that aren't present locally.
    const existingRefs = new Set(existing.map((f) => f.bookingRef))
    const additions = claims
      .filter((c) => !existingRefs.has(c.bookingRef))
      .map((c) => ({ id: c.bookingRef, bookingRef: c.bookingRef, flightId: c.flightId, claimStatus: c.claimStatus }))

    const nextFlights = [
      ...existing.map((f) => {
        const fresh = f?.bookingRef ? byRef.get(f.bookingRef) : null
        if (!fresh) return f
        return {
          ...f,
          flightId: fresh.flightId || f.flightId,
          claimStatus: fresh.claimStatus || f.claimStatus,
        }
      }),
      ...additions,
    ]

    setFlights(nextFlights)
    localStorage.setItem('registeredFlights', JSON.stringify(nextFlights))
  }

  useEffect(() => {
    let mounted = true
    let intervalId = null

    async function loadAndRefresh() {
      try {
        // Load registered flights from localStorage (temporary until we have proper user accounts)
        const registeredFlightsRaw = localStorage.getItem('registeredFlights')
        const initialFlights = registeredFlightsRaw ? JSON.parse(registeredFlightsRaw) : []
        if (!mounted) return
        setFlights(Array.isArray(initialFlights) ? initialFlights : [])

        // Refresh statuses from DB so accepted/rejected shows up without manual cache clearing.
        await refreshFromServer(initialFlights)

        // Poll while there are still pending claims (registered/awaiting_decision)
        const hasPending = (Array.isArray(initialFlights) ? initialFlights : []).some((f) =>
          ['registered', 'awaiting_decision'].includes(f?.claimStatus)
        )

        if (hasPending) {
          intervalId = setInterval(async () => {
            try {
              const latestRaw = localStorage.getItem('registeredFlights')
              const latest = latestRaw ? JSON.parse(latestRaw) : []
              await refreshFromServer(latest)
            } catch {
              // Silent; we don't want to spam alerts while polling.
            }
          }, 8000)
        }
      } catch (err) {
        if (!mounted) return
        setMessage({ type: 'error', text: err.message || 'Failed to load claims' })
      } finally {
        if (!mounted) return
        setLoading(false)
      }
    }

    loadAndRefresh()

    return () => {
      mounted = false
      if (intervalId) clearInterval(intervalId)
    }
  }, [])

  // Map claim status to display text and style
  const getStatusDisplay = (status) => {
    const statusMap = {
      'registered': { text: 'Registered', class: 'registered', icon: '✓' },
      'landed_on_time': { text: 'On Time', class: 'on-time', icon: '✓' },
      'awaiting_decision': { text: 'Awaiting Decision', class: 'awaiting', icon: '⏳' },
      'rejected': { text: 'Rejected', class: 'rejected', icon: '✗' },
      'accepted': { text: 'Accepted', class: 'accepted', icon: '✓' },
    }
    return statusMap[status] || { text: status || 'Registered', class: 'registered', icon: '•' }
  }

  return (
    <PassengerLayout>
      <div className="container">
        <h1>My Claims</h1>

        {message && (
          <div className={`alert alert-${message.type}`}>
            {message.text}
          </div>
        )}

        {loading ? (
          <p>Loading...</p>
        ) : flights.length === 0 ? (
          <p>No registered flights</p>
        ) : (
          <div className="flights-table">
            <table>
              <thead>
                <tr>
                  <th>Flight ID</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {flights.map(flight => {
                  const status = getStatusDisplay(flight.claimStatus)
                  return (
                    <tr key={flight.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {flight.flightId}
                        </div>
                      </td>
                      <td>
                        <span className={`status-badge ${status.class}`}>
                          {status.icon} {status.text}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <style jsx>{`
          .container {
            max-width: 600px;
            margin: 2rem auto;
            padding: 0 1rem;
          }

          h1 {
            margin-bottom: 2rem;
            color: var(--text-primary);
          }

          .alert {
            padding: 1rem;
            margin-bottom: 1.5rem;
            border-radius: 8px;
            font-weight: 500;
          }

          .alert-success {
            background: var(--success-bg);
            color: var(--success-color);
            border: 1px solid var(--success-color);
          }

          .alert-error {
            background: var(--error-bg);
            color: var(--error-color);
            border: 1px solid var(--error-color);
          }

          .status-badge {
            display: inline-block;
            padding: 0.25rem 0.5rem;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 600;
            white-space: nowrap;
          }

          .status-badge.registered {
            background: rgba(59, 130, 246, 0.2);
            color: #3b82f6;
            border: 1px solid #3b82f6;
          }

          .status-badge.on-time {
            background: rgba(107, 114, 128, 0.2);
            color: #6b7280;
            border: 1px solid #6b7280;
          }

          .status-badge.awaiting {
            background: rgba(245, 158, 11, 0.2);
            color: #f59e0b;
            border: 1px solid #f59e0b;
          }

          .status-badge.rejected {
            background: rgba(239, 68, 68, 0.2);
            color: #ef4444;
            border: 1px solid #ef4444;
          }

          .status-badge.accepted {
            background: rgba(34, 197, 94, 0.2);
            color: #22c55e;
            border: 1px solid #22c55e;
          }

          .flights-table {
            width: 100%;
            overflow-x: auto;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            background: var(--bg-secondary);
            border-radius: 8px;
            overflow: hidden;
            border: 1px solid var(--bg-tertiary);
          }

          thead {
            background: var(--bg-tertiary);
          }

          th {
            padding: 1rem;
            text-align: left;
            color: var(--text-primary);
            font-weight: 600;
          }

          td {
            padding: 1rem;
            color: var(--text-secondary);
            border-top: 1px solid var(--bg-tertiary);
          }

          tr:hover {
            background: rgba(255, 255, 255, 0.02);
          }
        `}</style>
      </div>
    </PassengerLayout>
  )
}
