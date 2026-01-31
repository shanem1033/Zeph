import { useState, useEffect } from 'react'
import PassengerLayout from '../../components/layouts/PassengerLayout'
import { requestCompensation } from '../../utils/contract'

export default function MyClaims() {
  const [flights, setFlights] = useState([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [pendingClaims, setPendingClaims] = useState(new Set())

  useEffect(() => {
    // Load registered flights from localStorage
    const registeredFlights = localStorage.getItem('registeredFlights')
    if (registeredFlights) {
      setFlights(JSON.parse(registeredFlights))
    }

    // Load pending claims from localStorage
    const pending = localStorage.getItem('pendingClaims')
    if (pending) {
      setPendingClaims(new Set(JSON.parse(pending)))
    }
  }, [])

  const handleRequestCompensation = async (flightId) => {
    setLoading(true)
    try {
      const result = await requestCompensation(flightId)

      // Add to pending claims after successful transaction
      const updated = new Set([...pendingClaims, flightId])
      setPendingClaims(updated)
      localStorage.setItem('pendingClaims', JSON.stringify(Array.from(updated)))

      setMessage({
        type: 'success',
        text: `Compensation requested for flight ${flightId}`
      })
    } catch (error) {
      setMessage({
        type: 'error',
        text: error.message || 'Failed to request compensation'
      })
    } finally {
      setLoading(false)
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

        {flights.length === 0 ? (
          <p>No registered flights</p>
        ) : (
          <div className="flights-table">
            <table>
              <thead>
                <tr>
                  <th>Flight ID</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {flights.map(flight => (
                  <tr key={flight.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {flight.flightId}
                      </div>
                    </td>
                    <td>
                      {pendingClaims.has(flight.flightId) ? (
                        <span className="status-badge pending">⏳ Pending</span>
                      ) : (
                        <button
                          onClick={() => handleRequestCompensation(flight.flightId)}
                          disabled={loading}
                          className="btn btn-primary"
                        >
                          {loading ? 'Processing...' : 'Request Compensation'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
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

          .status-badge.pending {
            background: rgba(245, 158, 11, 0.2);
            color: #f59e0b;
            border: 1px solid #f59e0b;
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

          .btn {
            padding: 0.5rem 1rem;
            border-radius: 6px;
            font-size: 0.9rem;
            cursor: pointer;
            transition: all 0.3s ease;
            border: none;
            font-weight: 500;
          }

          .btn-primary {
            background: var(--primary-color);
            color: white;
          }

          .btn-primary:hover:not(:disabled) {
            background: var(--primary-hover);
          }

          .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
        `}</style>
      </div>
    </PassengerLayout>
  )
}
