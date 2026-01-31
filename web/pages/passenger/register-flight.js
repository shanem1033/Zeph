import { useState } from 'react'
import PassengerLayout from '../../components/layouts/PassengerLayout'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import Card from '../../components/ui/Card'
import { registerFlight as registerFlightOnChain } from '../../utils/contract'

export default function RegisterFlight() {
  const [bookingRef, setBookingRef] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [txHash, setTxHash] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess(false)
    setTxHash('')
    setLoading(true)

    try {
      // Validation
      if (!bookingRef) {
        setError('Please enter your booking reference')
        setLoading(false)
        return
      }

      // 1) Verify booking reference and get the canonical flightId from DB
      const prepRes = await fetch('/api/registration/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingRef }),
      })

      const prepData = await prepRes.json().catch(() => null)
      if (!prepRes.ok || !prepData?.ok) {
        throw new Error(prepData?.error || 'Booking reference could not be verified')
      }

      const flightId = prepData.flightId
      if (!flightId) {
        throw new Error('Missing flightId from server')
      }

      // 2) Register flight on blockchain
      const result = await registerFlightOnChain(flightId)
      setTxHash(result.transactionHash)

      // 3) Mark registration confirmed in DB
      const completeRes = await fetch('/api/registration/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingRef,
          txHash: result.transactionHash,
          chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 31337),
          contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || null,
        }),
      })

      const completeData = await completeRes.json().catch(() => null)
      if (!completeRes.ok || !completeData?.ok) {
        throw new Error(completeData?.error || 'Flight registered on-chain, but failed to update database')
      }

      // Save to localStorage for My Claims page (temporary until DB-backed user/claims exists)
      const registeredFlights = JSON.parse(localStorage.getItem('registeredFlights') || '[]')
      if (!registeredFlights.find(f => f.flightId === flightId)) {
        registeredFlights.push({ id: Date.now(), flightId })
        localStorage.setItem('registeredFlights', JSON.stringify(registeredFlights))
      }

      setSuccess(true)
      setBookingRef('')
    } catch (err) {
      setError(err.message || 'Failed to register flight')
    } finally {
      setLoading(false)
    }
  }

  return (
    <PassengerLayout>
      <div className="container" style={{ maxWidth: '800px', margin: '0 auto' }}>
        <h1>Register Flight for Compensation</h1>

        {error && <Alert type="error" message={error} onClose={() => setError('')} />}
        {success && (
          <Alert
            type="success"
            message={`Flight registered successfully! ${txHash ? `Transaction: ${txHash.slice(0, 10)}...${txHash.slice(-8)}` : ''}`}
            onClose={() => setSuccess(false)}
          />
        )}

        <Card>
          <form onSubmit={handleSubmit} className="form">
            <h2 style={{ fontSize: '20px', marginBottom: 'var(--space-lg)', color: 'var(--text-primary)' }}>
              Flight Details
            </h2>

            <Input
              label="Booking Reference"
              value={bookingRef}
              onChange={(e) => setBookingRef(e.target.value)}
              placeholder="Paste the booking reference from your confirmation"
              required
              helpText="We use this to verify your booking before registering it on-chain"
            />

            <div style={{
              background: 'var(--bg-tertiary)',
              padding: 'var(--space-lg)',
              borderRadius: 'var(--radius-md)',
              marginTop: 'var(--space-lg)',
              border: '1px solid var(--gray-200)'
            }}>
              <h3 style={{ fontSize: '16px', marginBottom: 'var(--space-sm)', color: 'var(--text-primary)' }}>
                📋 Compensation Details
              </h3>
              <ul style={{
                margin: 0,
                paddingLeft: 'var(--space-lg)',
                color: 'var(--text-secondary)',
                fontSize: '14px',
                lineHeight: '1.8'
              }}>
                <li>Eligible for compensation if delayed <strong>180+ minutes</strong></li>
                <li>Claim processed automatically through smart contract</li>
                <li>You'll be notified when your flight status is verified</li>
                <li>Compensation paid instantly to your wallet if accepted by airline</li>
              </ul>
            </div>

            <Button
              type="submit"
              variant="primary"
              disabled={loading}
              style={{ marginTop: 'var(--space-xl)', width: '100%' }}
            >
              {loading ? 'Registering Flight...' : 'Register Flight'}
            </Button>
          </form>
        </Card>
      </div>
    </PassengerLayout>
  )
}

