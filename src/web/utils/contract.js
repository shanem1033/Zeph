import { ethers } from 'ethers'
import Compensation from '../contracts/Compensation.json'

const DEFAULT_CHAIN_ID = 137
const DEFAULT_CONTRACT_ADDRESS = ""

function getExpectedChainId() {
  const fromEnv = process.env.NEXT_PUBLIC_CHAIN_ID
  const parsed = fromEnv ? Number(fromEnv) : NaN
  return Number.isFinite(parsed) ? parsed : DEFAULT_CHAIN_ID
}

function getContractAddress() {
  return (
    process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
    Compensation?.address ||
    DEFAULT_CONTRACT_ADDRESS
  )
}

const CONTRACT_ABI = Compensation?.abi || []

async function ensureCorrectNetwork(provider) {
  const expectedChainId = getExpectedChainId()
  const network = await provider.getNetwork()

  console.log(`Current chain ID: ${network.chainId}, Expected: ${expectedChainId}`)

  if (network.chainId === expectedChainId) return

  if (typeof window === 'undefined' || typeof window.ethereum === 'undefined') {
    throw new Error(`Wrong network. Please switch to chainId ${expectedChainId}.`)
  }

  const chainIdHex = '0x' + expectedChainId.toString(16)

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: chainIdHex }],
    })
  } catch (switchError) {
    // 4902 = Unrecognized chain — add it automatically
    if (switchError?.code === 4902) {
      const chainConfigs = {
        137: {
          chainId: '0x89',
          chainName: 'Polygon Mainnet',
          rpcUrls: ['https://polygon-rpc.com'],
          nativeCurrency: { name: 'POL', symbol: 'POL', decimals: 18 },
          blockExplorerUrls: ['https://polygonscan.com'],
        },
        31337: {
          chainId: '0x7A69',
          chainName: 'Hardhat Local',
          rpcUrls: ['http://127.0.0.1:8545'],
          nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
        },
      }

      const config = chainConfigs[expectedChainId]
      if (config) {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [config],
        })
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: config.chainId }],
        })
        return
      }
    }

    throw new Error(
      `Wrong network selected in MetaMask. Please switch to chainId ${expectedChainId}.`
    )
  }
}

async function ensureHasGasFunds(signer) {
  const balance = await signer.getBalance()
  if (!balance || balance.isZero()) {
    const expectedChainId = getExpectedChainId()
    const isPolygon = expectedChainId === 137
    throw new Error(
      `Insufficient funds for gas on this network (chainId ${expectedChainId}). ` +
      (isPolygon
        ? `Polygon Mainnet requires POL to pay gas fees. Please add POL to your wallet.`
        : `If you're using Hardhat Local (31337), switch MetaMask to Localhost and use a funded Hardhat account.`)
    )
  }
}

export async function getProvider() {
  if (typeof window.ethereum === 'undefined') {
    throw new Error('MetaMask is not installed. Please install MetaMask to continue.')
  }

  console.log('MetaMask chainId before creating provider:', window.ethereum.chainId)

  // Pass 'any' so ethers v5 doesn't throw NETWORK_ERROR when MetaMask switches chains.
  const provider = new ethers.providers.Web3Provider(window.ethereum, 'any')
  await provider.send("eth_requestAccounts", [])

  const network = await provider.getNetwork()
  console.log('Provider detected network:', network.chainId, network.name)

  return provider
}

export async function connectWallet() {
  try {
    const provider = await getProvider()
    await provider.send("eth_requestAccounts", [])

    // Ensure user is connected to the same chain the contract is deployed on
    await ensureCorrectNetwork(provider)

    const signer = provider.getSigner()
    const address = await signer.getAddress()
    return { signer, address }
  } catch (error) {
    console.error('Error connecting wallet:', error)
    throw error
  }
}

export async function getContract(signer) {
  return new ethers.Contract(getContractAddress(), CONTRACT_ABI, signer)
}

