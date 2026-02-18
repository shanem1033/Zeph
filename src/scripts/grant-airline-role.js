import fs from 'node:fs'
import path from 'node:path'
import hre from 'hardhat'

function resolveFromRepoRoot(...segments) {
  return path.resolve(process.cwd(), ...segments)
}

function loadContractAddress() {
  const fromEnv = process.env.CONTRACT_ADDRESS || process.env.NEXT_PUBLIC_CONTRACT_ADDRESS
  if (fromEnv) return fromEnv

  const webBundlePath = resolveFromRepoRoot('src', 'web', 'contracts', 'Compensation.json')
  if (fs.existsSync(webBundlePath)) {
    const raw = JSON.parse(fs.readFileSync(webBundlePath, 'utf8'))
    if (raw?.address) return raw.address
  }

  throw new Error(
    'Unable to determine contract address. Expected src/web/contracts/Compensation.json with an address field, or set CONTRACT_ADDRESS.'
  )
}

function getTargetAddress() {
  const maybe = process.env.TARGET_ADDRESS
  if (!maybe || !/^0x[0-9a-fA-F]{40}$/.test(maybe)) {
    throw new Error(
      'Missing/invalid TARGET_ADDRESS env var. Example (Git Bash):\n' +
        '  TARGET_ADDRESS=0xYourWalletAddress npm run grant:airline\n'
    )
  }
  return maybe
}

async function main() {
  const target = getTargetAddress()
  const contractAddress = loadContractAddress()

  const [admin] = await hre.ethers.getSigners()
  console.log('[grant-airline-role] network:', hre.network.name)
  console.log('[grant-airline-role] contract:', contractAddress)
  console.log('[grant-airline-role] admin signer:', admin.address)
  console.log('[grant-airline-role] target:', target)

  const compensation = await hre.ethers.getContractAt('Compensation', contractAddress, admin)
  const role = await compensation.AIRLINE_ROLE()

  const hadRole = await compensation.hasRole(role, target)
  console.log('[grant-airline-role] has AIRLINE_ROLE (before):', hadRole)

  if (!hadRole) {
    const tx = await compensation.grantRole(role, target)
    console.log('[grant-airline-role] tx:', tx.hash)
    await tx.wait()
  }

  const hasRoleNow = await compensation.hasRole(role, target)
  console.log('[grant-airline-role] has AIRLINE_ROLE (after):', hasRoleNow)
  if (!hasRoleNow) {
    throw new Error('Failed to grant AIRLINE_ROLE (unexpected).')
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
