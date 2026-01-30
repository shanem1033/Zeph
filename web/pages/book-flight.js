import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

export default function BookFlight() {
    const [formData, setFormData] = useState({
        departureCity: '',
        arrivalCity: '',
        departureDate: '',
        passportNumber: '',
        cabinClass: 'economy',
        airline: '',
        flightNumber: '',
        email: '',
        phone: '',
    })

  const [isConfirmationOpen, setIsConfirmationOpen] = useState(false)
    const [bookingReference, setBookingReference] = useState(null)

  const closeButtonRef = useRef(null)

  useEffect(() => {
    if (!isConfirmationOpen) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsConfirmationOpen(false)
      }
    }

    window.addEventListener('keydown', onKeyDown)

    // Move focus into the modal for basic accessibility
    setTimeout(() => closeButtonRef.current?.focus(), 0)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isConfirmationOpen])

    const handleChange = (e) => {
        const { name, value } = e.target
        setFormData(prev => ({
            ...prev,
            [name]: value
        }))
    }

    const handleSubmit = (e) => {
        e.preventDefault()
        // Generate a booking reference (in future, this would come from database)
        const ref = `ZPH-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`
        setBookingReference(ref)
      setIsConfirmationOpen(true)
        // TODO: Send booking data to database
    }

    const resetForm = () => {
      setFormData({
        departureCity: '',
        arrivalCity: '',
        departureDate: '',
        passportNumber: '',
        cabinClass: 'economy',
        airline: '',
        flightNumber: '',
        email: '',
        phone: '',
      })
      setBookingReference(null)
    }

    const airlines = ['Ryanair', 'EasyJet', 'Lufthansa', 'Air France', 'Iberia']

    return (
        <div className="booking-page">
            {/* Header */}
            <div className="booking-header">
                <div className="booking-header-content">
                    <Link href="/">
                        <button className="back-button">← Back to Zeph</button>
                    </Link>
                    <h1 className="booking-title"> Book Your Flight</h1>
                    <p className="booking-subtitle">Book your flight and get a digital ticket with QR code verification</p>
                </div>
            </div>

            <div className="booking-container">
              {/* Search Form */}
              <div className="booking-form-section">
                <form onSubmit={handleSubmit} className="booking-form">
                                {/* Trip Type and Passenger */}
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Cabin Class</label>
                                        <select name="cabinClass" value={formData.cabinClass} onChange={handleChange}>
                                            <option value="economy">Economy</option>
                                            <option value="premium">Premium Economy</option>
                                            <option value="business">Business</option>
                                            <option value="first">First</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label>Passport Number</label>
                                        <input
                                            type="text"
                                            name="passportNumber"
                                            value={formData.passportNumber}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                </div>

                                {/* Route */}
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>From</label>
                                        <select
                                            name="departureCity"
                                            value={formData.departureCity}
                                            onChange={handleChange}
                                            required
                                        >
                                            <option value="">Select city</option>
                                            <option value="London">London, UK</option>
                                            <option value="Paris">Paris, France</option>
                                            <option value="Berlin">Berlin, Germany</option>
                                            <option value="Rome">Rome, Italy</option>
                                            <option value="Madrid">Madrid, Spain</option>
                                            <option value="Amsterdam">Amsterdam, Netherlands</option>
                                        </select>
                                    </div>

                                    <div className="swap-button">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                const temp = formData.departureCity
                                                setFormData(prev => ({
                                                    ...prev,
                                                    departureCity: prev.arrivalCity,
                                                    arrivalCity: temp
                                                }))
                                            }}
                                            title="Swap cities"
                                        >
                                            ⇄
                                        </button>
                                    </div>

                                    <div className="form-group">
                                        <label>To</label>
                                        <select
                                            name="arrivalCity"
                                            value={formData.arrivalCity}
                                            onChange={handleChange}
                                            required
                                        >
                                            <option value="">Select city</option>
                                            <option value="London">London, UK</option>
                                            <option value="Paris">Paris, France</option>
                                            <option value="Berlin">Berlin, Germany</option>
                                            <option value="Rome">Rome, Italy</option>
                                            <option value="Madrid">Madrid, Spain</option>
                                            <option value="Amsterdam">Amsterdam, Netherlands</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Date and Time */}
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Departure Date</label>
                                        <input
                                            type="date"
                                            name="departureDate"
                                            value={formData.departureDate}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Departure Time</label>
                                        <select name="departureTime" onChange={handleChange}>
                                            <option value="">Select time</option>
                                            <option value="08:00">08:00 AM</option>
                                            <option value="11:00">11:00 AM</option>
                                            <option value="14:00">02:00 PM</option>
                                            <option value="17:00">05:00 PM</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Flight Details */}
                                <div className="divider">Select airline</div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Airline</label>
                                        <select name="airline" value={formData.airline} onChange={handleChange} required>
                                            <option value="">Select airline</option>
                                            {airlines.map(airline => (
                                                <option key={airline} value={airline}>{airline}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* Contact Information */}
                                <div className="divider">Contact Information</div>

                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Email</label>
                                        <input
                                            type="email"
                                            name="email"
                                            placeholder="your@email.com"
                                            value={formData.email}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Phone</label>
                                        <input
                                            type="tel"
                                            name="phone"
                                            placeholder="+353 1 234 5678"
                                            value={formData.phone}
                                            onChange={handleChange}
                                            required
                                        />
                                    </div>
                                </div>

                            {/* Submit */}
                            <button type="submit" className="submit-button">
                              Complete Booking
                            </button>
                          </form>
                        </div>
            </div>

                      {/* Booking Confirmation Modal */}
                      {isConfirmationOpen && (
                        <div
                          className="booking-modal-overlay"
                          role="dialog"
                          aria-modal="true"
                          aria-labelledby="booking-confirmation-title"
                          onMouseDown={(e) => {
                            if (e.target === e.currentTarget) setIsConfirmationOpen(false)
                          }}
                        >
                          <div className="booking-modal-card">
                            <div className="success-icon">✓</div>
                            <h2 id="booking-confirmation-title">Booked successfully</h2>
                            <p className="booking-ref">
                              Your booking has been created. We’ll add the full details here next.
                            </p>

                            <div className="booking-ref-box">
                              <span>Booking reference</span>
                              <strong>{bookingReference}</strong>
                            </div>

                            <div className="modal-actions">
                              <button
                                ref={closeButtonRef}
                                type="button"
                                className="modal-button secondary"
                                onClick={() => setIsConfirmationOpen(false)}
                              >
                                Close
                              </button>
                              <button
                                type="button"
                                className="modal-button primary"
                                onClick={() => {
                                  setIsConfirmationOpen(false)
                                  resetForm()
                                }}
                              >
                                Book another flight
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

            <style jsx>{`
        .booking-page {
          min-height: 100vh;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
        }

        .booking-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 3rem 2rem;
          position: relative;
          overflow: hidden;
        }

        .booking-header::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 120"><path d="M0,50 Q300,0 600,50 T1200,50 L1200,120 L0,120 Z" fill="rgba(255,255,255,0.05)"/></svg>') no-repeat bottom;
          background-size: cover;
        }

        .booking-header-content {
          max-width: 1200px;
          margin: 0 auto;
          position: relative;
          z-index: 1;
        }

        .back-button {
          background: rgba(255, 255, 255, 0.2);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.3);
          padding: 0.75rem 1.5rem;
          border-radius: 8px;
          cursor: pointer;
          font-size: 0.95rem;
          margin-bottom: 1.5rem;
          transition: all 0.3s ease;
        }

        .back-button:hover {
          background: rgba(255, 255, 255, 0.3);
          border-color: rgba(255, 255, 255, 0.5);
        }

        .booking-title {
          font-size: 2.5rem;
          margin: 0 0 0.5rem 0;
          font-weight: 700;
        }

        .booking-subtitle {
          font-size: 1.1rem;
          opacity: 0.95;
          margin: 0;
        }

        .booking-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 3rem 2rem;
          display: flex;
          justify-content: center;
          width: 100%;
        }

        .booking-form-section {
          background: white;
          border-radius: 12px;
          padding: 2rem;
          box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
          width: 100%;
          max-width: 600px;
        }

        .booking-form {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .form-row {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
          align-items: flex-end;
        }

        .form-group {
          display: flex;
          flex-direction: column;
        }

        .form-group label {
          font-weight: 600;
          color: #333;
          margin-bottom: 0.5rem;
          font-size: 0.9rem;
        }

        .form-group input,
        .form-group select {
          padding: 0.75rem;
          border: 2px solid #e0e0e0;
          border-radius: 8px;
          font-size: 1rem;
          transition: border-color 0.3s ease;
          color: #333;
          background: white;
        }

        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: #667eea;
          box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
        }

        .swap-button {
          display: flex;
          align-items: flex-end;
          justify-content: center;
        }

        .swap-button button {
          background: #667eea;
          color: white;
          border: none;
          width: 45px;
          height: 45px;
          border-radius: 50%;
          cursor: pointer;
          font-size: 1.2rem;
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .swap-button button:hover {
          background: #764ba2;
          transform: rotate(180deg);
        }

        .divider {
          font-weight: 600;
          color: #667eea;
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 2px solid #f0f0f0;
        }

        .submit-button {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 1.2rem;
          border-radius: 8px;
          font-size: 1.1rem;
          font-weight: 600;
          cursor: pointer;
          margin-top: 1rem;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }

        .submit-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
        }

        .submit-button:active {
          transform: translateY(0);
        }

        .booking-confirmation {
          grid-column: 1 / -1;
          display: flex;
          justify-content: center;
          align-items: center;
          min-height: 600px;
        }

        .booking-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(118, 75, 162, 0.45);
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
          z-index: 1000;
        }

        .booking-modal-card {
          background: #ffffff;
          color: #333;
          width: 100%;
          max-width: 560px;
          border-radius: 16px;
          box-shadow: 0 30px 80px rgba(0, 0, 0, 0.35);
          padding: 2.25rem;
          text-align: center;
          animation: modalIn 180ms ease-out;
        }

        @keyframes modalIn {
          from {
            transform: translateY(8px) scale(0.98);
            opacity: 0;
          }
          to {
            transform: translateY(0) scale(1);
            opacity: 1;
          }
        }

        .booking-ref-box {
          background: #f6f3ff;
          border: 1px solid rgba(118, 75, 162, 0.22);
          border-radius: 12px;
          padding: 1rem;
          margin: 1.5rem 0 0 0;
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .booking-ref-box span {
          font-size: 0.85rem;
          color: #6a5a85;
        }

        .booking-ref-box strong {
          font-size: 1.05rem;
          letter-spacing: 0.5px;
          color: #3a2a55;
          word-break: break-word;
        }

        .modal-actions {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.75rem;
          margin-top: 1.5rem;
        }

        .modal-button {
          border-radius: 10px;
          padding: 0.9rem 1rem;
          font-weight: 700;
          cursor: pointer;
          border: 1px solid transparent;
          transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }

        .modal-button:active {
          transform: translateY(0);
        }

        .modal-button.secondary {
          background: #ffffff;
          border-color: rgba(118, 75, 162, 0.3);
          color: #5a3ea6;
        }

        .modal-button.secondary:hover {
          box-shadow: 0 10px 25px rgba(90, 62, 166, 0.15);
          transform: translateY(-1px);
        }

        .modal-button.primary {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: #fff;
          box-shadow: 0 10px 30px rgba(102, 126, 234, 0.35);
        }

        .modal-button.primary:hover {
          box-shadow: 0 14px 40px rgba(102, 126, 234, 0.5);
          transform: translateY(-1px);
        }

        .confirmation-card {
          background: white;
          border-radius: 16px;
          padding: 3rem;
          max-width: 600px;
          width: 100%;
          color: #333;
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.3);
          text-align: center;
        }

        .success-icon {
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 3rem;
          margin: 0 auto 1.5rem;
          animation: scaleIn 0.5s ease-out;
        }

        @keyframes scaleIn {
          from {
            transform: scale(0);
          }
          to {
            transform: scale(1);
          }
        }

        .confirmation-card h2 {
          font-size: 2rem;
          margin: 0 0 0.5rem 0;
          color: #667eea;
        }

        .booking-ref {
          color: #666;
          margin-bottom: 2rem;
        }

        .qr-code-container {
          margin: 2rem 0;
          padding: 2rem;
          background: #f9f9f9;
          border-radius: 12px;
        }

        .qr-placeholder {
          width: 200px;
          height: 200px;
          background: linear-gradient(45deg, #e0e0e0 25%, transparent 25%, transparent 75%, #e0e0e0 75%, #e0e0e0),
                      linear-gradient(45deg, #e0e0e0 25%, transparent 25%, transparent 75%, #e0e0e0 75%, #e0e0e0);
          background-size: 20px 20px;
          background-position: 0 0, 10px 10px;
          background-color: white;
          border: 2px solid #ddd;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1rem;
          flex-direction: column;
        }

        .qr-text {
          color: #999;
          text-align: center;
        }

        .qr-text .small {
          font-size: 0.75rem;
          word-break: break-all;
          max-width: 180px;
        }

        .qr-instruction {
          color: #666;
          font-size: 0.9rem;
          margin: 0;
        }

        .booking-summary {
          text-align: left;
          background: #f9f9f9;
          padding: 1.5rem;
          border-radius: 8px;
          margin: 1.5rem 0;
        }

        .booking-summary h3 {
          margin: 0 0 1rem 0;
          color: #667eea;
          font-size: 1rem;
        }

        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 0.75rem 0;
          border-bottom: 1px solid #e0e0e0;
          color: #555;
        }

        .summary-row strong {
          color: #333;
        }

        .next-steps {
          text-align: left;
          margin: 1.5rem 0;
        }

        .next-steps h3 {
          color: #667eea;
          font-size: 1rem;
          margin: 0 0 1rem 0;
        }

        .next-steps ol {
          margin: 0;
          padding-left: 1.5rem;
        }

        .next-steps li {
          margin-bottom: 0.75rem;
          color: #555;
          line-height: 1.5;
        }

        .new-booking-button {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          border: none;
          padding: 1rem 2rem;
          border-radius: 8px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          width: 100%;
          transition: all 0.3s ease;
          box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
        }

        .new-booking-button:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(102, 126, 234, 0.6);
        }

        @media (max-width: 768px) {
          .booking-container {
            padding: 2rem 1rem;
          }

          .booking-title {
            font-size: 1.8rem;
          }

          .booking-form-section {
            padding: 1.5rem;
          }

          .form-row {
            grid-template-columns: 1fr;
          }

          .confirmation-card {
            padding: 2rem 1.5rem;
          }

          .booking-modal-card {
            padding: 1.75rem 1.25rem;
          }

          .modal-actions {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
        </div>
    )
}
