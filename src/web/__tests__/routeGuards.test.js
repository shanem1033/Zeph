import { requireAuth, requirePassenger, requireAirline } from '../utils/routeGuards'

describe('requireAuth', () => {
  it('returns authorized:true when user is provided', () => {
    const result = requireAuth({ email: 'user@example.com', role: 'passenger' })
    expect(result.authorized).toBe(true)
  })

  it('returns authorized:false with redirect to /login when user is null', () => {
    const result = requireAuth(null)
    expect(result.authorized).toBe(false)
    expect(result.redirectTo).toBe('/login')
  })
})

describe('requirePassenger', () => {
  it('returns authorized:true for passenger role', () => {
    const result = requirePassenger({ role: 'passenger' })
    expect(result.authorized).toBe(true)
  })

  it('redirects to /airline/claims for airline role', () => {
    const result = requirePassenger({ role: 'airline' })
    expect(result.authorized).toBe(false)
    expect(result.redirectTo).toBe('/airline/claims')
  })

  it('redirects to /login when user is null', () => {
    const result = requirePassenger(null)
    expect(result.authorized).toBe(false)
    expect(result.redirectTo).toBe('/login')
  })
})

describe('requireAirline', () => {
  it('returns authorized:true for airline role', () => {
    const result = requireAirline({ role: 'airline' })
    expect(result.authorized).toBe(true)
  })

  it('redirects to /passenger/register-flight for passenger role', () => {
    const result = requireAirline({ role: 'passenger' })
    expect(result.authorized).toBe(false)
    expect(result.redirectTo).toBe('/passenger/register-flight')
  })

  it('redirects to /login when user is null', () => {
    const result = requireAirline(null)
    expect(result.authorized).toBe(false)
    expect(result.redirectTo).toBe('/login')
  })
})
