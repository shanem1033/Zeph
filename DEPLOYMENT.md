# Deployment Guide

## Quick Start (Local Development)

### 1. Start Local Blockchain
Open a terminal and run:
```bash
npx hardhat node
```
Leave this running - it will show you 20 test accounts with ETH.

### 2. Deploy Contract (in a new terminal)
```bash
npx hardhat run src/scripts/deploy.js --network localhost
```

You'll see output like:
- Contract address
- Deployer, Airline, and Oracle addresses
- Contract funded with 10 ETH

### 3. Use the Contract
The deployment creates two files:
- `deployments/localhost.json` - Deployment details
- `src/web/contracts/Compensation.json` - ABI + address for frontend

## Test Accounts (from `npx hardhat node`)

The first 3 accounts are used for:
1. **Account 0**: Deployer (admin)
2. **Account 1**: Airline
3. **Account 2**: Oracle (marks flights delayed)
4. **Account 3+**: Available for passenger testing

## Contract Functions

### As a Passenger (any account):
```javascript
// Register flight with escrow
registerFlight("BA249", { value: ethers.parseEther("0.01") })

// After oracle marks delayed, request compensation
airlineDecideFlight("BA249", false, <evidenceHash>)
```

### As Oracle (Account 2):
```javascript
// Mark flight delayed (≥180 minutes)
setFlightDelayed("BA249", 185)
```

### Read Data:
```javascript
// Check claim status
getClaim("BA249", passengerAddress)
// Returns: [escrowAmount, registered, compensated, delayed]
```

## Testnet Deployment (Optional)

When ready to deploy to Sepolia testnet:

1. Create `.env` file:
```
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
PRIVATE_KEY=your_private_key_here
```

2. Uncomment Sepolia config in `hardhat.config.js`

3. Deploy:
```bash
npx hardhat run src/scripts/deploy.js --network sepolia
```

## Troubleshooting

**"insufficient funds"**: Make sure the contract has ETH
```bash
# Send more ETH to contract address
```

**"Already registered"**: Each address can only register a flight once

**"Flight not delayed"**: Oracle must call `setFlightDelayed()` first
