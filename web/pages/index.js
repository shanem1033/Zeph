import Link from 'next/link'
import PublicLayout from '../components/layouts/PublicLayout'

export default function Home() {
  return (
    <PublicLayout>
      <main>
        <h1>Welcome to Zeph</h1>
        <h2>Simple Flight Compensation System</h2>
        <p>Zeph is a blockchain-based flight compensation platform that automates claim processing for delayed flights.</p>
        
        <section style={{ marginTop: '32px' }}>
          <h3>Key Features:</h3>
          <ul>
            <li>Automated flight delay verification</li>
            <li>Smart contract-based escrow system</li>
            <li>Transparent claim processing</li>
            <li>Instant compensation for eligible delays</li>
          </ul>
        </section>

        <div style={{ marginTop: '32px', display: 'flex', gap: '16px' }}>
          <Link href="/login">
            <button className="btn btn-primary">Login</button>
          </Link>
          <Link href="/create-account">
            <button className="btn btn-secondary">Create Account</button>
          </Link>
        </div>
      </main>
    </PublicLayout>
  )
}
