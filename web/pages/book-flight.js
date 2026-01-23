import { useState } from 'react'
import Link from 'next/link'

export default function BookFlight() {
    const [formData, setFormData] = useState({
        departureCity: '',
        arrivalCity: '',
        departureDate: '',
        passengers: '1',
        cabinClass: 'economy',
        airline: '',
        flightNumber: '',
        email: '',
        phone: '',
    })

    const [showQRCode, setShowQRCode] = useState(false)
    const [bookingReference, setBookingReference] = useState(null)

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
        setShowQRCode(true)
        // TODO: Send booking data to database
    }

    const popularCities = ['London', 'Paris', 'Berlin', 'Rome', 'Madrid', 'Amsterdam', 'Barcelona', 'Vienna']
    const airlines = ['Ryanair', 'EasyJet', 'Lufthansa', 'Air France', 'Iberia', 'KLM', 'British Airways', 'Swiss International']

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
                {!showQRCode ? (
                    <>
                        {/* Search Form */}
                        <div className="booking-form-section">
                            <form onSubmit={handleSubmit} className="booking-form">
                                {/* Trip Type and Passengers */}
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
                                        <label>Passengers</label>
                                        <select name="passengers" value={formData.passengers} onChange={handleChange}>
                                            {[1, 2, 3, 4, 5, 6].map(num => (
                                                <option key={num} value={num}>{num}</option>
                                            ))}
                                        </select>
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
                                            <option value="Barcelona">Barcelona, Spain</option>
                                            <option value="Vienna">Vienna, Austria</option>
                                            <option value="Prague">Prague, Czech Republic</option>
                                            <option value="Budapest">Budapest, Hungary</option>
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
                                            <option value="Barcelona">Barcelona, Spain</option>
                                            <option value="Vienna">Vienna, Austria</option>
                                            <option value="Prague">Prague, Czech Republic</option>
                                            <option value="Budapest">Budapest, Hungary</option>
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
                                            <option value="20:00">08:00 PM</option>
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
                    </>
                ) : (
                    /* QR Code Display */
                    <div className="booking-confirmation">
                        <div className="confirmation-card">
                            <div className="success-icon">✓</div>
                            <h2>Booking Confirmed!</h2>
                            <p className="booking-ref">Reference: <strong>{bookingReference}</strong></p>

                            <div className="qr-code-container">
                                <div className="qr-placeholder">
                                    {/* In a real implementation, this would be a QR code generated from the booking reference */}
                                    <div className="qr-text">
                                        <p>QR Code</p>
                                        <p className="small">{bookingReference}</p>
                                    </div>
                                </div>
                                <p className="qr-instruction">Scan this QR code at the airport to verify your flight registration</p>
                            </div>

                            <div className="booking-summary">
                                <h3>Booking Summary</h3>
                                <div className="summary-row">
                                    <span>Route:</span>
                                    <strong>{formData.departureCity} → {formData.arrivalCity}</strong>
                                </div>
                                <div className="summary-row">
                                    <span>Date:</span>
                                    <strong>{new Date(formData.departureDate).toLocaleDateString()}</strong>
                                </div>
                                <div className="summary-row">
                                    <span>Airline:</span>
                                    <strong>{formData.airline} {formData.flightNumber}</strong>
                                </div>
                                <div className="summary-row">
                                    <span>Passengers:</span>
                                    <strong>{formData.passengers}</strong>
                                </div>
                            </div>

                            <div className="next-steps">
                                <h3>Next Steps</h3>
                                <ol>
                                    <li>Save your booking reference</li>
                                    <li>Visit the airport with your booking confirmation</li>
                                    <li>Scan the QR code at airport kiosks</li>
                                    <li>Your flight is verified in the system</li>
                                </ol>
                            </div>

                            <button
                                onClick={() => {
                                    setShowQRCode(false)
                                    setFormData({
                                        departureCity: '',
                                        arrivalCity: '',
                                        departureDate: '',
                                        passengers: '1',
                                        cabinClass: 'economy',
                                        airline: '',
                                        flightNumber: '',
                                        email: '',
                                        phone: '',
                                    })
                                }}
                                className="new-booking-button"
                            >
                                Book Another Flight
                            </button>
                        </div>
                    </div>
                )}
            </div>

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
        }
      `}</style>
        </div>
    )
}
