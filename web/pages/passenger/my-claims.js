import { useState, useEffect } from 'react'
import PassengerLayout from '../../components/layouts/PassengerLayout'

export default function MyClaims() {
  const [flights, setFlights] = useState([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState(null)

  useEffect(() => {
    // Load registered flights from localStorage (temporary until we have proper user accounts)
    const registeredFlights = localStorage.getItem('registeredFlights')
    if (registeredFlights) {
      setFlights(JSON.parse(registeredFlights))
    }
    setLoading(false)
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
