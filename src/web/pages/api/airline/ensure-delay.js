import { ethers } from 'ethers'
import Compensation from '../../../contracts/Compensation.json'
import { getSupabaseAdmin } from '../../../utils/supabaseServer'

/**
 * POST /api/airline/ensure-delay
 * Body: { flightId: "BA214-2026-02-17-0800" }
 *
 * Before the airline can accept/reject a claim on-chain, the oracle must have
 * called oracleReportDelay for that flight.  If the contract was redeployed
 * (or the oracle hasn't processed the flight yet), this endpoint checks the
 * on-chain flag and, when missing, uses the ORACLE_PRIVATE_KEY to report the
 * delay based on the DB delay_minutes value.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const { flightId } = req.body || {}
  if (!flightId || typeof flightId !== 'string') {
    return res.status(400).json({ ok: false, error: 'Missing or invalid flightId' })
  }

  const oracleKey = process.env.ORACLE_PRIVATE_KEY
  if (!oracleKey) {
    return res.status(500).json({ ok: false, error: 'ORACLE_PRIVATE_KEY is not configured on the server' })
  }

  const rpcUrl = process.env.RPC_URL || process.env.POLYGON_RPC_URL || 'https://polygon-bor-rpc.publicnode.com'
  const contractAddress =
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
    Compensation?.address ||
    null

  if (!contractAddress) {
    return res.status(500).json({ ok: false, error: 'Contract address not configured' })
  }

  try {
    const provider = new ethers.providers.JsonRpcProvider(rpcUrl)
    const oracle = new ethers.Wallet(oracleKey, provider)
    const contract = new ethers.Contract(contractAddress, Compensation.abi, oracle)

    // Check on-chain flag
    const key = ethers.utils.keccak256(ethers.utils.defaultAbiCoder.encode(['string'], [flightId]))
    const alreadyDelayed = await contract.flightDelayed(key)

    if (alreadyDelayed) {
      console.log(`[ensure-delay] ${flightId} already marked delayed on-chain`)
      return res.status(200).json({ ok: true, alreadyDelayed: true })
    }

    // Look up the delay_minutes from the DB
    const supabase = getSupabaseAdmin()
    const { data: flight, error: dbErr } = await supabase
      .from('flights')
      .select('delay_minutes')
      .eq('flight_id', flightId)
      .single()

    if (dbErr || !flight) {
      return res.status(404).json({ ok: false, error: `Flight ${flightId} not found in DB` })
    }

    const delayMinutes = Number(flight.delay_minutes) || 0
    if (delayMinutes < 180) {
      return res.status(400).json({
        ok: false,
        error: `Flight ${flightId} has only ${delayMinutes} min delay (threshold is 180). Cannot mark as delayed.`,
      })
    }

    console.log(`[ensure-delay] Reporting delay for ${flightId} (${delayMinutes} min) on-chain…`)
    const tx = await contract.oracleReportDelay(flightId, delayMinutes)
    const receipt = await tx.wait()
    console.log(`[ensure-delay] oracleReportDelay tx mined: ${receipt.transactionHash}`)

    // Also update the DB so the oracle worker doesn't re-process it
    await supabase
      .from('flights')
      .update({
        oracle_processed_at: new Date().toISOString(),
        oracle_tx_hash: receipt.transactionHash,
      })
      .eq('flight_id', flightId)

    return res.status(200).json({ ok: true, txHash: receipt.transactionHash })
  } catch (err) {
    console.error('[ensure-delay] Error:', err)
    return res.status(500).json({ ok: false, error: err.message || 'Failed to ensure delay' })
  }
}
