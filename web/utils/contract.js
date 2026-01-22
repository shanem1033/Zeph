import { ethers } from 'ethers'

// Contract ABI - only the functions we need
const CONTRACT_ABI = [
  "function registerFlight(string calldata flightId) external",
  "function requestCompensation(string calldata flightId) external",
  "function getClaim(string calldata flightId, address traveler) external view returns (uint256 escrowAmount, bool registered, bool compensated, bool delayed)",
  "event FlightRegistered(string flightId, address indexed traveler)",
  "event CompensationPaid(string flightId, address indexed traveler, uint256 amount)"
]

// Contract address from deployment
const CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"

export async function getProvider() {
  if (typeof window.ethereum === 'undefined') {
    throw new Error('MetaMask is not installed. Please install MetaMask to continue.')
  }
  
  const provider = new ethers.providers.Web3Provider(window.ethereum)
  return provider
}

export async function connectWallet() {
  try {
    const provider = await getProvider()
    await provider.send("eth_requestAccounts", [])
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