export async function registerFlight(flightId) {
  try {
    const { signer } = await connectWallet()
    const contract = await getContract(signer)

    // Call the smart contract function
    const tx = await contract.registerFlight(flightId)

    // Wait for transaction to be mined
    const receipt = await tx.wait()

    return {
      success: true,
      transactionHash: receipt.transactionHash,
      blockNumber: receipt.blockNumber
    }
  } catch (error) {
    console.error('Error registering flight:', error)

    // Handle specific errors
    if (error.code === 'ACTION_REJECTED') {
      throw new Error('Transaction was rejected by user')
    }

    if (error.code === 'INSUFFICIENT_FUNDS' || /insufficient funds/i.test(error.message || '')) {
      throw new Error(
        'Insufficient funds to pay gas. Polygon Mainnet requires POL in your wallet to cover transaction fees.'
      )
    }

    if (error.message.includes('Already registered')) {
      throw new Error('This flight has already been registered')
    }

    throw new Error(error.message || 'Failed to register flight')
  }
}

export async function airlineDecideFlight({ flightId, accept, evidenceHash }) {
  try {
    const { signer } = await connectWallet()
    const contract = await getContract(signer)

    // Fail fast with a clearer error if the connected wallet cannot call airline-only methods.
    const caller = await signer.getAddress()
    const airlineRole = await contract.AIRLINE_ROLE()
    let hasAirlineRole = await contract.hasRole(airlineRole, caller)

    // Auto-grant AIRLINE_ROLE via the server-side admin key so the airline
    // operator never has to run a manual CLI command.
    if (!hasAirlineRole) {
      console.log('[contract] Wallet missing AIRLINE_ROLE – requesting auto-grant…')
      console.log('[contract] contract address:', contract.address)
      console.log('[contract] caller:', caller)
      const grantRes = await fetch('/api/airline/grant-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: caller }),
      })
      const grantData = await grantRes.json().catch(() => null)
      console.log('[contract] grant-role API response:', grantData)
      if (!grantRes.ok || !grantData?.ok) {
        throw new Error(
          grantData?.error ||
          `Your connected wallet (${caller}) does not have AIRLINE_ROLE and auto-grant failed.`
        )
      }
      console.log('[contract] AIRLINE_ROLE granted successfully, proceeding with transaction.')
    }

    // Ensure the oracle delay is recorded on-chain for this flight.
    // After a contract redeploy the DB may show the flight as delayed but the
    // new contract instance won't have the flightDelayed flag yet.
    console.log('[contract] Ensuring flight delay is on-chain for', flightId)
    const ensureRes = await fetch('/api/airline/ensure-delay', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flightId }),
    })
    const ensureData = await ensureRes.json().catch(() => null)
    console.log('[contract] ensure-delay API response:', ensureData)
    if (!ensureRes.ok || !ensureData?.ok) {
      throw new Error(
        ensureData?.error ||
        `Flight ${flightId} is not marked as delayed on-chain and auto-reporting failed.`
      )
    }

    const hash = evidenceHash || ethers.constants.HashZero
    const tx = await contract.airlineDecideFlight(flightId, Boolean(accept), hash)
    const receipt = await tx.wait()

    return { success: true, transactionHash: receipt.transactionHash }
  } catch (error) {
    console.error('Error recording airline decision:', error)
    if (error.code === 'ACTION_REJECTED') {
      throw new Error('Transaction was rejected by user')
    }

    const message = String(error?.message || '')
    if (/Flight not delayed/i.test(message)) {
      throw new Error(
        'This flight is not marked as delayed on the smart contract. ' +
        'The oracle may not have processed it yet, or the contract was redeployed. Please try again.'
      )
    }
    if (/AccessControlUnauthorizedAccount/i.test(message) || /UnauthorizedAccount/i.test(message)) {
      throw new Error(
        'Your connected wallet does not have AIRLINE_ROLE on this contract. ' +
          'Either switch MetaMask to the airline account used during deployment, or grant the role to your wallet: ' +
          '`TARGET_ADDRESS=0xYourWalletAddress npm run grant:airline`'
      )
    }
    throw new Error(error.message || 'Failed to record airline decision')
  }
}
