import fs from 'node:fs'
import path from 'node:path'
import hre from 'hardhat'

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

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

async function main() {
  const flightId = requireEnv('FLIGHT_ID')
  const delayMinutesRaw = requireEnv('DELAY_MINUTES')
  const delayMinutes = Number.parseInt(delayMinutesRaw, 10)
  if (!Number.isFinite(delayMinutes) || delayMinutes < 0) {
    throw new Error('DELAY_MINUTES must be a non-negative integer.')
  }

  const contractAddress = loadContractAddress()

  const [deployer, airline, oracle] = await hre.ethers.getSigners()
  console.log('[oracle-report-delay] network:', hre.network.name)
  console.log('[oracle-report-delay] contract:', contractAddress)
  console.log('[oracle-report-delay] deployer:', deployer.address)
  console.log('[oracle-report-delay] airline:', airline.address)
  console.log('[oracle-report-delay] oracle:', oracle.address)
  console.log('[oracle-report-delay] flightId:', flightId)
  console.log('[oracle-report-delay] delayMinutes:', delayMinutes)

  const compensation = await hre.ethers.getContractAt('Compensation', contractAddress, oracle)
  const tx = await compensation.oracleReportDelay(flightId, delayMinutes)
  console.log('[oracle-report-delay] tx:', tx.hash)
  await tx.wait()
  console.log('[oracle-report-delay] done')
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
