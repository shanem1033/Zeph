import { useState, useEffect } from 'react'
import PassengerLayout from '../../components/layouts/PassengerLayout'
import Modal from '../../components/modals/Modal'
import { supabase } from '../../utils/supabaseClient'

const STATUS_FILTERS = [
  { key: 'registered', label: 'Registered' },
  { key: 'awaiting_decision', label: 'Awaiting Decision' },
  { key: 'accepted', label: 'Accepted' },
  { key: 'rejected', label: 'Rejected' },
]

const DEFAULT_FILTER = 'default'

export default function MyClaims() {
  const [flights, setFlights] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)
  const [activeFilter, setActiveFilter] = useState(DEFAULT_FILTER)
  const [selectedClaim, setSelectedClaim] = useState(null)
  const [evidenceLoading, setEvidenceLoading] = useState(false)

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
      .map((c) => ({
        id: c.bookingRef,
        bookingRef: c.bookingRef,
        flightId: c.flightId,
        flightCode: c.flightCode || null,
        origin: c.origin || null,
        destination: c.destination || null,
        scheduledDeparture: c.scheduledDeparture || null,
        scheduledArrival: c.scheduledArrival || null,
        actualArrival: c.actualArrival || null,
        delayMinutes: c.delayMinutes ?? null,
        claimStatus: c.claimStatus,
        isPaid: !!c.isPaid,
        paymentAmountEur: c.paymentAmountEur ?? null,
        paymentCreditedAt: c.paymentCreditedAt || null,
        paymentSourceStatus: c.paymentSourceStatus || null,
        rejectionReportUrl: c.rejectionReportUrl || null,
        rejectionReason: c.rejectionReason || null,
        txHash: c.txHash || null,
        oracleTxHash: c.oracleTxHash || null,
        decisionTxHash: c.decisionTxHash || null,
      }))

    const nextFlights = [
      ...existing.map((f) => {
        const fresh = f?.bookingRef ? byRef.get(f.bookingRef) : null
        if (!fresh) return f
        return {
          ...f,
          flightId: fresh.flightId || f.flightId,
          flightCode: fresh.flightCode || f.flightCode || null,
          origin: fresh.origin || f.origin || null,
          destination: fresh.destination || f.destination || null,
          scheduledDeparture: fresh.scheduledDeparture || f.scheduledDeparture || null,
          scheduledArrival: fresh.scheduledArrival || f.scheduledArrival || null,
          actualArrival: fresh.actualArrival || f.actualArrival || null,
          delayMinutes: fresh.delayMinutes ?? f.delayMinutes ?? null,
          claimStatus: fresh.claimStatus || f.claimStatus,
          isPaid: fresh.isPaid ?? f.isPaid ?? false,
          paymentAmountEur: fresh.paymentAmountEur ?? f.paymentAmountEur ?? null,
          paymentCreditedAt: fresh.paymentCreditedAt || f.paymentCreditedAt || null,
          paymentSourceStatus: fresh.paymentSourceStatus || f.paymentSourceStatus || null,
          rejectionReportUrl: fresh.rejectionReportUrl || f.rejectionReportUrl || null,
          rejectionReason: fresh.rejectionReason || f.rejectionReason || null,
          txHash: fresh.txHash || f.txHash || null,
          oracleTxHash: fresh.oracleTxHash || f.oracleTxHash || null,
          decisionTxHash: fresh.decisionTxHash || f.decisionTxHash || null,
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
      'auto_accepted': { text: 'Auto-Accepted', class: 'auto-accepted', icon: '✓' },
    }
    return statusMap[status] || { text: status || 'Registered', class: 'registered', icon: '•' }
  }

  const filteredFlights = flights.filter((flight) => {
    if (activeFilter === 'all') return true
    if (activeFilter === DEFAULT_FILTER) {
      return ['registered', 'awaiting_decision'].includes(flight?.claimStatus)
    }
    return flight?.claimStatus === activeFilter
  })

  const getEmptyMessage = () => {
    if (activeFilter === 'all') {
      return 'No claims found.'
    }

    if (activeFilter === DEFAULT_FILTER) {
      return 'No registered or awaiting decision claims right now.'
    }

    const selected = STATUS_FILTERS.find((status) => status.key === activeFilter)
    if (selected) {
      return `No ${selected.label.toLowerCase()} claims right now.`
    }

    return 'No claims match the selected filters.'
  }

  const fmtDateTime = (value) => {
    if (!value) return 'Not available'
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return 'Not available'
    return date.toLocaleString('en-IE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const fmtDelay = (minutes) => {
    if (minutes == null) return 'Not available'
    if (minutes === 0) return '0 minutes'
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    if (hours === 0) return `${remainingMinutes} minutes`
    if (remainingMinutes === 0) return `${hours}h`
    return `${hours}h ${remainingMinutes}m`
  }

  const getPaymentLabel = (claim) => {
    if (claim?.isPaid && claim?.paymentAmountEur) {
      return `Credited €${claim.paymentAmountEur}`
    }
    if (['accepted', 'auto_accepted'].includes(claim?.claimStatus)) {
      return 'Credit pending'
    }
    return 'Not credited'
  }

  const downloadEvidenceReport = async (claim) => {
    try {
      setEvidenceLoading(true)
      setMessage(null)

      const {
        data: { session },
      } = await supabase.auth.getSession()

      const token = session?.access_token
      if (!token) {
        throw new Error('Not authenticated')
      }

      const res = await fetch('/api/passenger/claims/evidence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ bookingRef: claim.bookingRef }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error || 'Failed to generate evidence report')
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `claim-evidence-${claim.bookingRef}.zip`
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to generate evidence report' })
    } finally {
      setEvidenceLoading(false)
    }
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

        {!loading && flights.length > 0 && (
          <div className="claims-filters">
            <button
              type="button"
              className={`filter-btn ${activeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setActiveFilter('all')}
            >
              All
            </button>

            {STATUS_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                className={`filter-btn ${activeFilter === filter.key ? 'active' : ''}`}
                onClick={() => setActiveFilter(filter.key)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <p>Loading...</p>
        ) : flights.length === 0 ? (
          <p>No registered flights</p>
        ) : filteredFlights.length === 0 ? (
          <p>{getEmptyMessage()}</p>
        ) : (
          <div className="flights-table">
            <table>
              <thead>
                <tr>
                  <th>Flight ID</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredFlights.map(flight => {
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
                      <td>
                        <div className={`payment-pill ${flight.isPaid ? 'paid' : 'unpaid'}`}>
                          {getPaymentLabel(flight)}
                        </div>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="details-button"
                          onClick={() => setSelectedClaim(flight)}
                        >
                          See details
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <Modal
          isOpen={Boolean(selectedClaim)}
          onClose={() => setSelectedClaim(null)}
          title={selectedClaim ? `Claim Details · ${selectedClaim.flightId}` : 'Claim Details'}
        >
          {selectedClaim && (() => {
            const status = getStatusDisplay(selectedClaim.claimStatus)
            return (
              <div className="claim-modal-content">
                <div className="claim-modal-hero">
                  <div>
                    <p className="claim-modal-kicker">Passenger Claim Overview</p>
                    <h3 className="claim-modal-title">{selectedClaim.flightCode || selectedClaim.flightId}</h3>
                    <p className="claim-modal-route">
                      {selectedClaim.origin && selectedClaim.destination
                        ? `${selectedClaim.origin} → ${selectedClaim.destination}`
                        : 'Route information not available'}
                    </p>
                  </div>

                  <div className="claim-modal-status-row">
                    <span className={`status-badge ${status.class}`}>
                      {status.icon} {status.text}
                    </span>
                  </div>
                </div>

                <div className="claim-detail-grid">
                  <div className="claim-detail-item">
                    <span className="claim-detail-label">Booking Reference</span>
                    <strong>{selectedClaim.bookingRef || 'Not available'}</strong>
                  </div>
                  <div className="claim-detail-item">
                    <span className="claim-detail-label">Flight ID</span>
                    <strong>{selectedClaim.flightId || 'Not available'}</strong>
                  </div>
                  <div className="claim-detail-item">
                    <span className="claim-detail-label">Flight Code</span>
                    <strong>{selectedClaim.flightCode || 'Not available'}</strong>
                  </div>
                  <div className="claim-detail-item">
                    <span className="claim-detail-label">Route</span>
                    <strong>
                      {selectedClaim.origin && selectedClaim.destination
                        ? `${selectedClaim.origin} → ${selectedClaim.destination}`
                        : 'Not available'}
                    </strong>
                  </div>
                  <div className="claim-detail-item">
                    <span className="claim-detail-label">Scheduled Departure</span>
                    <strong>{fmtDateTime(selectedClaim.scheduledDeparture)}</strong>
                  </div>
                  <div className="claim-detail-item">
                    <span className="claim-detail-label">Scheduled Arrival</span>
                    <strong>{fmtDateTime(selectedClaim.scheduledArrival)}</strong>
                  </div>
                  <div className="claim-detail-item">
                    <span className="claim-detail-label">Actual Arrival</span>
                    <strong>{fmtDateTime(selectedClaim.actualArrival)}</strong>
                  </div>
                  <div className="claim-detail-item">
                    <span className="claim-detail-label">Delay</span>
                    <strong>{fmtDelay(selectedClaim.delayMinutes)}</strong>
                  </div>
                  <div className="claim-detail-item">
                    <span className="claim-detail-label">Payment</span>
                    <strong>{getPaymentLabel(selectedClaim)}</strong>
                  </div>
                  <div className="claim-detail-item">
                    <span className="claim-detail-label">Credited At</span>
                    <strong>{fmtDateTime(selectedClaim.paymentCreditedAt)}</strong>
                  </div>
                  {selectedClaim.txHash && (
                    <div className="claim-detail-item" style={{ gridColumn: '1 / -1' }}>
                      <span className="claim-detail-label">Registration Transaction</span>
                      <a
                        href={`https://polygonscan.com/tx/${selectedClaim.txHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="polygonscan-link"
                      >
                        {selectedClaim.txHash}
                      </a>
                    </div>
                  )}
                  {selectedClaim.oracleTxHash && (
                    <div className="claim-detail-item" style={{ gridColumn: '1 / -1' }}>
                      <span className="claim-detail-label">Delay Report Transaction</span>
                      <a
                        href={`https://polygonscan.com/tx/${selectedClaim.oracleTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="polygonscan-link"
                      >
                        {selectedClaim.oracleTxHash}
                      </a>
                    </div>
                  )}
                  {selectedClaim.decisionTxHash && (
                    <div className="claim-detail-item" style={{ gridColumn: '1 / -1' }}>
                      <span className="claim-detail-label">Airline Decision Transaction</span>
                      <a
                        href={`https://polygonscan.com/tx/${selectedClaim.decisionTxHash}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="polygonscan-link"
                      >
                        {selectedClaim.decisionTxHash}
                      </a>
                    </div>
                  )}
                </div>

                {selectedClaim.claimStatus === 'rejected' && (
                  <div className="claim-extra-panel">
                    <h3>Rejection Details</h3>
                    <p>{selectedClaim.rejectionReason || 'No rejection reason was provided.'}</p>
                    {selectedClaim.rejectionReportUrl && (
                      <a
                        href={selectedClaim.rejectionReportUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="report-link"
                      >
                        View Rejection Report (PDF)
                      </a>
                    )}
                  </div>
                )}

                {selectedClaim.claimStatus === 'accepted' && (
                  <div className="claim-extra-panel success-panel">
                    <h3>Claim Outcome</h3>
                    <p>
                      This claim has been accepted by the airline.
                      {selectedClaim.isPaid ? ` €${selectedClaim.paymentAmountEur} has been credited to your Zeph balance.` : ' Payment will appear once the credit is recorded.'}
                    </p>
                  </div>
                )}

                {selectedClaim.claimStatus === 'auto_accepted' && (
                  <div className="claim-extra-panel auto-accepted-panel">
                    <h3>Claim Auto-Accepted</h3>
                    <p>
                      The airline did not respond to this claim within the 7-day review window. Your claim has been automatically accepted.
                      {selectedClaim.isPaid ? ` €${selectedClaim.paymentAmountEur} has been credited to your Zeph balance.` : ' Payment will appear once the credit is recorded.'}
                    </p>
                  </div>
                )}

                <div className="claim-modal-actions">
                  <button
                    type="button"
                    className="evidence-button"
                    onClick={() => downloadEvidenceReport(selectedClaim)}
                    disabled={evidenceLoading}
                  >
                    {evidenceLoading ? 'Generating…' : 'Download Evidence Report'}
                  </button>
                </div>
              </div>
            )
          })()}
        </Modal>

        <style jsx>{`
          :global(.modal-content) {
            width: min(94vw, 1120px);
            max-width: 1120px;
            max-height: 88vh;
            display: flex;
            flex-direction: column;
            border-radius: 24px;
            overflow: hidden;
            border: 1px solid rgba(148, 163, 184, 0.2);
            box-shadow: 0 32px 80px rgba(15, 23, 42, 0.45);
          }

          :global(.modal-header) {
            padding: 1.4rem 1.8rem;
            background:
              linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(14, 165, 233, 0.04)),
              var(--bg-secondary);
            border-bottom: 1px solid rgba(148, 163, 184, 0.15);
          }

          :global(.modal-header h2) {
            font-size: 1.2rem;
            letter-spacing: 0.01em;
          }

          :global(.modal-body) {
            flex: 1;
            min-height: 0;
            overflow-y: auto;
            scrollbar-width: thin;
            scrollbar-color: rgba(96, 165, 250, 0.45) rgba(15, 23, 42, 0.28);
            padding: 1.8rem;
            background:
              radial-gradient(circle at top right, rgba(59, 130, 246, 0.08), transparent 28%),
              var(--bg-secondary);
          }

          :global(.modal-body::-webkit-scrollbar) {
            width: 12px;
          }

          :global(.modal-body::-webkit-scrollbar-track) {
            background: rgba(15, 23, 42, 0.28);
            border-left: 1px solid rgba(148, 163, 184, 0.08);
          }

          :global(.modal-body::-webkit-scrollbar-thumb) {
            background: linear-gradient(180deg, rgba(59, 130, 246, 0.72), rgba(14, 165, 233, 0.48));
            border-radius: 999px;
            border: 2px solid rgba(30, 41, 59, 0.95);
          }

          :global(.modal-body::-webkit-scrollbar-thumb:hover) {
            background: linear-gradient(180deg, rgba(96, 165, 250, 0.88), rgba(56, 189, 248, 0.62));
          }

          .container {
            max-width: 1180px;
            margin: 2rem auto;
            padding: 0 1.25rem 2rem;
          }

          h1 {
            margin-bottom: 2rem;
            color: var(--text-primary);
            font-size: clamp(2rem, 2.8vw, 2.8rem);
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

          .claims-filters {
            display: flex;
            flex-wrap: wrap;
            gap: 0.75rem;
            margin-bottom: 1.75rem;
          }

          .filter-btn {
            padding: 0.75rem 1.15rem;
            border-radius: 999px;
            border: 1px solid var(--bg-tertiary);
            background: var(--bg-secondary);
            color: var(--text-secondary);
            font-size: 0.95rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .filter-btn:hover {
            border-color: #3b82f6;
            color: var(--text-primary);
          }

          .filter-btn.active {
            background: rgba(59, 130, 246, 0.15);
            color: #60a5fa;
            border-color: #3b82f6;
          }

          .details-button {
            padding: 0.75rem 1rem;
            border-radius: 10px;
            border: 1px solid #3b82f6;
            background: rgba(59, 130, 246, 0.12);
            color: #60a5fa;
            font-weight: 600;
            font-size: 0.95rem;
            cursor: pointer;
            transition: all 0.2s ease;
          }

          .details-button:hover {
            background: rgba(59, 130, 246, 0.18);
          }

          .payment-pill {
            display: inline-block;
            padding: 0.38rem 0.7rem;
            border-radius: 999px;
            font-size: 0.82rem;
            font-weight: 600;
            white-space: nowrap;
          }

          .payment-pill.paid {
            background: rgba(34, 197, 94, 0.18);
            color: #22c55e;
            border: 1px solid rgba(34, 197, 94, 0.3);
          }

          .payment-pill.unpaid {
            background: rgba(148, 163, 184, 0.14);
            color: var(--text-muted);
            border: 1px solid rgba(148, 163, 184, 0.2);
          }

          .status-badge {
            display: inline-block;
            padding: 0.4rem 0.7rem;
            border-radius: 999px;
            font-size: 0.82rem;
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

          .status-badge.auto-accepted {
            background: rgba(14, 165, 233, 0.2);
            color: #0ea5e9;
            border: 1px solid #0ea5e9;
          }

          .flights-table {
            width: 100%;
            overflow-x: auto;
            border-radius: 18px;
            box-shadow: 0 18px 40px rgba(15, 23, 42, 0.2);
          }

          table {
            width: 100%;
            border-collapse: collapse;
            background: var(--bg-secondary);
            border-radius: 18px;
            overflow: hidden;
            border: 1px solid var(--bg-tertiary);
            table-layout: fixed;
          }

          thead {
            background: linear-gradient(180deg, rgba(59, 130, 246, 0.12), rgba(51, 65, 85, 0.95));
          }

          th {
            padding: 1.2rem 1.25rem;
            text-align: left;
            color: var(--text-primary);
            font-weight: 600;
            font-size: 0.95rem;
          }

          td {
            padding: 1.2rem 1.25rem;
            color: var(--text-secondary);
            border-top: 1px solid var(--bg-tertiary);
            font-size: 0.98rem;
            vertical-align: middle;
          }

          tr:hover {
            background: rgba(255, 255, 255, 0.02);
          }

          .rejection-details {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
          }

          .rejection-reason {
            margin: 0;
            font-size: 0.85rem;
            color: var(--text-secondary);
            font-style: italic;
          }

          .report-link {
            display: inline-flex;
            align-items: center;
            gap: 0.25rem;
            font-size: 0.8rem;
            color: #3b82f6;
            text-decoration: none;
            font-weight: 500;
          }

          .report-link:hover {
            text-decoration: underline;
          }

          .no-details {
            color: var(--text-muted);
            font-size: 0.85rem;
          }

          .claim-modal-content {
            display: flex;
            flex-direction: column;
            gap: 1.75rem;
          }

          .claim-modal-hero {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 1.5rem;
            padding: 1.6rem;
            border-radius: 22px;
            background:
              linear-gradient(135deg, rgba(15, 23, 42, 0.92), rgba(30, 41, 59, 0.9)),
              var(--bg-secondary);
            border: 1px solid rgba(96, 165, 250, 0.22);
          }

          .claim-modal-kicker {
            margin: 0 0 0.35rem;
            font-size: 0.78rem;
            font-weight: 700;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: #93c5fd;
          }

          .claim-modal-title {
            margin: 0;
            font-size: clamp(1.9rem, 2.3vw, 2.4rem);
            line-height: 1.1;
            color: #f8fafc;
          }

          .claim-modal-route {
            margin: 0.45rem 0 0;
            font-size: 1.08rem;
            color: #cbd5e1;
          }

          .claim-modal-status-row {
            display: flex;
            justify-content: flex-start;
            flex-shrink: 0;
          }

          .claim-detail-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
            gap: 1.15rem;
          }

          .claim-detail-item {
            padding: 1.2rem 1.25rem;
            border-radius: 18px;
            border: 1px solid rgba(148, 163, 184, 0.14);
            background:
              linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01)),
              var(--bg-secondary);
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
          }

          .claim-detail-item strong {
            color: var(--text-primary);
            word-break: break-word;
            font-size: 1.08rem;
            line-height: 1.45;
          }

          .claim-detail-label {
            font-size: 0.83rem;
            text-transform: uppercase;
            letter-spacing: 0.08em;
            color: var(--text-muted);
          }

          .polygonscan-link {
            color: #60a5fa;
            text-decoration: none;
            font-size: 0.9rem;
            word-break: break-all;
            font-family: monospace;
          }

          .polygonscan-link:hover {
            text-decoration: underline;
          }

          .claim-extra-panel {
            padding: 1.35rem 1.4rem;
            border-radius: 18px;
            background: rgba(239, 68, 68, 0.08);
            border: 1px solid rgba(239, 68, 68, 0.26);
          }

          .claim-extra-panel h3 {
            margin: 0 0 0.5rem;
            color: var(--text-primary);
            font-size: 1.1rem;
          }

          .claim-extra-panel p {
            margin: 0;
            color: var(--text-secondary);
            line-height: 1.65;
            font-size: 1rem;
          }

          .success-panel {
            background: rgba(34, 197, 94, 0.08);
            border-color: rgba(34, 197, 94, 0.25);
          }

          .auto-accepted-panel {
            background: rgba(14, 165, 233, 0.08);
            border-color: rgba(14, 165, 233, 0.25);
          }

          .claim-modal-actions {
            display: flex;
            justify-content: flex-end;
            position: sticky;
            bottom: -1.8rem;
            margin-top: auto;
            padding-top: 1rem;
            padding-bottom: 0.2rem;
            background: linear-gradient(180deg, rgba(30, 41, 59, 0), rgba(30, 41, 59, 0.96) 28%);
          }

          .evidence-button {
            padding: 0.95rem 1.3rem;
            border: none;
            border-radius: 14px;
            background: linear-gradient(135deg, #2563eb, #0ea5e9);
            color: #fff;
            font-weight: 700;
            font-size: 0.98rem;
            cursor: pointer;
            box-shadow: 0 10px 25px rgba(37, 99, 235, 0.28);
            transition: transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease;
          }

          .evidence-button:hover:enabled {
            transform: translateY(-1px);
            box-shadow: 0 14px 30px rgba(37, 99, 235, 0.34);
          }

          .evidence-button:disabled {
            cursor: wait;
            opacity: 0.7;
          }

          @media (max-width: 640px) {
            :global(.modal-content) {
              width: min(96vw, 900px);
              max-height: 92vh;
              border-radius: 18px;
            }

            :global(.modal-body) {
              padding: 1rem;
            }

            .claim-modal-hero {
              flex-direction: column;
              align-items: flex-start;
            }

            .claim-modal-title {
              font-size: 1.35rem;
            }

            .claim-detail-grid {
              grid-template-columns: 1fr;
            }

            .claim-modal-actions {
              justify-content: stretch;
              bottom: -1rem;
            }

            .evidence-button {
              width: 100%;
            }
          }
        `}</style>
      </div>
    </PassengerLayout>
  )
}
