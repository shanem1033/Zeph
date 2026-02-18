import crypto from 'node:crypto'
import { getSupabaseAdmin } from '../../../../utils/supabaseServer'

function sha256Hex(input) {
  return crypto.createHash('sha256').update(input).digest('hex')
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  try {
    const { flightId, decision, evidence, txHash, chainId, contractAddress, decidedByWallet } =
      req.body || {}

    if (!flightId || typeof flightId !== 'string') {
      return res.status(400).json({ ok: false, error: 'flightId is required' })
    }

    if (decision !== 'accepted' && decision !== 'rejected') {
      return res.status(400).json({ ok: false, error: "decision must be 'accepted' or 'rejected'" })
    }

    if (decision === 'rejected') {
      const hasEvidence = evidence && typeof evidence === 'object' && Object.keys(evidence).length > 0
      if (!hasEvidence) {
        return res.status(400).json({ ok: false, error: 'evidence is required when rejecting' })
      }
    }

    const supabase = getSupabaseAdmin()

    // Ensure there is at least one claim awaiting decision for this flight.
    const { data: bookingRows, error: bookingsError } = await supabase
      .from('bookings')
      .select('booking_ref')
      .eq('flight_id', flightId)

    if (bookingsError) throw bookingsError

    const bookingRefs = (Array.isArray(bookingRows) ? bookingRows : [])
      .map((b) => b.booking_ref)
      .filter(Boolean)

    if (bookingRefs.length === 0) {
      return res.status(404).json({ ok: false, error: 'No bookings found for this flight' })
    }

    const { data: awaitingRows, error: awaitingError } = await supabase
      .from('registered_flights')
      .select('booking_ref')
      .in('booking_ref', bookingRefs)
      .eq('status', 'confirmed')
      .eq('claim_status', 'awaiting_decision')
      .limit(1)

    if (awaitingError) throw awaitingError

    if (!awaitingRows || awaitingRows.length === 0) {
      return res
        .status(409)
        .json({ ok: false, error: 'No claims are awaiting decision for this flight' })
    }

    const evidenceJson = evidence && typeof evidence === 'object' ? evidence : null
    const evidenceHash = evidenceJson ? sha256Hex(JSON.stringify(evidenceJson)) : null

    // Upsert per-flight decision record.
    const { error: upsertError } = await supabase
      .from('flight_claim_decisions')
      .upsert(
        {
          flight_id: flightId,
          decision,
          evidence: evidenceJson,
          evidence_hash: evidenceHash,
          tx_hash: txHash || null,
          chain_id: Number.isFinite(Number(chainId)) ? Number(chainId) : null,
          contract_address: contractAddress || null,
          decided_by_wallet: decidedByWallet || null,
          decided_at: new Date().toISOString(),
        },
        { onConflict: 'flight_id' }
      )

    if (upsertError) throw upsertError

    // Apply decision to all passengers on that flight.
    const newClaimStatus = decision === 'accepted' ? 'accepted' : 'rejected'

    const { error: updateError } = await supabase
      .from('registered_flights')
      .update({ claim_status: newClaimStatus })
      .in('booking_ref', bookingRefs)
      .eq('status', 'confirmed')
      .eq('claim_status', 'awaiting_decision')

    if (updateError) throw updateError

    return res.status(200).json({
      ok: true,
      flightId,
      decision,
      evidenceHash,
      claimStatus: newClaimStatus,
    })
  } catch (err) {
    console.error('POST /api/airline/claims/decide error:', err)
    return res.status(500).json({ ok: false, error: err.message || 'Server error' })
  }
}
