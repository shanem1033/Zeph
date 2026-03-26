import crypto from 'node:crypto'
import PDFDocument from 'pdfkit'
import JSZip from 'jszip'

export function isUuid(value) {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
}

export function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

function bufferSha256Hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex')
}

function stableStringify(value) {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value)
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  const keys = Object.keys(value).sort()
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
}

function withOptionalFields(base, optional) {
  return Object.fromEntries([
    ...Object.entries(base),
    ...Object.entries(optional).filter(([, value]) => value != null),
  ])
}

function createPdfBuffer(report) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const chunks = []

    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)

    doc.fontSize(22).fillColor('#0f172a').text('Zeph Claim Evidence Report')
    doc.moveDown(0.25)
    doc.fontSize(10).fillColor('#475569').text(`Generated: ${report.generatedAt}`)
    doc.text(`Evidence checksum: ${report.evidencePayloadSha256}`)

    doc.moveDown()
    doc.fontSize(14).fillColor('#111827').text('Passenger Claim Summary')
    doc.moveDown(0.5)

    const rows = [
      ['Booking reference', report.booking.bookingRef],
      ['Passenger email', report.booking.passengerEmail],
      ['Flight ID', report.flight.flightId],
      ['Flight code', report.flight.flightCode],
      ['Route', `${report.flight.origin} -> ${report.flight.destination}`],
      ['Scheduled departure', report.flight.scheduledDeparture],
      ['Scheduled arrival', report.flight.scheduledArrival],
      ['Actual arrival', report.flight.actualArrival || 'Not available'],
      ['Delay', report.flight.delayLabel],
      ['Claim status', report.claim.claimStatus],
      ['Decision', report.claim.decision || 'No airline decision recorded'],
      ['Decision timestamp', report.claim.decidedAt || 'Not available'],
      ['Rejection reason', report.claim.rejectionReason || 'Not applicable'],
    ]

    for (const [label, value] of rows) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1f2937').text(`${label}: `, { continued: true })
      doc.font('Helvetica').fillColor('#334155').text(value || 'Not available')
    }

    doc.moveDown()
    doc.fontSize(14).fillColor('#111827').text('Blockchain Verification')
    doc.moveDown(0.5)

    const chainRows = [
      ['Contract address', report.blockchain.contractAddress || 'Not recorded'],
      ['Chain ID', String(report.blockchain.chainId || 'Not recorded')],
      ['Registration tx hash', report.blockchain.registrationTxHash || 'Not recorded'],
      ['Oracle tx hash', report.blockchain.oracleTxHash || 'Not recorded'],
      ['Airline evidence hash', report.claim.evidenceHash || 'Not recorded'],
    ]

    if (report.blockchain.decisionTxHash) {
      chainRows.push(['Decision tx hash', report.blockchain.decisionTxHash])
    }

    if (report.blockchain.registeredByWallet) {
      chainRows.push(['Registered by wallet', report.blockchain.registeredByWallet])
    }

    if (report.blockchain.decidedByWallet) {
      chainRows.push(['Decided by wallet', report.blockchain.decidedByWallet])
    }

    for (const [label, value] of chainRows) {
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1f2937').text(`${label}: `, { continued: true })
      doc.font('Helvetica').fillColor('#334155').text(value)
    }

    if (report.documents.airlineRejectionReport) {
      doc.moveDown()
      doc.fontSize(14).fillColor('#111827').text('Attached Airline Report')
      doc.moveDown(0.5)
      doc.font('Helvetica-Bold').fontSize(10).fillColor('#1f2937').text('Filename: ', { continued: true })
      doc.font('Helvetica').fillColor('#334155').text(report.documents.airlineRejectionReport.fileName)
      doc.font('Helvetica-Bold').fillColor('#1f2937').text('Storage path: ', { continued: true })
      doc.font('Helvetica').fillColor('#334155').text(report.documents.airlineRejectionReport.storagePath)
      doc.font('Helvetica-Bold').fillColor('#1f2937').text('Airline report file SHA-256: ', { continued: true })
      doc.font('Helvetica').fillColor('#334155').text(report.documents.airlineRejectionReport.fileSha256)
    }

    doc.moveDown()
    doc.fontSize(11).fillColor('#475569').text(
      'Verification note: authorities can validate the transaction hashes on PolygonScan and compare the attached document hash with the JSON manifest included in this ZIP.'
    )

    doc.end()
  })
}

