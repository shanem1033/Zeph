/**
 * POST /api/airline/claims/upload-report
 *
 * Accepts a multipart/form-data request with:
 *   - file: PDF file (max 10 MB)
 *   - flightId: string
 *
 * Uploads the PDF to Supabase Storage bucket `rejection-reports`
 * under the path `<flightId>/<timestamp>_<filename>` and returns
 * the storage path.
 */
import { getSupabaseAdmin } from '../../../../utils/supabaseServer'

export const config = {
    api: {
        bodyParser: false, // We handle the multipart body ourselves
    },
}

/**
 * Collect the full request body as a Buffer.
 *
 * Next.js 13.x with `bodyParser: false` still provides a Node readable
 * stream, but the stream may already be in a paused state. We call
 * `req.resume()` to ensure data flows. As a fallback, if the body has
 * already been buffered (e.g. `req.body` is a Buffer), we use that.
 */
function getRawBody(req) {
    return new Promise((resolve, reject) => {
        // If Next.js already buffered the body (some versions do this)
        if (Buffer.isBuffer(req.body)) return resolve(req.body)

        const chunks = []
        req.on('data', (chunk) => chunks.push(chunk))
        req.on('end', () => resolve(Buffer.concat(chunks)))
        req.on('error', reject)

        // Kick a paused stream so events fire
        if (typeof req.resume === 'function' && req.readableFlowing === null) {
            req.resume()
        }
    })
}

/**
 * Parse multipart form data from the incoming request without
 * any external dependency (formidable / multer).
 *
 * Returns { fields: { [name]: string }, file: { name, buffer, type } | null }
 */
async function parseMultipart(req) {
    const buf = await getRawBody(req)
    const contentType = req.headers['content-type'] || ''
    const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^\s;]+))/)
    if (!boundaryMatch) throw new Error('No boundary found in content-type')

    const boundary = (boundaryMatch[1] || boundaryMatch[2]).trim()
    const parts = splitMultipart(buf, boundary)

    const fields = {}
    let file = null

    for (const part of parts) {
        const { headers, body } = part
        const disposition = headers['content-disposition'] || ''
        const nameMatch = disposition.match(/name="([^"]+)"/)
        const filenameMatch = disposition.match(/filename="([^"]+)"/)
        const fieldName = nameMatch ? nameMatch[1] : null

        if (filenameMatch && fieldName) {
            file = {
                fieldName,
                name: filenameMatch[1],
                buffer: body,
                type: (headers['content-type'] || 'application/octet-stream').trim(),
            }
        } else if (fieldName) {
            fields[fieldName] = body.toString('utf-8').trim()
        }
    }

    return { fields, file }
}

/**
 * Splits a multipart body Buffer by the given boundary string.
 * Returns an array of { headers, body } objects.
 */
function splitMultipart(buf, boundary) {
    const delim = Buffer.from(`--${boundary}`)
    const results = []

    let start = 0
    while (true) {
        const idx = buf.indexOf(delim, start)
        if (idx === -1) break

        if (start > 0) {
            // The slice between the previous delimiter and this one is a part.
            // Strip leading \r\n from the part start and trailing \r\n from the part end.
            let partBuf = buf.slice(start, idx)
            if (partBuf[0] === 0x0d && partBuf[1] === 0x0a) partBuf = partBuf.slice(2)
            if (partBuf[partBuf.length - 2] === 0x0d && partBuf[partBuf.length - 1] === 0x0a) {
                partBuf = partBuf.slice(0, partBuf.length - 2)
            }

            // Split headers from body at the first \r\n\r\n
            const headerEnd = partBuf.indexOf('\r\n\r\n')
            if (headerEnd !== -1) {
                const rawHeaders = partBuf.slice(0, headerEnd).toString('utf-8')
                const body = partBuf.slice(headerEnd + 4)
                const headers = {}
                for (const line of rawHeaders.split('\r\n')) {
                    const colon = line.indexOf(':')
                    if (colon !== -1) {
                        headers[line.slice(0, colon).trim().toLowerCase()] = line.slice(colon + 1).trim()
                    }
                }
                results.push({ headers, body })
            }
        }

        start = idx + delim.length
        // Check for closing boundary --boundary--
        if (buf[start] === 0x2d && buf[start + 1] === 0x2d) break
    }

    return results
}

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST'])
        return res.status(405).json({ ok: false, error: 'Method not allowed' })
    }

    try {
        const { fields, file } = await parseMultipart(req)
        const flightId = fields.flightId

        if (!flightId || typeof flightId !== 'string') {
            return res.status(400).json({ ok: false, error: 'flightId is required' })
        }

        if (!file || !file.buffer || file.buffer.length === 0) {
            return res.status(400).json({ ok: false, error: 'A PDF file is required' })
        }

        if (file.type !== 'application/pdf') {
            return res.status(400).json({ ok: false, error: 'Only PDF files are accepted' })
        }

        if (file.buffer.length > MAX_FILE_SIZE) {
            return res.status(400).json({ ok: false, error: 'File exceeds 10 MB limit' })
        }

        // Sanitise the original filename and build the storage path
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const storagePath = `${flightId}/${Date.now()}_${safeName}`

        const supabase = getSupabaseAdmin()

        // Ensure the bucket exists (idempotent – ignored if it already exists)
        const { error: bucketErr } = await supabase.storage.createBucket('rejection-reports', {
            public: true,
            fileSizeLimit: 10 * 1024 * 1024, // 10 MB
            allowedMimeTypes: ['application/pdf'],
        })
        if (bucketErr && !bucketErr.message?.includes('already exists')) {
            console.error('Failed to create bucket:', bucketErr)
            return res.status(500).json({ ok: false, error: 'Storage bucket setup failed: ' + bucketErr.message })
        }

        const { error: uploadError } = await supabase.storage
            .from('rejection-reports')
            .upload(storagePath, file.buffer, {
                contentType: 'application/pdf',
                upsert: false,
            })

        if (uploadError) {
            console.error('Supabase storage upload error:', uploadError)
            return res.status(500).json({ ok: false, error: uploadError.message || 'Upload failed' })
        }

        // Return the public URL so it can be stored alongside the decision
        const { data: urlData } = supabase.storage
            .from('rejection-reports')
            .getPublicUrl(storagePath)

        return res.status(200).json({
            ok: true,
            storagePath,
            publicUrl: urlData?.publicUrl || null,
        })
    } catch (err) {
        console.error('POST /api/airline/claims/upload-report error:', err)
        return res.status(500).json({ ok: false, error: err.message || 'Server error' })
    }
}
