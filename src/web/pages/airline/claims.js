import { useEffect, useMemo, useState } from 'react'
import AirlineLayout from '../../components/layouts/AirlineLayout'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import Input from '../../components/ui/Input'
import { airlineDecideFlight } from '../../utils/contract'

async function sha256Bytes32Hex(text) {
  const encoder = new TextEncoder()
  const data = encoder.encode(text)
  const digest = await crypto.subtle.digest('SHA-256', data)
  const bytes = Array.from(new Uint8Array(digest))
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('')
  // bytes32 is 32 bytes = 64 hex chars
  return `0x${hex}`
}

function formatDate(value) {
  try {
    if (!value) return ''
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString()
  } catch {
    return ''
  }
}

/* ── tiny helpers ── */
function badge(status) {
  const map = {
    awaiting_decision: { label: 'Awaiting Decision', cls: 'badge-warning' },
    accepted:          { label: 'Accepted',          cls: 'badge-success' },
    rejected:          { label: 'Rejected',          cls: 'badge-error' },
    registered:        { label: 'Registered',        cls: 'badge-info' },
    landed_on_time:    { label: 'On Time',           cls: 'badge-muted' },
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [flights, setFlights] = useState([])
  const [rejectEvidenceText, setRejectEvidenceText] = useState('')
  const [rejectEvidenceUrl, setRejectEvidenceUrl] = useState('')
  const [activeFlightId, setActiveFlightId] = useState('')

  const activeFlight = useMemo(
    () => flights.find((f) => f.flight_id === activeFlightId) || null,
    [flights, activeFlightId]
  )

  async function refresh() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/airline/claims')
      const data = await res.json().catch(() => null)
      if (!res.ok || !data?.ok) {
        throw new Error(data?.error || 'Failed to load claims')
      }
      setFlights(Array.isArray(data.flights) ? data.flights : [])
    } catch (err) {
      setError(err.message || 'Failed to load claims')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function decide({ flightId, decision }) {
    setError('')
    setSuccess('')
    setLoading(true)

    try {
      if (!flightId) throw new Error('Missing flightId')

      const accept = decision === 'accepted'
      let evidence = null
      let evidenceHash = null

      if (!accept) {
        const description = (rejectEvidenceText || '').trim()
        const url = (rejectEvidenceUrl || '').trim()
        if (!description && !url) {
          throw new Error('Evidence is required when rejecting')
        }

        evidence = { description: description || null, url: url || null }
        evidenceHash = await sha256Bytes32Hex(JSON.stringify(evidence))
      }

      // 1) Record the decision on-chain (MetaMask)
      const onChain = await airlineDecideFlight({ flightId, accept, evidenceHash })

      // 2) Persist decision + evidence in DB
      const apiRes = await fetch('/api/airline/claims/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flightId,
          decision,
          evidence,
          txHash: onChain.transactionHash,
          chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 31337),
          contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || null,
        }),
      })

      const apiData = await apiRes.json().catch(() => null)
      if (!apiRes.ok || !apiData?.ok) {
        throw new Error(apiData?.error || 'On-chain decision succeeded, but DB update failed')
      }

      setSuccess(`Decision recorded for ${flightId} (${decision}).`)
      setRejectEvidenceText('')
      setRejectEvidenceUrl('')
      setActiveFlightId('')
      await refresh()
    } catch (err) {
      setError(err.message || 'Failed to record decision')
    } finally {
      setLoading(false)
    }
  }

  return (
    <AirlineLayout>
      <h1>Manage Claims</h1>

      {error && <Alert type="error" message={error} onClose={() => setError('')} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center' }}>
          <h2 style={{ margin: 0 }}>Flights Awaiting Decision</h2>
          <Button variant="secondary" onClick={refresh} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </Button>
        </div>

        {flights.length === 0 ? (
          <p style={{ marginTop: 'var(--space-lg)' }}>No flights are awaiting a decision.</p>
        ) : (
          <div style={{ marginTop: 'var(--space-lg)', display: 'grid', gap: '12px' }}>
            {flights.map((f) => (
              <div
                key={f.flight_id}
                style={{
                  border: '1px solid var(--gray-200)',
                  borderRadius: 'var(--radius-md)',
                  padding: 'var(--space-md)',
                  background: 'var(--bg-secondary)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{f.flight_id}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                      {f.origin} → {f.destination} · Delay: {f.delay_minutes ?? '?'} minutes
                    </div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>
                      Scheduled arrival: {formatDate(f.scheduled_arrival_at)}
                      {f.actual_arrival_at ? ` · Actual: ${formatDate(f.actual_arrival_at)}` : ''}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Button
                      variant="primary"
                      disabled={loading}
                      onClick={() => decide({ flightId: f.flight_id, decision: 'accepted' })}
                    >
                      Accept
                    </Button>
                    <Button
                      variant="danger"
                      disabled={loading}
                      onClick={() => setActiveFlightId(f.flight_id)}
                    >
                      Reject
                    </Button>
                  </div>
                </div>

                {f.decision ? (
                  <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    Decision already recorded: {f.decision.decision} ({f.decision.tx_hash?.slice(0, 10)}…)
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>

      {activeFlight ? (
        <Card>
          <h2 style={{ marginTop: 0 }}>Reject Flight: {activeFlight.flight_id}</h2>
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
              Evidence Description (required if no URL)
              <textarea
                value={rejectEvidenceText}
                onChange={(e) => setRejectEvidenceText(e.target.value)}
                placeholder="e.g. Weather diversion / ATC restriction / force majeure"
                className="input-field"
                rows={4}
              />
            </label>

            <div style={{ display: 'flex', gap: '8px', marginTop: 'var(--space-md)' }}>
              <Button
                variant="danger"
                disabled={loading}
                onClick={() => decide({ flightId: activeFlight.flight_id, decision: 'rejected' })}
              >
                Confirm Reject
              </Button>
              <Button variant="secondary" disabled={loading} onClick={() => setActiveFlightId('')}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      ) : null}
    </AirlineLayout>
  )
}
