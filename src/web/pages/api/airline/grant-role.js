import { ethers } from 'ethers'
import Compensation from '../../../contracts/Compensation.json'

/**
 * POST /api/airline/grant-role
 * Body: { address: "0x..." }
 *
 * Uses the deployer (DEFAULT_ADMIN_ROLE holder) private key to grant
 * AIRLINE_ROLE to the given address on the deployed contract.
 * This keeps the airline UI seamless — any MetaMask wallet used by the
 * airline operator automatically receives the on-chain permission.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' })
  }

  const { address } = req.body || {}
  if (!address || !ethers.utils.isAddress(address)) {
    return res.status(400).json({ ok: false, error: 'Invalid or missing address' })
  }

  const adminKey = process.env.ADMIN_PRIVATE_KEY
  if (!adminKey) {
    return res.status(500).json({ ok: false, error: 'ADMIN_PRIVATE_KEY is not configured on the server' })
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
    const admin = new ethers.Wallet(adminKey, provider)

    console.log('[grant-role] admin address:', admin.address)
    console.log('[grant-role] contract address:', contractAddress)
    console.log('[grant-role] target address:', address)

    const contract = new ethers.Contract(contractAddress, Compensation.abi, admin)

    // Verify the admin wallet actually holds DEFAULT_ADMIN_ROLE
    const defaultAdminRole = await contract.DEFAULT_ADMIN_ROLE()
    const adminHasRole = await contract.hasRole(defaultAdminRole, admin.address)
    console.log('[grant-role] admin has DEFAULT_ADMIN_ROLE:', adminHasRole)
    if (!adminHasRole) {
      return res.status(500).json({
        ok: false,
        error: `Admin wallet ${admin.address} does not hold DEFAULT_ADMIN_ROLE on contract ${contractAddress}. Was the contract redeployed?`,
      })
    }

    const airlineRole = await contract.AIRLINE_ROLE()
    const alreadyHasRole = await contract.hasRole(airlineRole, address)
    console.log('[grant-role] target already has AIRLINE_ROLE:', alreadyHasRole)

    if (alreadyHasRole) {
      return res.status(200).json({ ok: true, alreadyGranted: true })
    }

    const tx = await contract.grantRole(airlineRole, address)
    const receipt = await tx.wait()
    console.log('[grant-role] grantRole tx mined:', receipt.transactionHash)

    // Verify the grant actually took effect
    const hasRoleNow = await contract.hasRole(airlineRole, address)
    console.log('[grant-role] target has AIRLINE_ROLE after grant:', hasRoleNow)
    if (!hasRoleNow) {
      return res.status(500).json({ ok: false, error: 'grantRole tx succeeded but hasRole still returns false' })
    }

    return res.status(200).json({ ok: true, txHash: receipt.transactionHash })
  } catch (err) {
    console.error('[grant-role] Error granting AIRLINE_ROLE:', err)
    return res.status(500).json({ ok: false, error: err.message || 'Failed to grant role' })
  }
}
