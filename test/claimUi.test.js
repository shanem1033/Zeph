import {
    filterFlightsByFlightCode,
    formatClaimDateTime,
    getAutoAcceptDeadlineFromDelayReport,
    getClaimStatusExplainer,
} from '../src/web/utils/claimUi'

describe('claim UI helpers', () => {
    it('returns explainer text for known status values', () => {
        expect(getClaimStatusExplainer('registered')).toMatch(/being monitored/i)
        expect(getClaimStatusExplainer('awaiting_decision')).toMatch(/7 days/i)
        expect(getClaimStatusExplainer('auto_accepted')).toMatch(/automatically/i)
    })

    it('returns fallback explainer for unknown or missing status', () => {
        expect(getClaimStatusExplainer('custom_status')).toMatch(/status update/i)
        expect(getClaimStatusExplainer()).toMatch(/not available/i)
    })

    it('calculates auto-accept deadline as 7 days from delay report', () => {
        const delayReportedAt = '2026-04-01T10:30:00.000Z'
        const deadline = getAutoAcceptDeadlineFromDelayReport(delayReportedAt)

        expect(deadline).toBeInstanceOf(Date)
        expect(deadline.toISOString()).toBe('2026-04-08T10:30:00.000Z')
    })

    it('formats claim date/times and handles invalid values', () => {
        expect(formatClaimDateTime('2026-04-02T14:45:00.000Z')).toMatch(/2026/)
        expect(formatClaimDateTime('invalid-date')).toBe('Not available')
        expect(formatClaimDateTime(null)).toBe('Not available')
    })

    it('filters flights by exact flight code query (case-insensitive)', () => {
        const flights = [
            { flight_code: 'FR340', flight_id: 'f1' },
            { flight_code: 'BA120', flight_id: 'f2' },
            { flight_code: 'EI530', flight_id: 'f3' },
        ]

        expect(filterFlightsByFlightCode(flights, 'fr340')).toEqual([{ flight_code: 'FR340', flight_id: 'f1' }])
        expect(filterFlightsByFlightCode(flights, '  BA120 ')).toEqual([{ flight_code: 'BA120', flight_id: 'f2' }])
        expect(filterFlightsByFlightCode(flights, 'fr')).toEqual([])
        expect(filterFlightsByFlightCode(flights, '')).toHaveLength(3)
    })
})
