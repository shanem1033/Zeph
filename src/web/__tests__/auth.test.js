import { validateLoginRole, validateCredentials, validateRegistration } from '../utils/auth'

describe('validateLoginRole', () => {
    test('returns valid when selected role matches registered role (passenger)', () => {
        const result = validateLoginRole('passenger', 'passenger')
        expect(result.valid).toBe(true)
        expect(result.error).toBeUndefined()
    })

    test('returns valid when selected role matches registered role (airline)', () => {
        const result = validateLoginRole('airline', 'airline')
        expect(result.valid).toBe(true)
        expect(result.error).toBeUndefined()
    })

    test('returns error when passenger tries to log in as airline', () => {
        const result = validateLoginRole('airline', 'passenger')
        expect(result.valid).toBe(false)
        expect(result.error).toContain('registered as a passenger')
    })

    test('returns error when airline tries to log in as passenger', () => {
        const result = validateLoginRole('passenger', 'airline')
        expect(result.valid).toBe(false)
        expect(result.error).toContain('registered as a airline')
    })

    test('returns valid when no registered role exists (backwards compatibility)', () => {
        const result = validateLoginRole('passenger', undefined)
        expect(result.valid).toBe(true)
    })

    test('returns error when no role is selected', () => {
        const result = validateLoginRole('', 'passenger')
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Please select a user type')
    })

    test('returns error when null role is selected', () => {
        const result = validateLoginRole(null, 'airline')
        expect(result.valid).toBe(false)
        expect(result.error).toBe('Please select a user type')
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
