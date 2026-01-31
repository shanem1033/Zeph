import Link from 'next/link'
import PublicLayout from '../components/layouts/PublicLayout'

export default function Home() {
  return (
    <PublicLayout>
      <div className="container">
        {/* Hero Section */}
        <section className="hero">
          <h1 className="hero-title">Welcome to Zeph</h1>
          <h2 className="hero-subtitle">Blockchain-Powered Flight Compensation</h2>
          <p className="hero-description">
            Experience a revolutionary approach to flight delay compensation.
            Transparent, automated, and fair.
            Powered by blockchain technology.
          </p>
          <div className="hero-actions">
            <Link href="/create-account">
              <button className="btn btn-primary btn-lg">Create Account</button>
            </Link>
            <Link href="/login">
              <button className="btn btn-outline btn-lg">Log In</button>
            </Link>
            <Link href="/book-flight">
              <button className="btn btn-secondary btn-lg">Book a Flight</button>
            </Link>
          </div>
        </section>

        {/* Features Section */}
        <section className="features-section">
          <h2 className="section-title">Why Choose Zeph?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">⚡</div>
              <h3 className="feature-title">Fast Processing</h3>
              <p className="feature-description">
                No more waiting months for compensation. Airline have 1 week to make a
                decision on you claim. If they don't respond, you get paid automatically.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">🔒</div>
              <h3 className="feature-title">Blockchain Security</h3>
              <p className="feature-description">
                Your funds are protected by Ethereum smart contracts. Transparent,
                immutable, and secure.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">✈️</div>
              <h3 className="feature-title">Automated Verification</h3>
              <p className="feature-description">
                Flight delay data is verified through oracle services. No manual
                claims process required.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">⚖️</div>
              <h3 className="feature-title">Fair Compensation</h3>
              <p className="feature-description">
                Get the compensation you deserve based on transparent, predefined
                rules coded into the smart contract. Which align with EU regulations.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">👀</div>
              <h3 className="feature-title">Full Transparency</h3>
              <p className="feature-description">
                Track your claims in real-time. Every transaction is recorded on
                the blockchain for complete transparency.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">⛱️</div>
              <h3 className="feature-title">European Coverage</h3>
              <p className="feature-description">
                Register flights from any airline and any route within Europe.
              </p>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="features-section">
          <h2 className="section-title">How It Works</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">1️⃣</div>
              <h3 className="feature-title">Register Your Flight</h3>
              <p className="feature-description">
                Create an account and register your flight before departure.
                Using your flight details. Simple and quick.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">2️⃣</div>
              <h3 className="feature-title">Automatic Monitoring</h3>
              <p className="feature-description">
                Our oracle system monitors your flight status in real-time
                for any delays.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">3️⃣</div>
              <h3 className="feature-title"> Compensation</h3>
              <p className="feature-description">
                Receive compensation within a week of your flight's scheduled arrival.
              </p>
            </div>

            <div className="feature-card">
              <div className="feature-icon">4️⃣</div>
              <h3 className="feature-title">Dispute Resolution</h3>
              <p className="feature-description">
                If your claim is rejected and you disagree, you can easily
                escalate the dispute to the relevant authorities using our built-in evidence
                collection system.
              </p>
            </div>
          </div>
        </section>

        <section className="hero" style={{ marginTop: 'var(--space-3xl)' }}>
          <h2 className="hero-subtitle">Ready to Get Started?</h2>
          <p className="hero-description">
            Join thousands of travelers who have streamlined their flight compensation process.
          </p>
          <div className="hero-actions">
            <Link href="/create-account">
              <button className="btn btn-primary btn-lg">Create Account</button>
            </Link>
          </div>
        </section>
      </div>
    </PublicLayout>
  )
}

