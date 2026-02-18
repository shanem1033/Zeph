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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)

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

    const handleSubmit = async (e) => {
        e.preventDefault()
        setIsSubmitting(true)
        setSubmitError(null)

        try {
          const res = await fetch('/api/bookings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              departureCity: formData.departureCity,
              arrivalCity: formData.arrivalCity,
              departureDate: formData.departureDate,
              departureTime: formData.departureTime,
              passportNumber: formData.passportNumber,
              cabinClass: formData.cabinClass,
              airline: formData.airline,
              email: formData.email,
              phone: formData.phone,
            }),
          })

          const data = await res.json().catch(() => null)

          if (!res.ok || !data?.ok) {
            throw new Error(data?.error || 'Booking failed')
          }

          setBookingReference(data.bookingRef)
          setIsConfirmationOpen(true)
        } catch (err) {
          setSubmitError(err?.message || 'Booking failed')
        } finally {
          setIsSubmitting(false)
        }
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
                          {isSubmitting ? 'Booking…' : 'Complete Booking'}
                            </button>

                            {submitError && (
                              <div className="submit-error" role="alert">
                                {submitError}
                              </div>
                            )}
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

        </div>
    )
}
