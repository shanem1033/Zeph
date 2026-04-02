import { useState, useEffect, useCallback, useMemo } from 'react'
import AirlineLayout from '../../components/layouts/AirlineLayout'
import Alert from '../../components/ui/Alert'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import { airlineDecideFlight } from '../../utils/contract'
import { useAuth } from '../../context/AuthContext'
import { getAirlineCodeFromEmail } from '../../utils/auth'
import { supabase } from '../../utils/supabaseClient'
import {
  filterFlightsByFlightCode,
  formatClaimDateTime,
  getAutoAcceptDeadlineFromDelayReport,
} from '../../utils/claimUi'

async function sha256Bytes32Hex(text) {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = Array.from(new Uint8Array(digest))
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
  return `0x${hex}`
}

/* ── tiny helpers ── */
function badge(status) {
  const map = {
    awaiting_decision: { label: 'Awaiting Decision', cls: 'badge-warning' },
    accepted: { label: 'Accepted', cls: 'badge-success' },
    rejected: { label: 'Rejected', cls: 'badge-error' },
    registered: { label: 'Registered', cls: 'badge-info' },
    landed_on_time: { label: 'On Time', cls: 'badge-muted' },
  }
  const b = map[status] || { label: status || 'N/A', cls: 'badge-muted' }
  return <span className={`claim-badge ${b.cls}`}>{b.label}</span>
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('en-IE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function delayLabel(mins) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

/* ── page ── */
export default function AirlineClaims() {
  const { user } = useAuth()
  const airlineCode = getAirlineCodeFromEmail(user?.email)

  const [claims, setClaims] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [deciding, setDeciding] = useState(null) // flightId being decided
  const [filter, setFilter] = useState('all') // all | awaiting | accepted | rejected

  // Reject evidence state
  const [rejectFlightId, setRejectFlightId] = useState('')
  const [rejectEvidenceText, setRejectEvidenceText] = useState('')
  const [rejectEvidenceUrl, setRejectEvidenceUrl] = useState('')
  const [rejectPdfFile, setRejectPdfFile] = useState(null)
  const [uploadProgress, setUploadProgress] = useState('')

  const fetchClaims = useCallback(async () => {
    try {
      setLoading(true)
      setError('')
      const params = airlineCode ? `?airlineCode=${airlineCode}` : ''
      const res = await fetch(`/api/flights/claims${params}`)
      const json = await res.json()
      if (!json.ok) throw new Error(json.error)
      setClaims(json.claims)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [airlineCode])

  useEffect(() => { fetchClaims() }, [fetchClaims])

  /* On-chain + DB decision for all passengers on a flight */
  async function decide({ flightId, decision }) {
    setError('')
    setSuccess('')
    setDeciding(flightId)

    try {
      if (!flightId) throw new Error('Missing flightId')

      const accept = decision === 'accepted'
      let evidence = null
      let evidenceHash = null

      let rejectionReportPath = null

      if (!accept) {
        const description = (rejectEvidenceText || '').trim()
        const url = (rejectEvidenceUrl || '').trim()
        if (!description && !url && !rejectPdfFile) {
          throw new Error('Evidence is required when rejecting (provide a description, URL, or PDF report)')
        }

        // Upload PDF report if provided
        if (rejectPdfFile) {
          setUploadProgress('Uploading rejection report…')
          const formData = new FormData()
          formData.append('file', rejectPdfFile)
          formData.append('flightId', flightId)

          const uploadRes = await fetch('/api/airline/claims/upload-report', {
            method: 'POST',
            body: formData,
          })
          const uploadData = await uploadRes.json().catch(() => null)
          if (!uploadRes.ok || !uploadData?.ok) {
            throw new Error(uploadData?.error || 'Failed to upload rejection report')
          }
          rejectionReportPath = uploadData.storagePath
          setUploadProgress('')
        }

        evidence = {
          description: description || null,
          url: url || null,
          rejectionReportPath: rejectionReportPath || null,
        }
        evidenceHash = await sha256Bytes32Hex(JSON.stringify(evidence))
      }

      // 1) Persist decision + evidence in DB first so the dashboard updates immediately
      let txHash = null
      let chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 31337)

      // 2) Attempt on-chain recording with a timeout so it cannot hang forever
      try {
        const CHAIN_TIMEOUT_MS = 60_000 // 60 s – enough for MetaMask interaction
        const onChain = await Promise.race([
          airlineDecideFlight({ flightId, accept, evidenceHash }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('On-chain call timed out after 60 s')), CHAIN_TIMEOUT_MS)
          ),
        ])
        txHash = onChain.transactionHash
      } catch (chainErr) {
        console.warn('On-chain decision skipped/failed (DB will still be updated):', chainErr.message)
      }

      console.log('[reject] Calling /api/airline/claims/decide with:', { flightId, decision, evidence, rejectionReportPath, txHash })
      const apiRes = await fetch('/api/airline/claims/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flightId,
          decision,
          evidence,
          rejectionReportPath,
          txHash,
          chainId,
          contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || null,
        }),
      })

      const apiData = await apiRes.json().catch(() => null)
      console.log('[reject] API response:', apiRes.status, apiData)
      if (!apiRes.ok || !apiData?.ok) {
        throw new Error(apiData?.error || 'DB update failed – check console for details')
      }

      setSuccess(`Decision recorded for ${flightId} (${decision}).`)
      setRejectFlightId('')
      setRejectEvidenceText('')
      setRejectEvidenceUrl('')
      setRejectPdfFile(null)
      setUploadProgress('')
      await fetchClaims()
    } catch (err) {
      setError(err.message || 'Failed to record decision')
    } finally {
      setDeciding(null)
    }
  }

  /* ── filter logic ── */
  const filtered = claims
    .map((flight) => {
      if (filter === 'all') return flight
      const passengers = flight.passengers.filter((p) => {
        const cs = p.registration?.claim_status
        if (filter === 'awaiting') return cs === 'awaiting_decision'
        if (filter === 'accepted') return cs === 'accepted'
        if (filter === 'rejected') return cs === 'rejected'
        return true
      })
      return { ...flight, passengers }
    })
    .filter((flight) => filter === 'all' || flight.passengers.length > 0)

  const visibleFlights = useMemo(() => {
    if (filter !== 'all') return filtered
    return filterFlightsByFlightCode(filtered, flightCodeSearch)
  }, [filter, filtered, flightCodeSearch])

  /* ── stats ── */
  const allPassengers = claims.flatMap((f) => f.passengers)
  const stats = {
    total: allPassengers.length,
    awaiting: allPassengers.filter((p) => p.registration?.claim_status === 'awaiting_decision').length,
    accepted: allPassengers.filter((p) => p.registration?.claim_status === 'accepted').length,
    rejected: allPassengers.filter((p) => p.registration?.claim_status === 'rejected').length,
    delayedFlights: claims.length,
  }

  /* Does this flight have any passengers awaiting a decision? */
  const hasAwaiting = (flight) =>
    flight.passengers.some((p) => p.registration?.claim_status === 'awaiting_decision')

  return (
    <AirlineLayout>
      <div className="claims-page">
        <div className="claims-header">
          <h1>Compensation Claims</h1>
          <p className="claims-subtitle">
            Manage passenger compensation claims for delayed flights
          </p>
        </div>

        {error && <Alert type="error" message={error} onClose={() => setError('')} />}
        {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}

        {/* Stats row */}
        <div className="claims-stats">
          <div className="stat-card">
            <span className="stat-value">{stats.delayedFlights}</span>
            <span className="stat-label">Delayed Flights</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">Total Passengers</span>
          </div>
          <div className="stat-card stat-warning">
            <span className="stat-value">{stats.awaiting}</span>
            <span className="stat-label">Awaiting Decision</span>
          </div>
          <div className="stat-card stat-success">
            <span className="stat-value">{stats.accepted}</span>
            <span className="stat-label">Accepted</span>
          </div>
          <div className="stat-card stat-error">
            <span className="stat-value">{stats.rejected}</span>
            <span className="stat-label">Rejected</span>
          </div>
        </div>

        {/* Filters */}
        <div className="claims-filters">
          {['all', 'awaiting', 'accepted', 'rejected'].map((f) => (
            <button
              key={f}
              className={`filter-btn ${filter === f ? 'active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {f === 'all' ? 'All' : f === 'awaiting' ? 'Awaiting Decision' : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
          <button className="filter-btn refresh-btn" onClick={fetchClaims} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {filter === 'all' && (
          <div className="search-panel">
            <label className="search-label" htmlFor="flight-code-search">Search by flight ID</label>
            <input
              id="flight-code-search"
              type="text"
              className="search-input"
              placeholder="e.g. FR340"
              value={flightCodeSearch}
              onChange={(e) => setFlightCodeSearch(e.target.value)}
            />
          </div>
        )}

        {/* Loading */}
        {loading && <p className="claims-loading">Loading claims…</p>}

        {/* Empty state */}
        {!loading && visibleFlights.length === 0 && (
          <div className="claims-empty">
            <span className="empty-icon">📋</span>
            <h3>No claims found</h3>
            <p>
              {filter === 'all' && flightCodeSearch.trim()
                ? `No flights match the flight ID "${flightCodeSearch.trim()}".`
                : filter === 'all'
                  ? 'There are no delayed flights with passengers in the system.'
                  : `No claims with "${filter}" status.`}
            </p>
          </div>
        )}

        {/* Claims list */}
        {!loading && visibleFlights.map((flight) => (
          <div key={flight.flight_id} className="flight-claim-card">
            <div className="flight-claim-header">
              <div className="flight-route">
                <span className="flight-code">{flight.flight_code}</span>
                <span className="route-text">
                  {flight.origin} → {flight.destination}
                </span>
              </div>
              <div className="flight-delay">
                <span className="delay-value">{delayLabel(flight.delay_minutes)}</span>
                <span className="delay-label">delay</span>
              </div>
            </div>

            <div className="flight-claim-times">
              <div className="time-item">
                <span className="time-label">Scheduled Departure</span>
                <span className="time-value">{fmtDate(flight.scheduled_departure)}</span>
              </div>
              <div className="time-item">
                <span className="time-label">Scheduled Arrival</span>
                <span className="time-value">{fmtDate(flight.scheduled_arrival)}</span>
              </div>
              <div className="time-item">
                <span className="time-label">Actual Arrival</span>
                <span className="time-value highlight">{fmtDate(flight.actual_arrival)}</span>
              </div>
            </div>

            {hasAwaiting(flight) && (
              <div className="auto-accept-deadline">
                Auto-accept deadline:{' '}
                <strong>
                  {formatClaimDateTime(getAutoAcceptDeadlineFromDelayReport(flight.actual_arrival))}
                </strong>
              </div>
            )}

            {/* Passengers */}
            {flight.passengers.length === 0 ? (
              <p className="no-passengers">No passengers booked on this flight.</p>
            ) : (
              <div className="passengers-table-wrap">
                <table className="passengers-table">
                  <thead>
                    <tr>
                      <th>Passenger</th>
                      <th>Passport</th>
                      <th>Registered on Zeph</th>
                      <th>Claim Status</th>
                      <th>Evidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flight.passengers.map((p) => {
                      const reg = p.registration
                      const claimStatus = reg?.claim_status
                      return (
                        <tr key={p.booking_ref}>
                          <td>{p.passenger_email || p.passenger_name || '—'}</td>
                          <td className="mono">{p.passport_number || '—'}</td>
                          <td>{reg ? 'Yes' : 'No'}</td>
                          <td>{reg ? badge(claimStatus) : <span className="text-muted">Not registered</span>}</td>
                          <td>
                            {reg ? (
                              <button
                                className="evidence-dl-btn"
                                disabled={evidenceLoading === p.booking_ref}
                                onClick={() => downloadEvidenceReport(p.booking_ref)}
                              >
                                {evidenceLoading === p.booking_ref ? 'Generating…' : 'Download'}
                              </button>
                            ) : '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Flight-level decision buttons (applies to all passengers) */}
            {hasAwaiting(flight) && (
              <div className="flight-actions">
                <Button
                  variant="primary"
                  disabled={!!deciding}
                  onClick={() => decide({ flightId: flight.flight_id, decision: 'accepted' })}
                >
                  {deciding === flight.flight_id ? 'Processing…' : 'Accept'}
                </Button>
                <Button
                  variant="danger"
                  disabled={!!deciding}
                  onClick={() => setRejectFlightId(flight.flight_id)}
                >
                  Reject
                </Button>
              </div>
            )}

            <div className="flight-claim-footer">
              <span className="flight-id-label">Flight ID: {flight.flight_id}</span>
            </div>
          </div>
        ))}

        {/* Reject evidence modal */}
        {rejectFlightId && (
          <div className="reject-overlay" onClick={() => setRejectFlightId('')}>
            <div className="reject-card" onClick={(e) => e.stopPropagation()}>
              <h2 style={{ marginTop: 0 }}>Reject Flight: {rejectFlightId}</h2>
              {error && (
                <div style={{ background: 'var(--error-bg, #fef2f2)', border: '1px solid var(--error-color, #dc2626)', borderRadius: 'var(--radius-md, 6px)', padding: '0.75rem 1rem', marginBottom: '1rem', color: 'var(--error-color, #dc2626)', fontSize: '0.9rem' }}>
                  <strong>Error:</strong> {error}
                </div>
              )}
              <p style={{ color: 'var(--text-secondary)' }}>
                Rejection requires evidence. This decision will apply to every passenger on the flight.
              </p>

              <div className="form">
                <Input
                  label="Evidence URL (optional)"
                  value={rejectEvidenceUrl}
                  onChange={(e) => setRejectEvidenceUrl(e.target.value)}
                  placeholder="https://..."
                />

                <label className="input-label">
                  Evidence Description (required if no URL or PDF)
                  <textarea
                    value={rejectEvidenceText}
                    onChange={(e) => setRejectEvidenceText(e.target.value)}
                    placeholder="e.g. Weather diversion / ATC restriction / force majeure"
                    className="input-field"
                    rows={4}
                  />
                </label>

                <label className="input-label">
                  Rejection Report (PDF, max 10 MB)
                  <input
                    type="file"
                    accept="application/pdf"
                    className="input-field file-input"
                    onChange={(e) => setRejectPdfFile(e.target.files?.[0] || null)}
                  />
                </label>
                {rejectPdfFile && (
                  <p className="file-hint">
                    Selected: {rejectPdfFile.name} ({(rejectPdfFile.size / 1024).toFixed(0)} KB)
                  </p>
                )}
                {uploadProgress && <p className="upload-progress">{uploadProgress}</p>}

                <div style={{ display: 'flex', gap: '8px', marginTop: 'var(--space-md)' }}>
                  <Button
                    variant="danger"
                    disabled={!!deciding}
                    onClick={() => decide({ flightId: rejectFlightId, decision: 'rejected' })}
                  >
                    {deciding ? 'Processing…' : 'Confirm Reject'}
                  </Button>
                  <Button variant="secondary" disabled={!!deciding} onClick={() => setRejectFlightId('')}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .claims-page {
          max-width: 1100px;
          margin: 0 auto;
        }
        .claims-header h1 {
          margin: 0 0 0.25rem;
          font-size: 1.75rem;
        }
        .claims-subtitle {
          color: var(--text-muted);
          margin: 0 0 1.5rem;
        }

        /* ── Stats ── */
        .claims-stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
          gap: var(--space-md);
          margin-bottom: var(--space-lg);
        }
        .stat-card {
          background: var(--bg-secondary);
          border: 1px solid var(--gray-200);
          border-radius: var(--radius-lg);
          padding: var(--space-md);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
        }
        .stat-value { font-size: 1.75rem; font-weight: 700; }
        .stat-label {
          font-size: 0.8rem; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.5px;
        }
        .stat-warning .stat-value { color: var(--warning-color); }
        .stat-success .stat-value { color: var(--success-color); }
        .stat-error   .stat-value { color: var(--error-color); }

        /* ── Filters ── */
        .claims-filters {
          display: flex; gap: var(--space-sm);
          margin-bottom: var(--space-lg); flex-wrap: wrap;
        }
        .filter-btn {
          padding: 0.5rem 1rem; border-radius: var(--radius-md);
          border: 1px solid var(--gray-200); background: var(--bg-secondary);
          color: var(--text-secondary); cursor: pointer;
          font-size: 0.875rem; font-weight: 500; transition: all 0.2s;
        }
        .filter-btn:hover { background: var(--bg-tertiary); color: var(--text-primary); }
        .filter-btn.active {
          background: var(--primary-color);
          border-color: var(--primary-color); color: #fff;
        }
        .refresh-btn { margin-left: auto; }

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
          border-color: var(--primary-color);
          box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
        }

        /* ── Loading / Empty ── */
        .claims-loading { color: var(--text-muted); text-align: center; padding: 3rem 0; }
        .claims-empty { text-align: center; padding: 3rem 1rem; color: var(--text-muted); }
        .empty-icon { font-size: 3rem; display: block; margin-bottom: 0.5rem; }
        .claims-empty h3 { margin: 0 0 0.25rem; color: var(--text-secondary); }

        /* ── Flight claim card ── */
        .flight-claim-card {
          background: var(--bg-secondary); border: 1px solid var(--gray-200);
          border-radius: var(--radius-lg); margin-bottom: var(--space-lg); overflow: hidden;
        }
        .flight-claim-header {
          display: flex; justify-content: space-between; align-items: center;
          padding: var(--space-md) var(--space-lg);
          background: var(--bg-tertiary); border-bottom: 1px solid var(--gray-200);
        }
        .flight-route { display: flex; align-items: center; gap: var(--space-md); }
        .flight-code { font-weight: 700; font-size: 1.15rem; color: var(--primary-color); }
        .route-text { color: var(--text-secondary); font-size: 0.95rem; }
        .flight-delay { display: flex; flex-direction: column; align-items: flex-end; }
        .delay-value { font-weight: 700; font-size: 1.25rem; color: var(--error-color); }
        .delay-label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; }

        /* ── Times ── */
        .flight-claim-times {
          display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: var(--space-md); padding: var(--space-md) var(--space-lg);
          border-bottom: 1px solid var(--gray-200);
        }
        .time-item { display: flex; flex-direction: column; gap: 2px; }
        .time-label {
          font-size: 0.75rem; color: var(--text-muted);
          text-transform: uppercase; letter-spacing: 0.3px;
        }
        .time-value { font-size: 0.9rem; }
        .time-value.highlight { color: var(--error-color); font-weight: 600; }

        .auto-accept-deadline {
          margin: 0 var(--space-lg) var(--space-sm);
          padding: 0.65rem 0.85rem;
          border-radius: var(--radius-md);
          background: var(--warning-bg);
          color: var(--warning-color);
          font-size: 0.88rem;
          border: 1px solid rgba(245, 158, 11, 0.35);
        }

        /* ── Passengers table ── */
        .passengers-table-wrap { overflow-x: auto; padding: var(--space-md) var(--space-lg); }
        .passengers-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
        .passengers-table th {
          text-align: left; padding: 0.6rem 0.75rem; color: var(--text-muted);
          font-weight: 600; font-size: 0.75rem; text-transform: uppercase;
          letter-spacing: 0.4px; border-bottom: 1px solid var(--gray-200);
        }
        .passengers-table td {
          padding: 0.75rem; border-bottom: 1px solid var(--gray-200); vertical-align: middle;
        }
        .passengers-table tr:last-child td { border-bottom: none; }
        .mono { font-family: var(--font-mono); font-size: 0.8rem; }
        .text-muted { color: var(--text-muted); font-size: 0.85rem; }
        .no-passengers { color: var(--text-muted); padding: var(--space-md) var(--space-lg); font-style: italic; }
        .evidence-dl-btn {
          padding: 0.25rem 0.65rem; font-size: 0.8rem; font-weight: 500;
          border: 1px solid var(--primary-color); border-radius: var(--radius-md);
          background: transparent; color: var(--primary-color); cursor: pointer;
          transition: all 0.15s;
        }
        .evidence-dl-btn:hover:not(:disabled) { background: var(--primary-color); color: #fff; }
        .evidence-dl-btn:disabled { opacity: 0.55; cursor: not-allowed; }

        /* ── Badges ── */
        .claim-badge {
          display: inline-block; padding: 0.2rem 0.6rem;
          border-radius: var(--radius-full); font-size: 0.75rem;
          font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;
        }
        .badge-warning { background: var(--warning-bg); color: var(--warning-color); }
        .badge-success { background: var(--success-bg); color: var(--success-color); }
        .badge-error   { background: var(--error-bg);   color: var(--error-color); }
        .badge-info    { background: var(--info-bg);     color: var(--info-color); }
        .badge-muted   { background: var(--gray-200);    color: var(--text-muted); }

        /* ── Flight-level actions ── */
        .flight-actions {
          display: flex; gap: var(--space-sm);
          padding: var(--space-md) var(--space-lg);
          border-top: 1px solid var(--gray-200);
        }

        /* ── Footer ── */
        .flight-claim-footer {
          padding: var(--space-sm) var(--space-lg);
          border-top: 1px solid var(--gray-200);
        }
        .flight-id-label { font-size: 0.75rem; color: var(--text-muted); font-family: var(--font-mono); }

        /* ── Reject overlay ── */
        .reject-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,0.6);
          backdrop-filter: blur(4px); display: flex;
          align-items: center; justify-content: center;
          z-index: 1000; padding: 1.5rem;
        }
        .reject-card {
          background: var(--bg-secondary); border: 1px solid var(--gray-200);
          border-radius: var(--radius-lg); padding: var(--space-xl);
          max-width: 540px; width: 100%;
        }
        .file-input {
          padding: 0.5rem; cursor: pointer;
        }
        .file-hint {
          font-size: 0.8rem; color: var(--text-muted); margin: 0.25rem 0 0;
        }
        .upload-progress {
          font-size: 0.85rem; color: var(--primary-color); margin: 0.5rem 0 0;
          font-weight: 500;
        }

        @media (max-width: 768px) {
          .claims-stats { grid-template-columns: repeat(2, 1fr); }
          .flight-claim-header { flex-direction: column; align-items: flex-start; gap: var(--space-sm); }
          .flight-claim-times { grid-template-columns: 1fr; }
        }
      `}</style>
    </AirlineLayout>
  )
}
