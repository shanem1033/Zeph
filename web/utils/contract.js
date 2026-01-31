import { ethers } from 'ethers'

const DEFAULT_CHAIN_ID = 31337
const DEFAULT_CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"

function getExpectedChainId() {
  const fromEnv = process.env.NEXT_PUBLIC_CHAIN_ID
  const parsed = fromEnv ? Number(fromEnv) : NaN
  return Number.isFinite(parsed) ? parsed : DEFAULT_CHAIN_ID
}

function getContractAddress() {
  return process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || DEFAULT_CONTRACT_ADDRESS
}

// Contract ABI - only the functions we need
const CONTRACT_ABI = [
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "flightId",
        "type": "string"
      }
    ],
    "name": "registerFlight",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "flightId",
        "type": "string"
      }
    ],
    "name": "requestCompensation",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "string",
        "name": "flightId",
        "type": "string"
      },
      {
        "internalType": "uint256",
        "name": "delayMinutes",
        "type": "uint256"
      }
    ],
    "name": "setFlightDelayed",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "",
        "type": "bytes32"
      },
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "name": "claims",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "escrowAmount",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "registered",
        "type": "bool"
      },
      {
        "internalType": "bool",
        "name": "compensated",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "string",
        "name": "flightId",
        "type": "string"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "traveler",
        "type": "address"
      }
    ],
    "name": "FlightRegistered",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "string",
        "name": "flightId",
        "type": "string"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "delayed",
        "type": "bool"
      }
    ],
    "name": "FlightStatusUpdated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": false,
        "internalType": "string",
        "name": "flightId",
        "type": "string"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "traveler",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "CompensationPaid",
    "type": "event"
  }
]

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
    // 4902 = Unrecognized chain
    if (switchError?.code === 4902 && expectedChainId === 31337) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: '0x7A69',
            chainName: 'Hardhat Local',
            rpcUrls: ['http://127.0.0.1:8545'],
            nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
          },
        ],
      })

      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: '0x7A69' }],
      })

      return
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
    throw new Error(
      `Insufficient funds for gas on this network (chainId ${expectedChainId}). ` +
      `Testnets still require gas paid in test ETH. If you're using Hardhat Local (31337), ` +
      `switch MetaMask to Localhost and use a funded Hardhat account.`
    )
  }
}

export async function getProvider() {
  if (typeof window.ethereum === 'undefined') {
    throw new Error('MetaMask is not installed. Please install MetaMask to continue.')
  }

  console.log('MetaMask chainId before creating provider:', window.ethereum.chainId)

  const provider = new ethers.providers.Web3Provider(window.ethereum)
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
    await ensureHasGasFunds(signer)
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
        'Insufficient funds to pay gas. Testnets are not gas-free — you need test ETH on the selected network. '
      )
    }

    if (error.message.includes('Already registered')) {
      throw new Error('This flight has already been registered')
    }

    throw new Error(error.message || 'Failed to register flight')
  }
}

export async function requestCompensation(flightId) {
  try {
    const { signer } = await connectWallet()
    await ensureHasGasFunds(signer)
    const contract = await getContract(signer)

    const tx = await contract.requestCompensation(flightId)
    const receipt = await tx.wait()

    return {
      success: true,
      transactionHash: receipt.transactionHash
    }
  } catch (error) {
    console.error('Error requesting compensation:', error)

    if (error.code === 'ACTION_REJECTED') {
      throw new Error('Transaction was rejected by user')
    }

    if (error.code === 'INSUFFICIENT_FUNDS' || /insufficient funds/i.test(error.message || '')) {
      throw new Error(
        'Insufficient funds to pay gas. Testnets are not gas-free — you need test ETH on the selected network. '
      )
    }

    if (error.message.includes('Flight not registered')) {
      throw new Error('This flight has not been registered')
    }

    if (error.message.includes('Already compensated')) {
      throw new Error('Compensation has already been claimed for this flight')
    }

    if (error.message.includes('Flight not delayed')) {
      throw new Error('This flight is not marked as delayed')
    }

    throw new Error(error.message || 'Failed to request compensation')
  }
}

export async function getClaimDetails(flightId, address) {
  try {
    const provider = await getProvider()
    const contract = new ethers.Contract(getContractAddress(), CONTRACT_ABI, provider)

    const [escrowAmount, registered, compensated, delayed] = await contract.getClaim(flightId, address)

    return {
      escrowAmount: ethers.utils.formatEther(escrowAmount),
      registered,
      compensated,
      delayed
    }
  } catch (error) {
    console.error('Error getting claim details:', error)
    throw error
  }
}
