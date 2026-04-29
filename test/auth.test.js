import {
    flightCodeMatchesAirlineCode,
    getAirlineCodeFromEmail,
    getAirlineCodeFromFlightCode,
    getAirlineCodeFromName,
    getAirlineNameFromCode,
    getRoleFromEmail,
    isAdminEmail,
    validateCredentials,
    validateRegistration,
} from '../src/web/utils/auth'

describe('getRoleFromEmail', () => {
    test('returns airline for @ryanair.com email', () => {
        expect(getRoleFromEmail('ops@ryanair.com')).toBe('airline')
    })

    test('returns airline for @ryanair.com regardless of case', () => {
        expect(getRoleFromEmail('OPS@RYANAIR.COM')).toBe('airline')
    })

    test('returns airline for @easyjet.com email', () => {
        expect(getRoleFromEmail('ops@easyjet.com')).toBe('airline')
    })

    test('returns airline for @lufthansa.com email', () => {
        expect(getRoleFromEmail('ops@lufthansa.com')).toBe('airline')
    })

    test('returns airline for @airfrance.com email', () => {
        expect(getRoleFromEmail('ops@airfrance.com')).toBe('airline')
    })

    test('returns airline for @iberia.com email', () => {
        expect(getRoleFromEmail('ops@iberia.com')).toBe('airline')
    })

    test('returns airline for @britishairways.com email', () => {
        expect(getRoleFromEmail('ops@britishairways.com')).toBe('airline')
    })

    test('returns passenger for a regular email', () => {
        expect(getRoleFromEmail('john@gmail.com')).toBe('passenger')
    })

    test('returns passenger for empty email', () => {
        expect(getRoleFromEmail('')).toBe('passenger')
    })

    test('returns passenger for null/undefined', () => {
        expect(getRoleFromEmail(null)).toBe('passenger')
        expect(getRoleFromEmail(undefined)).toBe('passenger')
    })
})

describe('getAirlineCodeFromEmail', () => {
    test('returns FR for ryanair.com', () => {
        expect(getAirlineCodeFromEmail('ops@ryanair.com')).toBe('FR')
    })

    test('returns U2 for easyjet.com', () => {
        expect(getAirlineCodeFromEmail('ops@easyjet.com')).toBe('U2')
    })

    test('returns LH for lufthansa.com', () => {
        expect(getAirlineCodeFromEmail('ops@lufthansa.com')).toBe('LH')
    })

    test('returns AF for airfrance.com', () => {
        expect(getAirlineCodeFromEmail('ops@airfrance.com')).toBe('AF')
    })

    test('returns IB for iberia.com', () => {
        expect(getAirlineCodeFromEmail('ops@iberia.com')).toBe('IB')
    })

    test('returns BA for britishairways.com', () => {
        expect(getAirlineCodeFromEmail('ops@britishairways.com')).toBe('BA')
    })

    test('returns null for non-airline email', () => {
        expect(getAirlineCodeFromEmail('john@gmail.com')).toBeNull()
    })

    test('returns null for null/undefined', () => {
        expect(getAirlineCodeFromEmail(null)).toBeNull()
        expect(getAirlineCodeFromEmail(undefined)).toBeNull()
    })
})

describe('airline flight code aliases', () => {
    test('maps FR flight codes to Ryanair', () => {
        expect(getAirlineCodeFromFlightCode('FR340')).toBe('FR')
        expect(flightCodeMatchesAirlineCode('FR340', 'FR')).toBe(true)
    })

    test('maps U2 flight codes to EasyJet', () => {
        expect(getAirlineCodeFromFlightCode('U2118')).toBe('U2')
        expect(flightCodeMatchesAirlineCode('U2118', 'U2')).toBe(true)
    })

    test('maps airline display names to canonical codes', () => {
        expect(getAirlineCodeFromName('Ryanair')).toBe('FR')
        expect(getAirlineCodeFromName('EasyJet')).toBe('U2')
    })
})

describe('validateCredentials', () => {
    test('returns error when email is missing', () => {
        const result = validateCredentials('', 'password123')
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Email and password are required')
    })

    test('returns error when password is missing', () => {
        const result = validateCredentials('test@test.com', '')
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Email and password are required')
    })

    test('returns error when password is too short', () => {
        const result = validateCredentials('test@test.com', '12345')
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Password must be at least 6 characters')
    })

    test('returns valid for correct credentials', () => {
        const result = validateCredentials('test@test.com', 'password123')
        expect(result.valid).toBe(true)
    })
})

describe('validateRegistration', () => {
    test('returns error when passwords do not match', () => {
        const result = validateRegistration('test@test.com', 'password123', 'password456')
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Passwords do not match')
    })

    test('returns valid when all inputs are correct', () => {
        const result = validateRegistration('test@test.com', 'password123', 'password123')
        expect(result.valid).toBe(true)
    })
})

describe('isAdminEmail', () => {
    beforeEach(() => {
        process.env.NEXT_PUBLIC_ADMIN_EMAILS = 'admin@zeph.com, sean@zeph.com'
    })

    afterEach(() => {
        delete process.env.NEXT_PUBLIC_ADMIN_EMAILS
    })

    test('returns true for email in NEXT_PUBLIC_ADMIN_EMAILS', () => {
        expect(isAdminEmail('admin@zeph.com')).toBe(true)
    })

    test('handles comma-separated list with spaces', () => {
        expect(isAdminEmail('sean@zeph.com')).toBe(true)
    })

    test('returns false for non-admin email', () => {
        expect(isAdminEmail('passenger@gmail.com')).toBe(false)
    })

    test('returns false for null/undefined', () => {
        expect(isAdminEmail(null)).toBe(false)
        expect(isAdminEmail(undefined)).toBe(false)
    })
})

describe('getAirlineNameFromCode', () => {
    test('returns correct name for known code', () => {
        expect(getAirlineNameFromCode('FR')).toBe('Ryanair')
        expect(getAirlineNameFromCode('BA')).toBe('British Airways')
    })

    test('returns null for unknown code', () => {
        expect(getAirlineNameFromCode('XX')).toBeNull()
        expect(getAirlineNameFromCode(null)).toBeNull()
    })
})
