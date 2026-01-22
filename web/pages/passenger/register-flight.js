import { useState } from 'react'
import PassengerLayout from '../../components/layouts/PassengerLayout'
import Input from '../../components/ui/Input'
import Button from '../../components/ui/Button'
import Alert from '../../components/ui/Alert'
import Card from '../../components/ui/Card'
import { registerFlight as registerFlightOnChain } from '../../utils/contract'

export default function RegisterFlight() {
  const [flightId, setFlightId] = useState('')
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
      if (!flightId) {
        setError('Please enter a flight ID')
        setLoading(false)
        return
      }

      // Register flight on blockchain
      const result = await registerFlightOnChain(flightId)
      
      setSuccess(true)
      setTxHash(result.transactionHash)
      setFlightId('')
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
              label="Flight ID"
              value={flightId}
              onChange={(e) => setFlightId(e.target.value)}
              placeholder="e.g., AA1234, BA567, EI101"
              required
              helpText="Enter your complete flight identifier"
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

