import { getRoleFromEmail, getAirlineCodeFromEmail, validateCredentials, validateRegistration } from '../utils/auth'

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
