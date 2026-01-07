import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Nav from '../components/Nav'

export default function Airline(){
  const router = useRouter()
  useEffect(() => {
    if (typeof window === 'undefined') return
    const user = JSON.parse(localStorage.getItem('user') || 'null')
    if (!user) return router.push('/login')
    if (user.role !== 'airline') return router.push(user.role === 'passenger' ? '/passenger' : '/login')
  }, [router])

  const [claims] = useState([{
    id: 'BA249', traveler: '0xabc...123', escrow: '0.01', delayed: true
  }])

  const accept = (id) => alert(`Accept claim ${id} (stub)`)
  const deny = (id) => alert(`Deny claim ${id} — evidence upload stub`)

  return (
    <div className="container">
      <Nav />
      <main>
        <h1>Airline - Review Delayed Claims</h1>
        <p>List of claims exceeding 3-hour delay (placeholder data):</p>
        <ul>
          {claims.map(c => (
            <li key={c.id} className="claim">
              <strong>{c.id}</strong> — traveler: {c.traveler} — escrow: {c.escrow} ETH
              <div className="actions">
                <button onClick={() => accept(c.id)}>Accept</button>
                <button onClick={() => deny(c.id)}>Deny & Upload Evidence</button>
              </div>
            </li>
          ))}
        </ul>
      </main>
    </div>
  )
}
