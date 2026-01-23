import { ethers } from 'ethers'

// Contract ABI from FlightCompensation contract
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

// Contract address from deployment
const CONTRACT_ADDRESS = "0x322813Fd9A801c5507c9de605d63CEA4f2CE6c44"

export async function getProvider() {
  if (typeof window.ethereum === 'undefined') {
    throw new Error('MetaMask is not installed. Please install MetaMask to continue.')
  }

  const provider = new ethers.providers.Web3Provider(window.ethereum)
  await provider.send("eth_requestAccounts", [])
  return provider
}

export async function connectWallet() {
  try {
    const provider = await getProvider()
    const signer = provider.getSigner()
    const address = await signer.getAddress()
    return { signer, address }
  } catch (error) {
    console.error('Error connecting wallet:', error)
    throw error
  }
}

export async function getContract(signer) {
  return new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)
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

    if (error.message.includes('Already registered')) {
      throw new Error('This flight has already been registered')
    }

    throw new Error(error.message || 'Failed to register flight')
  }
}

export async function requestCompensation(flightId) {
  try {
    const { signer } = await connectWallet()
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
    const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, provider)

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
