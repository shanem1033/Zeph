import PassengerLayout from '../components/layouts/PassengerLayout'

const AUTHORITIES = [
  {
    country: 'Ireland',
    city: 'Dublin',
    body: 'Irish Aviation Authority (IAA)',
    url: 'https://www.iaa.ie/consumer-protection/air-passenger-rights',
    note: 'Submit a complaint via the online form on their website.',
  },
  {
    country: 'United Kingdom',
    city: 'London',
    body: 'Civil Aviation Authority (CAA)',
    url: 'https://www.caa.co.uk/air-passengers/travel-problems-and-rights/travel-complaints/how-the-caa-can-help/',
    note: 'Use the Passenger Advice and Complaints Team (PACT) form.',
  },
  {
    country: 'France',
    city: 'Paris',
    body: 'Direction Générale de l\'Aviation Civile (DGAC)',
    url: 'https://droits-passagers-aeriens.aviation-civile.gouv.fr/public/signalement?new-signalement=true',
    note: 'File a complaint through the DGAC passenger rights portal.',
  },
  {
    country: 'Germany',
    city: 'Berlin',
    body: 'Luftfahrt-Bundesamt (LBA)',
    url: 'https://www.lba.de/EN/AirPassengersRights/Complaint_Form/Complaint_Form_node.html',
    note: 'Submit your complaint and evidence to the LBA passenger rights team.',
  },
  {
    country: 'Spain',
    city: 'Madrid',
    body: 'Agencia Estatal de Seguridad Aérea (AESA)',
    url: 'https://www.seguridadaerea.gob.es/en/ambitos/derechos-de-los-pasajeros/inicia-tu-reclamacion-con-aesa',
    note: 'Use the online complaint form on the AESA website.',
  },
  {
    country: 'Netherlands',
    city: 'Amsterdam',
    body: 'Inspectie Leefomgeving en Transport (ILT)',
    url: 'https://e-loket.ilent.nl/formulier/en-GB/defaultenvironment/MLu_005.aspx/CB_Authenticatie/CB_Inleiding',
    note: 'File a passenger rights complaint directly with the ILT.',
  },
]

const FAQS = [
  {
    q: 'When am I eligible for compensation?',
    a: 'You are eligible when your flight arrives 180 minutes (3 hours) or more after its scheduled arrival time. However the airline may reject your claim due to "unavoidable extraordinary circumstances". This aligns with EU Regulation 261/2004.',
  },
  {
    q: 'How do I register my flight?',
    a: 'After booking your flight, log in to Zeph and go to Register Flight. Enter your booking reference and your flight will be monitored automatically.',
  },
  {
    q: 'How long does the airline have to respond to my claim?',
    a: 'Airlines have 7 days to accept or reject your claim. If they do not respond within that window, your claim is automatically accepted.',
  },
  {
    q: 'What if my claim is rejected?',
    a: 'If your claim is rejected, you can download your evidence package from the My Claims page. This package contains a full PDF summary of your claim and all supporting data. You can then submit this directly to the relevant authority in your country.',
  },
  {
    q: 'How do I download my evidence package?',
    a: 'Go to My Claims, find the rejected claim, and click the Download Evidence button. You will receive a ZIP file containing a PDF report and supporting documentation ready to send to an authority.',
  },
  {
    q: 'Is my personal data secure?',
    a: 'Yes. Your personal details are stored securely in our database. Only a cryptographic hash of your evidence is stored on the blockchain — your personal data is never written on-chain.',
  },
]

