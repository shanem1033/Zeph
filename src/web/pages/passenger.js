import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Nav from '../components/Nav'

export default function Passenger() {
  const [flightId, setFlightId] = useState('')
  const [escrow, setEscrow] = useState('')
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined') return
    const user = JSON.parse(localStorage.getItem('user') || 'null')
    if (!user) return router.push('/login')
    if (user.role !== 'passenger') return router.push(user.role === 'airline' ? '/airline' : '/login')
  }, [router])

  const register = (e) => {
    e.preventDefault()
    // TODO: wire to web3 / contract
    alert(`Register flight: ${flightId} with escrow ${escrow} ETH (stub)`)
  }

  return (
    <div className="container">
      <Nav />
      <main>
        <h1>Passenger — Register Flight</h1>
        <form onSubmit={register} className="form">
          <label>Flight ID
            <input value={flightId} onChange={(e)=>setFlightId(e.target.value)} placeholder="e.g. BA249" />
          </label>
          <label>Escrow (ETH)
            <input value={escrow} onChange={(e)=>setEscrow(e.target.value)} placeholder="0.01" />
          </label>
          <button type="submit">Register (stub)</button>
        </form>

        <section>
          <h2>Your claims</h2>
          <p>Claim status will appear here once connected to the contract.</p>
        </section>
      </main>
    </div>
  )
}
