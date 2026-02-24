// Authentication utility functions

/**
 * Known airline email domains.
 * Users with these domains are treated as airline staff.
 * All other users are passengers.
 */
export const AIRLINE_DOMAINS = ['ryanair.com']

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
