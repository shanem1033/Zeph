// Authentication utility functions

/**
 * Known airline email domains.
 * Users with these domains are treated as airline staff.
 * All other users are passengers.
 */
export const AIRLINE_DOMAINS = [
  'ryanair.com',
  'easyjet.com',
  'lufthansa.com',
  'airfrance.com',
  'iberia.com',
  'britishairways.com',
]

/**
 * Maps airline email domains to their IATA flight-code prefixes.
 * Used to filter flights so each airline only sees their own.
 */
export const AIRLINE_CODE_MAP = {
  'ryanair.com':        'FR',
  'easyjet.com':        'U2',
  'lufthansa.com':      'LH',
  'airfrance.com':      'AF',
  'iberia.com':         'IB',
  'britishairways.com': 'BA',
}

/**
 * Determines the user role based on their email domain.
 * @param {string} email
 * @returns {'airline' | 'passenger'}
 */
export function getRoleFromEmail(email) {
  if (!email) return 'passenger'
  const domain = email.split('@')[1]?.toLowerCase()
  return AIRLINE_DOMAINS.includes(domain) ? 'airline' : 'passenger'
}

/**
 * Returns the IATA flight-code prefix for an airline email.
 * e.g. 'ops@lufthansa.com' → 'LH'
 * Returns null for non-airline emails.
 */
export function getAirlineCodeFromEmail(email) {
  if (!email) return null
  const domain = email.split('@')[1]?.toLowerCase()
  return AIRLINE_CODE_MAP[domain] || null
}

export function validateCredentials(email, password) {
  if (!email || !password) {
    return { valid: false, error: 'Email and password are required' }
  }
  if (password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters' }
  }
  return { valid: true }
}

export function validateRegistration(email, password, confirmPassword) {
  const credCheck = validateCredentials(email, password)
  if (!credCheck.valid) return credCheck

  if (password !== confirmPassword) {
    return { valid: false, error: 'Passwords do not match' }
  }
  return { valid: true }
}
