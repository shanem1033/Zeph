import { fetchWithRetry } from '../src/web/utils/fetchWithRetry'

const mockOk = (data) => ({ ok: true, json: async () => data })
const mockFail = (error) => ({ ok: false, json: async () => ({ ok: false, error }) })
const mockNoBody = () => ({ ok: false, json: async () => { throw new Error('parse error') } })

describe('fetchWithRetry', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = jest.fn()
    global.fetch = fetchMock
  })

  afterEach(() => {
    jest.resetAllMocks()
  })

  it('returns data immediately on first success', async () => {
    fetchMock.mockResolvedValue(mockOk({ ok: true, value: 42 }))
    const result = await fetchWithRetry('/api/test', { method: 'POST' }, { baseDelayMs: 0 })
    expect(result).toEqual({ ok: true, value: 42 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries and succeeds on the second attempt', async () => {
    fetchMock
      .mockResolvedValueOnce(mockFail('db error'))
      .mockResolvedValueOnce(mockOk({ ok: true }))
    const result = await fetchWithRetry('/api/test', {}, { baseDelayMs: 0 })
    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('retries and succeeds on the third attempt', async () => {
    fetchMock
      .mockResolvedValueOnce(mockFail('error 1'))
      .mockResolvedValueOnce(mockFail('error 2'))
      .mockResolvedValueOnce(mockOk({ ok: true }))
    const result = await fetchWithRetry('/api/test', {}, { baseDelayMs: 0 })
    expect(result).toEqual({ ok: true })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('throws with the API error message after all attempts fail', async () => {
    fetchMock.mockResolvedValue(mockFail('Supabase unavailable'))
    await expect(
      fetchWithRetry('/api/test', {}, { baseDelayMs: 0 })
    ).rejects.toThrow('Supabase unavailable')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('throws a generic message when the API returns no error field', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ ok: false }) })
    await expect(
      fetchWithRetry('/api/test', {}, { baseDelayMs: 0 })
    ).rejects.toThrow('Request failed after retries')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('throws a generic message when the response body cannot be parsed', async () => {
    fetchMock.mockResolvedValue(mockNoBody())
    await expect(
      fetchWithRetry('/api/test', {}, { baseDelayMs: 0 })
    ).rejects.toThrow('Request failed after retries')
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('respects a custom maxAttempts value', async () => {
    fetchMock.mockResolvedValue(mockFail('error'))
    await expect(
      fetchWithRetry('/api/test', {}, { maxAttempts: 2, baseDelayMs: 0 })
    ).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry at all when maxAttempts is 1', async () => {
    fetchMock.mockResolvedValue(mockFail('error'))
    await expect(
      fetchWithRetry('/api/test', {}, { maxAttempts: 1, baseDelayMs: 0 })
    ).rejects.toThrow()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('passes the url and options through to fetch unchanged', async () => {
    fetchMock.mockResolvedValue(mockOk({ ok: true }))
    const opts = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }
    await fetchWithRetry('/api/complete', opts, { baseDelayMs: 0 })
    expect(fetchMock).toHaveBeenCalledWith('/api/complete', opts)
  })
})
