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
 * Map of airline email domains to ICAO / IATA-style codes used to filter
 * flights in the claims dashboard.  Extend this map as new airlines are
 * on-boarded.
 */
const DOMAIN_TO_AIRLINE_CODE = {
  'ryanair.com': 'FR',
  'easyjet.com': 'U2',
  'lufthansa.com': 'LH',
  'airfrance.com': 'AF',
  'iberia.com': 'IB',
  'britishairways.com': 'BA',
}

export const AIRLINE_CODE_TO_NAME = {
  FR: 'Ryanair',
  U2: 'EasyJet',
  LH: 'Lufthansa',
  AF: 'Air France',
  IB: 'Iberia',
  BA: 'British Airways',
}

const AIRLINE_NAME_TO_CODE = {
  ryanair: 'FR',
  easyjet: 'U2',
  lufthansa: 'LH',
  'air france': 'AF',
  iberia: 'IB',
  'british airways': 'BA',
}

const AIRLINE_CODE_TO_PREFIXES = {
  FR: ['FR'],
  U2: ['U2'],
  LH: ['LH'],
  AF: ['AF'],
  IB: ['IB'],
  BA: ['BA'],
}

/**
 * Extracts the airline code from an email address.
 * Returns `null` when the domain is not a known airline.
 * @param {string} email
 * @returns {string | null}
 */
export function getAirlineCodeFromEmail(email) {
  if (!email) return null
  const domain = email.split('@')[1]?.toLowerCase()
  return DOMAIN_TO_AIRLINE_CODE[domain] || null
}

export function getAirlineCodeFromName(name) {
  if (!name) return null
  return AIRLINE_NAME_TO_CODE[String(name).trim().toLowerCase()] || null
}

export function getFlightCodePrefixesForAirlineCode(airlineCode) {
  if (!airlineCode) return []
  const normalized = String(airlineCode).trim().toUpperCase()
  return AIRLINE_CODE_TO_PREFIXES[normalized] || [normalized]
}

export function flightCodeMatchesAirlineCode(flightCode, airlineCode) {
  if (!flightCode || !airlineCode) return false
  const normalizedFlightCode = String(flightCode).trim().toUpperCase()
  return getFlightCodePrefixesForAirlineCode(airlineCode)
    .some((prefix) => normalizedFlightCode.startsWith(prefix))
}

export function getAirlineCodeFromFlightCode(flightCode) {
  if (!flightCode) return null
  const normalized = String(flightCode).toUpperCase()
  for (const [airlineCode, prefixes] of Object.entries(AIRLINE_CODE_TO_PREFIXES)) {
    if (prefixes.some((prefix) => normalized.startsWith(prefix))) {
      return airlineCode
    }
  }
  return null
}

export function getAirlineNameFromCode(code) {
  if (!code) return null
  return AIRLINE_CODE_TO_NAME[String(code).toUpperCase()] || null
}

/**
 * Admin emails are stored in NEXT_PUBLIC_ADMIN_EMAILS as a comma-separated list.
 * e.g. NEXT_PUBLIC_ADMIN_EMAILS=admin@zeph.com,sean@zeph.com
 * @param {string} email
 * @returns {boolean}
 */
export function isAdminEmail(email) {
  if (!email) return false
  const raw = process.env.NEXT_PUBLIC_ADMIN_EMAILS || ''
  const adminEmails = raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  return adminEmails.includes(email.toLowerCase())
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
