import { useState, useEffect, useCallback } from 'react'
import AdminLayout from '../../components/layouts/AdminLayout'
import Alert from '../../components/ui/Alert'
import Button from '../../components/ui/Button'

const ADMIN_SECRET = process.env.NEXT_PUBLIC_ADMIN_SECRET || ''

function fmtDate(iso) {
    if (!iso) return '—'
    return new Date(iso).toLocaleString('en-IE', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function AdminFlightControl() {
    const [flights, setFlights] = useState([])
    const [flightSearch, setFlightSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')

    // Per-row delay state: { [flightId]: delayMinutes string }
    const [delayInputs, setDelayInputs] = useState({})
    const [submitting, setSubmitting] = useState(null) // flightId currently being submitted

    const normalizedFlightSearch = flightSearch.trim().toLowerCase()
    const filteredFlights = normalizedFlightSearch
        ? flights.filter((flight) => (flight.flight_id || '').toLowerCase().includes(normalizedFlightSearch))
        : flights

    const fetchFlights = useCallback(async () => {
        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/admin/set-flight-delayed', {
                headers: { 'x-admin-secret': ADMIN_SECRET },
            })
            const json = await res.json()
            if (!json.ok) throw new Error(json.error)
            setFlights(json.flights)
        } catch (err) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => { fetchFlights() }, [fetchFlights])

    async function markDelayed(flight) {
        const rawInput = delayInputs[flight.flight_id] || ''
        if (!rawInput) {
            setError('Enter the actual arrival time for ' + flight.flight_id)
            return
        }

        const actualArrival = new Date(rawInput)
        if (Number.isNaN(actualArrival.getTime())) {
            setError('Invalid arrival time for ' + flight.flight_id)
            return
        }

        setSubmitting(flight.flight_id)
        setError('')
        setSuccess('')

        try {
            const res = await fetch('/api/flights/landing', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    flightId: flight.flight_id,
                    actualArrivalAt: actualArrival.toISOString(),
                }),
            })
            const json = await res.json()
            if (!json.ok) throw new Error(json.error)

            const msg = json.delayed
                ? `✓ ${flight.flight_id} marked as delayed by ${json.delayMinutes} min — claims set to awaiting decision`
                : `✓ ${flight.flight_id} landing recorded (delay ${json.delayMinutes} min — below 180 min threshold)`

            setSuccess(msg)
            // Remove this flight from the list (it now has an actual arrival)
            setFlights((prev) => prev.filter((f) => f.flight_id !== flight.flight_id))
            setDelayInputs((prev) => { const next = { ...prev }; delete next[flight.flight_id]; return next })
        } catch (err) {
            setError(err.message)
        } finally {
            setSubmitting(null)
        }
    }

    return (
        <AdminLayout>
            <div className="admin-page">

                {/* Header */}
                <div className="admin-header">
                    <div className="admin-header-left">
                        <div className="admin-icon">✈</div>
                        <div>
                            <h1>Flight Control</h1>
                        </div>
                    </div>
                    <button className="refresh-btn" onClick={fetchFlights} disabled={loading}>
                        {loading ? 'Refreshing…' : '↻ Refresh'}
                    </button>
                </div>

                {error && <Alert type="error" message={error} onClose={() => setError('')} />}
                {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}

                {/* Info banner */}
                <div className="info-banner">
                    <span className="info-icon">ℹ</span>
                    Click the calendar icon to set the actual arrival time of a flight, then click Mark Landed.
                </div>

                <div className="search-panel">
                    <label className="search-label" htmlFor="flight-search">Search by full flight ID</label>
                    <input
                        id="flight-search"
                        type="text"
                        className="search-input"
                        placeholder="e.g. BA962-2026-03-01-0800"
                        value={flightSearch}
                        onChange={(e) => setFlightSearch(e.target.value)}
                    />
                </div>

                {/* Table */}
                {loading ? (
                    <div className="admin-loading">Loading active flights…</div>
                ) : flights.length === 0 ? (
                    <div className="admin-empty">
                        <div className="empty-icon">🛬</div>
                        <h3>No active flights</h3>
                        <p>All flights have already landed, or no flights exist in the system.</p>
                    </div>
                ) : filteredFlights.length === 0 ? (
                    <div className="admin-empty">
                        <div className="empty-icon">🔎</div>
                        <h3>No matching flights</h3>
                        <p>No active flights match the full flight ID "{flightSearch.trim()}".</p>
                    </div>
                ) : (
                    <div className="table-wrap">
                        <table className="flights-table">
                            <thead>
                                <tr>
                                    <th>Flight ID</th>
                                    <th>Route</th>
                                    <th>Sched. Departure</th>
                                    <th>Sched. Arrival</th>
                                    <th>Actual Arrival</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredFlights.map((f) => (
                                    <tr key={f.flight_id}>
                                        <td>
                                            <div className="flight-id">{f.flight_id}</div>
                                            <div className="flight-code-small">{f.flight_code}</div>
                                        </td>
                                        <td className="route-cell">
                                            {f.origin} <span className="arrow">→</span> {f.destination}
                                        </td>
                                        <td>{fmtDate(f.scheduled_departure_at)}</td>
                                        <td>{fmtDate(f.scheduled_arrival_at)}</td>
                                        <td>
                                            <input
                                                type="datetime-local"
                                                className="delay-input"
                                                value={delayInputs[f.flight_id] || ''}
                                                onChange={(e) =>
                                                    setDelayInputs((prev) => ({ ...prev, [f.flight_id]: e.target.value }))
                                                }
                                            />
                                        </td>
                                        <td>
                                            <button
                                                className={`mark-btn ${
                                                    delayInputs[f.flight_id] &&
                                                    new Date(delayInputs[f.flight_id]) - new Date(f.scheduled_arrival_at) >= 180 * 60 * 1000
                                                        ? 'mark-btn-warn' : 'mark-btn-default'
                                                }`}
                                                disabled={!!submitting || !delayInputs[f.flight_id]}
                                                onClick={() => markDelayed(f)}
                                            >
                                                {submitting === f.flight_id ? 'Saving…' : 'Mark Landed'}
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <style jsx>{`
        .admin-page {
          max-width: 1100px;
          margin: 0 auto;
          padding: 2rem 1rem;
        }

        /* Header */
        .admin-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }
        .admin-header-left {
          display: flex;
          align-items: center;
          gap: 1rem;
        }
        .admin-icon {
          font-size: 2.5rem;
          background: #1a1a2e;
          color: #e94560;
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 12px;
        }
        .admin-header h1 {
          margin: 0;
          font-size: 1.75rem;
          color: var(--text-primary);
        }
        .admin-subtitle {
          margin: 0;
          color: var(--text-muted);
          font-size: 0.9rem;
        }
        .refresh-btn {
          padding: 0.5rem 1.25rem;
          border-radius: var(--radius-md, 6px);
          border: 1px solid var(--gray-200, #e5e7eb);
          background: var(--bg-secondary, #f9fafb);
          color: var(--text-secondary, #6b7280);
          cursor: pointer;
          font-size: 0.875rem;
          font-weight: 500;
        }
        .refresh-btn:hover { background: var(--bg-tertiary, #f3f4f6); }

        /* Info banner */
        .info-banner {
          background: #1a1a2e;
          color: #a8b2d8;
          border-left: 4px solid #e94560;
          border-radius: var(--radius-md, 6px);
          padding: 0.875rem 1.25rem;
          font-size: 0.875rem;
          margin-bottom: 1.5rem;
          display: flex;
          gap: 0.75rem;
          align-items: flex-start;
        }
        .info-icon { font-style: normal; font-size: 1rem; margin-top: 1px; color: #e94560; }

        .search-panel {
          margin-bottom: 1rem;
        }
        .search-label {
          display: block;
          margin-bottom: 0.4rem;
          color: var(--text-secondary, #6b7280);
          font-size: 0.875rem;
          font-weight: 600;
        }
        .search-input {
          width: 100%;
          max-width: 420px;
          padding: 0.7rem 0.9rem;
          border: 1px solid var(--gray-300, #d1d5db);
          border-radius: var(--radius-md, 6px);
          font-size: 0.95rem;
          background: var(--bg-primary, #fff);
          color: var(--text-primary);
        }
        .search-input:focus {
          outline: none;
          border-color: #e94560;
          box-shadow: 0 0 0 2px rgba(233, 69, 96, 0.15);
        }

        /* Loading / empty */
        .admin-loading {
          text-align: center;
          padding: 4rem 0;
          color: var(--text-muted);
        }
        .admin-empty {
          text-align: center;
          padding: 4rem 1rem;
          color: var(--text-muted);
        }
        .empty-icon { font-size: 3rem; display: block; margin-bottom: 0.5rem; }
        .admin-empty h3 { color: var(--text-secondary); margin: 0 0 0.25rem; }

        /* Table */
        .table-wrap {
          border: 1px solid var(--gray-200, #e5e7eb);
          border-radius: var(--radius-lg, 8px);
          overflow: hidden;
        }
        .flights-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }
        .flights-table thead {
          background: #1a1a2e;
          color: #a8b2d8;
          text-transform: uppercase;
          font-size: 0.75rem;
          letter-spacing: 0.5px;
        }
        .flights-table th {
          padding: 0.875rem 1rem;
          text-align: left;
          font-weight: 600;
        }
        .flights-table td {
          padding: 0.875rem 1rem;
          border-bottom: 1px solid var(--gray-100, #f3f4f6);
          color: var(--text-primary);
          vertical-align: middle;
        }
        .flights-table tbody tr:last-child td { border-bottom: none; }
        .flights-table tbody tr:hover { background: var(--bg-tertiary, #f9fafb); }

        .flight-id {
          font-weight: 700;
          font-size: 1rem;
          color: var(--text-primary);
          font-family: monospace;
        }
        .flight-code-small {
          font-size: 0.75rem;
          color: var(--text-muted);
          margin-top: 2px;
        }
        .route-cell { white-space: nowrap; }
        .arrow { color: #e94560; margin: 0 4px; }

        /* Delay input */
        .delay-input {
          width: 220px;
          padding: 0.4rem 0.6rem;
          border: 1px solid var(--gray-300, #d1d5db);
          border-radius: var(--radius-md, 6px);
          font-size: 0.875rem;
          background: var(--bg-primary, #fff);
          color: var(--text-primary);
        }
        .delay-input:focus {
          outline: none;
          border-color: #e94560;
          box-shadow: 0 0 0 2px rgba(233, 69, 96, 0.15);
        }
        .delay-input::-webkit-calendar-picker-indicator {
          filter: invert(1);
          cursor: pointer;
        }

        /* Mark button */
        .mark-btn {
          padding: 0.45rem 1rem;
          border-radius: var(--radius-md, 6px);
          border: none;
          cursor: pointer;
          font-size: 0.8rem;
          font-weight: 600;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .mark-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .mark-btn-default {
          background: #1a1a2e;
          color: #a8b2d8;
        }
        .mark-btn-default:not(:disabled):hover {
          background: #2a2a4e;
          color: #fff;
        }
        .mark-btn-warn {
          background: #e94560;
          color: #fff;
        }
        .mark-btn-warn:not(:disabled):hover { background: #c73652; }
      `}</style>
        </AdminLayout>
    )
}
