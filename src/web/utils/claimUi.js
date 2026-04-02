const CLAIM_STATUS_EXPLAINERS = {
    registered: 'Registered - your flight is being monitored for significant delays.',
    landed_on_time: 'On Time - your flight landed without a compensable delay.',
    awaiting_decision: 'Awaiting Decision - your flight was delayed and the airline has 7 days to respond.',
    accepted: 'Accepted - your claim was approved by the airline.',
    auto_accepted: 'Auto-Accepted - the airline did not respond in time, so your claim was approved automatically.',
    rejected: 'Rejected - your claim was declined by the airline.',
}

export function getClaimStatusExplainer(status) {
    if (!status) return 'Status not available.'
    return CLAIM_STATUS_EXPLAINERS[status] || 'Status update received for this claim.'
}

export function getAutoAcceptDeadlineFromDelayReport(delayReportedAt) {
    if (!delayReportedAt) return null
    const delayDate = new Date(delayReportedAt)
    if (Number.isNaN(delayDate.getTime())) return null

    const deadline = new Date(delayDate.getTime())
    deadline.setDate(deadline.getDate() + 7)
    return deadline
}

export function formatClaimDateTime(value, locale = 'en-IE') {
    if (!value) return 'Not available'
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) return 'Not available'

    return date.toLocaleString(locale, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    })
}

export function filterFlightsByFlightCode(flights, query) {
    const normalized = String(query || '').trim().toLowerCase()
    const list = Array.isArray(flights) ? flights : []
    if (!normalized) return list

    return list.filter((flight) => String(flight?.flight_code || '').trim().toLowerCase() === normalized)
}
