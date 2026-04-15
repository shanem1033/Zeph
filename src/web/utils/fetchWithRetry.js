/**
 * Wraps fetch with automatic retry logic.
 * Expects the response body to be JSON with an `ok` boolean field.
 * Retries up to maxAttempts times with linear back-off (attempt * baseDelayMs).
 *
 * @param {string} url
 * @param {RequestInit} options
 * @param {{ maxAttempts?: number, baseDelayMs?: number }} [config]
 * @returns {Promise<object>} Parsed JSON body on success
 * @throws {Error} After all attempts are exhausted
 */
export async function fetchWithRetry(url, options, { maxAttempts = 3, baseDelayMs = 1000 } = {}) {
  let lastError = 'Request failed after retries'
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, options)
    const data = await res.json().catch(() => null)
    if (res.ok && data?.ok) return data
    if (data?.error) lastError = data.error
    if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, attempt * baseDelayMs))
  }
  throw new Error(lastError)
}
