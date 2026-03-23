/**
 * Tests for POST /api/airline/claims/upload-report
 *
 * Validates multipart PDF upload to Supabase Storage.
 */
import { mockSupabase, resetSupabaseMock } from '../../helpers/setup'

jest.mock('../../../utils/supabaseServer')

import handler from '../../../pages/api/airline/claims/upload-report'

afterEach(() => resetSupabaseMock())

/**
 * Helper to build a minimal multipart/form-data request object that the
 * handler can parse. Node's `http.IncomingMessage` is an EventEmitter that
 * emits 'data' and 'end' events. We simulate that here.
 */
function buildMultipartRequest({ fields = {}, file = null, method = 'POST' } = {}) {
    const boundary = '----TestBoundary123'
    let body = ''

    // Add text fields
    for (const [name, value] of Object.entries(fields)) {
        body += `--${boundary}\r\n`
        body += `Content-Disposition: form-data; name="${name}"\r\n\r\n`
        body += `${value}\r\n`
    }

    // Add file field
    if (file) {
        body += `--${boundary}\r\n`
        body += `Content-Disposition: form-data; name="${file.fieldName}"; filename="${file.name}"\r\n`
        body += `Content-Type: ${file.type}\r\n\r\n`
        // For the file body we'll append the buffer after conversion
    }

    const closingBoundary = `\r\n--${boundary}--\r\n`

    // Build a Buffer for the full body
    let bodyBuf
    if (file && file.content) {
        const prefix = Buffer.from(body, 'utf-8')
        const suffix = Buffer.from(closingBoundary, 'utf-8')
        bodyBuf = Buffer.concat([prefix, file.content, suffix])
    } else {
        body += `--${boundary}--\r\n`
        bodyBuf = Buffer.from(body, 'utf-8')
    }

    // Create a fake request (EventEmitter-like)
    const { EventEmitter } = require('events')
    const req = new EventEmitter()
    req.method = method
    req.headers = {
        'content-type': `multipart/form-data; boundary=${boundary}`,
    }

    // The handler calls req.resume() if readableFlowing is null, then
    // listens for 'data' / 'end'.  We set readableFlowing so the resume()
    // call is a no-op, and emit events on the next microtask.
    req.readableFlowing = false
    req.resume = () => { }

    // Simulate streaming the body in the next microtask
    process.nextTick(() => {
        req.emit('data', bodyBuf)
        req.emit('end')
    })

    return req
}

/**
 * Minimal response mock that matches what Next.js API routes expect.
 */
function buildResponse() {
    let _status = 200
    let _json = null
    let _headers = {}
    const res = {
        statusCode: 200,
        status(code) { _status = code; res.statusCode = code; return res },
        json(data) { _json = data; return res },
        setHeader(k, v) { _headers[k] = v; return res },
        _getStatusCode() { return _status },
        _getJSONData() { return _json },
    }
    return res
}

describe('POST /api/airline/claims/upload-report', () => {
    test('rejects non-POST methods with 405', async () => {
        mockSupabase()
        const req = buildMultipartRequest({ method: 'GET' })
        const res = buildResponse()
        // For non-POST, the handler checks method first before reading body,
        // but our handler still reads the body via parseMultipart. We need to
        // override the method check path. Actually the handler checks method first.
        // Let's just call it; it reads req.method synchronously.

        // Override: the handler reads req.method before awaiting parseMultipart
        req.method = 'GET'
        await handler(req, res)
        expect(res.statusCode).toBe(405)
    })

    test('returns 400 when flightId is missing', async () => {
        mockSupabase()
        const pdfContent = Buffer.from('%PDF-1.4 fake content')
        const req = buildMultipartRequest({
            fields: {},
            file: { fieldName: 'file', name: 'report.pdf', type: 'application/pdf', content: pdfContent },
        })
        const res = buildResponse()
        await handler(req, res)
        expect(res.statusCode).toBe(400)
        expect(res._getJSONData().error).toMatch(/flightId/i)
    })

    test('returns 400 when no file is provided', async () => {
        mockSupabase()
        const req = buildMultipartRequest({
            fields: { flightId: 'FL-001' },
        })
        const res = buildResponse()
        await handler(req, res)
        expect(res.statusCode).toBe(400)
        expect(res._getJSONData().error).toMatch(/PDF file/i)
    })

    test('returns 400 for non-PDF files', async () => {
        mockSupabase()
        const content = Buffer.from('not a pdf')
        const req = buildMultipartRequest({
            fields: { flightId: 'FL-001' },
            file: { fieldName: 'file', name: 'report.txt', type: 'text/plain', content },
        })
        const res = buildResponse()
        await handler(req, res)
        expect(res.statusCode).toBe(400)
        expect(res._getJSONData().error).toMatch(/PDF/i)
    })

    test('uploads PDF and returns storage path on success', async () => {
        const sb = mockSupabase()

        // Add storage mock to the supabase client
        sb.client.storage = {
            createBucket: jest.fn().mockResolvedValue({ error: null }),
            from: jest.fn().mockReturnValue({
                upload: jest.fn().mockResolvedValue({ error: null }),
                getPublicUrl: jest.fn().mockReturnValue({
                    data: { publicUrl: 'http://localhost:54321/storage/v1/object/public/rejection-reports/FL-001/report.pdf' },
                }),
            }),
        }

        const pdfContent = Buffer.from('%PDF-1.4 fake pdf')
        const req = buildMultipartRequest({
            fields: { flightId: 'FL-001' },
            file: { fieldName: 'file', name: 'report.pdf', type: 'application/pdf', content: pdfContent },
        })
        const res = buildResponse()
        await handler(req, res)
        expect(res.statusCode).toBe(200)
        const data = res._getJSONData()
        expect(data.ok).toBe(true)
        expect(data.storagePath).toMatch(/^FL-001\//)
        expect(data.storagePath).toMatch(/report\.pdf$/)
        expect(data.publicUrl).toBeDefined()
    })

    test('returns 500 when Supabase upload fails', async () => {
        const sb = mockSupabase()

        sb.client.storage = {
            createBucket: jest.fn().mockResolvedValue({ error: null }),
            from: jest.fn().mockReturnValue({
                upload: jest.fn().mockResolvedValue({ error: { message: 'Storage quota exceeded' } }),
                getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: null } }),
            }),
        }

        const pdfContent = Buffer.from('%PDF-1.4 fake pdf')
        const req = buildMultipartRequest({
            fields: { flightId: 'FL-001' },
            file: { fieldName: 'file', name: 'report.pdf', type: 'application/pdf', content: pdfContent },
        })
        const res = buildResponse()
        await handler(req, res)
        expect(res.statusCode).toBe(500)
        expect(res._getJSONData().error).toMatch(/Storage quota/i)
    })
})