export default function Help() {
  return (
    <PassengerLayout>
      <div className="container">

        <section className="page-header">
          <h1 className="page-header-title">Help & Support</h1>
          <p className="page-header-desc">
            Guides on escalating a rejected claim, national enforcement bodies across Europe, and frequently asked questions.
          </p>
        </section>

        {/* How to escalate */}
        <section className="help-section">
          <h2 className="section-title">How to Escalate a Rejected Claim</h2>
          <div className="steps-grid">
            <div className="step-card">
              <div className="step-number">1</div>
              <div>
                <h3>Download your evidence package</h3>
                <p>Go to <strong>My Claims</strong>, find your rejected claim, and click <strong>Download Evidence</strong>. You will receive a ZIP file containing a PDF summary of your claim and all supporting data.</p>
              </div>
            </div>
            <div className="step-card">
              <div className="step-number">2</div>
              <div>
                <h3>Identify the relevant authority</h3>
                <p>The authority you contact depends on the country of your departure or arrival. Use the table below to find the correct body for your jurisdiction.</p>
              </div>
            </div>
            <div className="step-card">
              <div className="step-number">3</div>
              <div>
                <h3>Submit your evidence</h3>
                <p>Visit the authority&apos;s website, complete their complaint form, and attach the evidence package downloaded from Zeph. The PDF contains all the information they will need.</p>
              </div>
            </div>
            <div className="step-card step-card-warning">
              <div className="step-number step-number-warning">!</div>
              <div>
                <h3>Note: Each jurisdiction has a unique escalation process</h3>
                <p>The process, required documents, and response times vary by country. You will find information about the specific process for your jurisdiction in the links below.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Authorities */}
        <section className="help-section">
          <h2 className="section-title">National Enforcement Bodies</h2>
          <p className="section-subtitle">These are the official bodies responsible for enforcing EU passenger rights in each country Zeph covers.</p>
          <div className="authority-grid">
            {AUTHORITIES.map((a) => (
              <div key={a.country} className="authority-card">
                <div className="authority-header">
                  <span className="authority-city">{a.country}</span>
                </div>
                <p className="authority-body">{a.body}</p>
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="authority-link">
                  Visit Website →
                </a>
              </div>
            ))}
          </div>
        </section>

        {/* FAQs */}
        <section className="help-section">
          <h2 className="section-title">Frequently Asked Questions</h2>
          <div className="faq-list">
            {FAQS.map((faq) => (
              <div key={faq.q} className="faq-item">
                <h3 className="faq-question">{faq.q}</h3>
                <p className="faq-answer">{faq.a}</p>
              </div>
            ))}
          </div>
        </section>

      </div>

      <style jsx>{`
        .page-header {
          padding: 2rem 0 1.5rem;
          border-bottom: 1px solid var(--bg-tertiary, #1e1e3a);
          margin-bottom: 2rem;
        }

        .page-header-title {
          font-size: 1.75rem;
          font-weight: 700;
          margin: 0 0 0.5rem;
          color: var(--text-primary);
        }

        .page-header-desc {
          margin: 0;
          color: var(--text-secondary);
          font-size: 0.95rem;
          line-height: 1.5;
        }

        .help-section {
          margin: var(--space-3xl, 4rem) 0;
        }

        .section-subtitle {
          color: var(--text-secondary);
          margin-bottom: var(--space-xl, 2rem);
          font-size: 1rem;
        }

        /* Steps */
        .steps-grid {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .step-card {
          display: flex;
          gap: 1.25rem;
          align-items: flex-start;
          background: var(--bg-secondary, #0f0f1a);
          border: 1px solid var(--bg-tertiary, #1e1e3a);
          border-radius: 12px;
          padding: 1.5rem;
        }

        .step-number {
          flex-shrink: 0;
          width: 2rem;
          height: 2rem;
          border-radius: 50%;
          background: #e94560;
          color: #fff;
          font-weight: 700;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .step-card h3 {
          margin: 0 0 0.4rem;
          font-size: 1rem;
          color: var(--text-primary);
        }

        .step-card p {
          margin: 0;
          color: var(--text-secondary);
          font-size: 0.9rem;
          line-height: 1.6;
        }

        .step-card-warning {
          border-color: #f59e0b;
          background: rgba(245, 158, 11, 0.06);
        }

        .step-number-warning {
          background: #f59e0b;
        }

        /* Authorities */
        .authority-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 1.25rem;
        }

        .authority-card {
          background: var(--bg-secondary, #0f0f1a);
          border: 1px solid var(--bg-tertiary, #1e1e3a);
          border-radius: 12px;
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .authority-header {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
        }

        .authority-city {
          font-size: 1.1rem;
          font-weight: 700;
          color: var(--text-primary);
        }

        .authority-country {
          font-size: 0.8rem;
          color: var(--text-secondary);
        }

        .authority-body {
          margin: 0;
          font-size: 0.875rem;
          color: #e94560;
          font-weight: 600;
        }

        .authority-note {
          margin: 0;
          font-size: 0.825rem;
          color: var(--text-secondary);
          line-height: 1.5;
          flex: 1;
        }

        .authority-link {
          display: inline-block;
          margin-top: 0.5rem;
          font-size: 0.875rem;
          color: #60a5fa;
          text-decoration: none;
          font-weight: 500;
        }

        .authority-link:hover {
          text-decoration: underline;
        }

        /* FAQs */
        .faq-list {
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }

        .faq-item {
          background: var(--bg-secondary, #0f0f1a);
          border: 1px solid var(--bg-tertiary, #1e1e3a);
          border-radius: 12px;
          padding: 1.5rem;
        }

        .faq-question {
          margin: 0 0 0.5rem;
          font-size: 1rem;
          color: var(--text-primary);
        }

        .faq-answer {
          margin: 0;
          color: var(--text-secondary);
          font-size: 0.9rem;
          line-height: 1.6;
        }
      `}</style>
    </PassengerLayout>
  )
}
