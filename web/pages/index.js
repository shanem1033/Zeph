import Link from 'next/link'
import Nav from '../components/Nav'

export default function Home() {
  return (
    <div className="container">
      <Nav />
      <main>
        <h1>Simple Flight Compensation — Demo UI</h1>
        <p>Please <Link href="/login">login</Link> or <Link href="/create-user">create an account</Link> to continue.</p>
      </main>
    </div>
  )
}