/**
 * Generates the evidence ZIP for a given bookingRef.
 * Returns { zipBuffer, safeBookingRef }.
 * Throws if the booking or registration is not found.
 */
export async function generateEvidenceZip(supabase, bookingRef) {
  const { data: booking, error: bookingError } = await supabase
    .from('bookings')
    .select('booking_ref, flight_id, passenger_name, passenger_email, passport_number, origin, destination, scheduled_departure_at, scheduled_arrival_at')
    .eq('booking_ref', bookingRef)
    .single()

  if (bookingError || !booking) {
    const err = new Error('Claim not found')
    err.status = 404
    throw err
  }

  const [{ data: registration, error: registrationError }, { data: flight, error: flightError }, { data: decision, error: decisionError }] = await Promise.all([
    supabase
      .from('registered_flights')
      .select('booking_ref, status, claim_status, registered_by_wallet, tx_hash, chain_id, contract_address, created_at, confirmed_at')
      .eq('booking_ref', bookingRef)
      .single(),
    supabase
      .from('flights')
      .select('flight_id, flight_code, origin, destination, scheduled_departure_at, scheduled_arrival_at, actual_arrival_at, delay_minutes, oracle_tx_hash')
      .eq('flight_id', booking.flight_id)
      .single(),
    supabase
      .from('flight_claim_decisions')
      .select('flight_id, decision, evidence, evidence_hash, decided_at, decided_by_wallet, chain_id, contract_address, tx_hash, rejection_report_path')
      .eq('flight_id', booking.flight_id)
      .maybeSingle(),
  ])

  if (registrationError || !registration) {
    const err = new Error('Registered claim not found')
    err.status = 404
    throw err
  }

  if (flightError || !flight) {
    const err = new Error('Flight not found')
    err.status = 404
    throw err
  }

  if (decisionError) throw decisionError

  let airlineReport = null
  if (decision?.rejection_report_path) {
    const { data: reportBlob, error: reportError } = await supabase.storage
      .from('rejection-reports')
      .download(decision.rejection_report_path)

    if (reportError) {
      throw new Error(`Failed to fetch rejection report: ${reportError.message}`)
    }

    const reportBuffer = Buffer.from(await reportBlob.arrayBuffer())
    const fileName = decision.rejection_report_path.split('/').pop() || 'airline-rejection-report.pdf'

    airlineReport = {
      fileName,
      storagePath: decision.rejection_report_path,
      buffer: reportBuffer,
      fileSha256: bufferSha256Hex(reportBuffer),
    }
  }

  const evidencePayload = withOptionalFields({
    bookingRef: booking.booking_ref,
    passengerEmail: booking.passenger_email,
    passengerName: booking.passenger_name || null,
    passportNumber: booking.passport_number || null,
    flightId: booking.flight_id,
    flightCode: flight.flight_code,
    origin: flight.origin || booking.origin || null,
    destination: flight.destination || booking.destination || null,
    scheduledDeparture: booking.scheduled_departure_at || flight.scheduled_departure_at || null,
    scheduledArrival: booking.scheduled_arrival_at || flight.scheduled_arrival_at || null,
    actualArrival: flight.actual_arrival_at || null,
    delayMinutes: flight.delay_minutes ?? null,
    registrationStatus: registration.status,
    claimStatus: registration.claim_status,
    registrationTxHash: registration.tx_hash || null,
    registrationChainId: registration.chain_id ?? null,
    registrationContractAddress: registration.contract_address || null,
    registeredByWallet: registration.registered_by_wallet || null,
    oracleTxHash: flight.oracle_tx_hash || null,
    decision: decision?.decision || null,
    decisionTxHash: decision?.tx_hash || null,
    decisionChainId: decision?.chain_id ?? null,
    decisionContractAddress: decision?.contract_address || null,
    decidedAt: decision?.decided_at || null,
    evidenceHash: decision?.evidence_hash || null,
    rejectionReason: decision?.evidence?.description || null,
    rejectionReportPath: decision?.rejection_report_path || null,
    rejectionReportFileSha256: airlineReport?.fileSha256 || null,
  }, {
    registeredByWallet: registration.registered_by_wallet || null,
    decisionTxHash: decision?.tx_hash || null,
    decidedByWallet: decision?.decided_by_wallet || null,
  })

  const evidencePayloadSha256 = sha256Hex(stableStringify(evidencePayload))
  const generatedAt = new Date().toISOString()

  const manifest = {
    schemaVersion: '1.0',
    generatedAt,
    evidencePayloadSha256,
    booking: {
      bookingRef: booking.booking_ref,
      passengerEmail: booking.passenger_email,
      passengerName: booking.passenger_name || null,
      passportNumber: booking.passport_number || null,
    },
    flight: {
      flightId: booking.flight_id,
      flightCode: flight.flight_code,
      origin: flight.origin || booking.origin || null,
      destination: flight.destination || booking.destination || null,
      scheduledDeparture: booking.scheduled_departure_at || flight.scheduled_departure_at || null,
      scheduledArrival: booking.scheduled_arrival_at || flight.scheduled_arrival_at || null,
      actualArrival: flight.actual_arrival_at || null,
      delayMinutes: flight.delay_minutes ?? null,
    },
    claim: {
      registrationStatus: registration.status,
      claimStatus: registration.claim_status,
      decision: decision?.decision || null,
      decidedAt: decision?.decided_at || null,
      evidenceHash: decision?.evidence_hash || null,
      rejectionReason: decision?.evidence?.description || null,
    },
    blockchain: withOptionalFields({
      chainId: decision?.chain_id ?? registration.chain_id ?? null,
      contractAddress: decision?.contract_address || registration.contract_address || null,
      registrationTxHash: registration.tx_hash || null,
      oracleTxHash: flight.oracle_tx_hash || null,
    }, {
      decisionTxHash: decision?.tx_hash || null,
      registeredByWallet: registration.registered_by_wallet || null,
      decidedByWallet: decision?.decided_by_wallet || null,
    }),
    documents: {
      airlineRejectionReport: airlineReport
        ? {
            fileName: airlineReport.fileName,
            storagePath: airlineReport.storagePath,
            fileSha256: airlineReport.fileSha256,
            includedInZip: true,
          }
        : null,
    },
  }

  const report = {
    generatedAt,
    evidencePayloadSha256,
    booking: {
      bookingRef: booking.booking_ref,
      passengerEmail: booking.passenger_email,
    },
    flight: {
      flightId: booking.flight_id,
      flightCode: flight.flight_code || 'Not available',
      origin: flight.origin || booking.origin || 'Unknown',
      destination: flight.destination || booking.destination || 'Unknown',
      scheduledDeparture: booking.scheduled_departure_at || flight.scheduled_departure_at || 'Not available',
      scheduledArrival: booking.scheduled_arrival_at || flight.scheduled_arrival_at || 'Not available',
      actualArrival: flight.actual_arrival_at || null,
      delayLabel: flight.delay_minutes == null ? 'Not available' : `${flight.delay_minutes} minutes`,
    },
    claim: {
      claimStatus: registration.claim_status,
      decision: decision?.decision || null,
      decidedAt: decision?.decided_at || null,
      rejectionReason: decision?.evidence?.description || null,
      evidenceHash: decision?.evidence_hash || null,
    },
    blockchain: withOptionalFields({
      contractAddress: decision?.contract_address || registration.contract_address || null,
      chainId: decision?.chain_id ?? registration.chain_id ?? null,
      registrationTxHash: registration.tx_hash || null,
      oracleTxHash: flight.oracle_tx_hash || null,
    }, {
      decisionTxHash: decision?.tx_hash || null,
      registeredByWallet: registration.registered_by_wallet || null,
      decidedByWallet: decision?.decided_by_wallet || null,
    }),
    documents: {
      airlineRejectionReport: airlineReport
        ? {
            fileName: airlineReport.fileName,
            storagePath: airlineReport.storagePath,
            fileSha256: airlineReport.fileSha256,
          }
        : null,
    },
  }

  const pdfBuffer = await createPdfBuffer(report)
  const zip = new JSZip()
  zip.file('claim-report.pdf', pdfBuffer)
  zip.file('claim-manifest.json', JSON.stringify(manifest, null, 2))

  if (airlineReport) {
    zip.file('airline-rejection-report.pdf', airlineReport.buffer)
  }

  const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' })
  const safeBookingRef = booking.booking_ref.replace(/[^a-zA-Z0-9-]/g, '')

  return { zipBuffer, safeBookingRef, flightCode: flight.flight_code }
}
