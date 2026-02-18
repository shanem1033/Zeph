import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { ethers } from 'ethers'
import { createClient } from '@supabase/supabase-js'

function stripOuterQuotes(value) {
  if (value.length >= 2) {
    const first = value[0]
    const last = value[value.length - 1]
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1)
    }
  }
  return value
}

function loadDotEnvFileIntoProcessEnv(filePath) {
  if (!fs.existsSync(filePath)) return false

  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split(/\r?\n/)

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue

    const key = trimmed.slice(0, eqIndex).trim()
    const rawValue = trimmed.slice(eqIndex + 1).trim()
    if (!key) continue

    // Only set missing vars; explicit shell env should win.
    if (process.env[key] != null) continue

    process.env[key] = stripOuterQuotes(rawValue)
  }

  return true
}

function requireEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required env var: ${name}`)
  }
  return value
}

function getBooleanEnv(name, defaultValue = false) {
  const raw = process.env[name]
  if (raw == null) return defaultValue
  return ['1', 'true', 'yes', 'on'].includes(String(raw).toLowerCase())
}

function getIntEnv(name, defaultValue) {
  const raw = process.env[name]
  if (raw == null || raw === '') return defaultValue
  const value = Number.parseInt(raw, 10)
  if (Number.isNaN(value)) return defaultValue
  return value
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseArgs(argv) {
  const args = {
    watch: false,
    intervalMs: undefined,
    dryRun: undefined,
    batchSize: undefined,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--watch') {
      args.watch = true
      continue
    }

    if (token === '--dry-run') {
      args.dryRun = true
      continue
    }

    if (token === '--interval-ms') {
      const value = argv[i + 1]
      i += 1
      const parsed = Number.parseInt(String(value), 10)
      if (!Number.isNaN(parsed)) args.intervalMs = parsed
      continue
    }

    if (token === '--batch-size') {
      const value = argv[i + 1]
      i += 1
      const parsed = Number.parseInt(String(value), 10)
      if (!Number.isNaN(parsed)) args.batchSize = parsed
      continue
    }
  }

  return args
}

function resolveFromRepoRoot(...segments) {
  // This file lives at src/scripts/oracle-worker.mjs
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)
  return path.resolve(__dirname, '..', '..', ...segments)
}

function loadDefaultEnvFiles() {
  // Load env files from src/web so the worker can share config with the Next.js app.
  // Do not overwrite any env vars already set in the shell.
  const envLocal = resolveFromRepoRoot('src', 'web', '.env.local')
  const env = resolveFromRepoRoot('src', 'web', '.env')

  const loadedLocal = loadDotEnvFileIntoProcessEnv(envLocal)
  const loadedEnv = loadDotEnvFileIntoProcessEnv(env)

  if (loadedLocal || loadedEnv) {
    console.log('[oracle] loaded env from src/web (.env.local/.env)')
  }
}

function loadContractConfig() {
  // Prefer the web ABI+address bundle written by deploy.js.
  const webBundlePath = resolveFromRepoRoot('src', 'web', 'contracts', 'Compensation.json')
  if (fs.existsSync(webBundlePath)) {
    const raw = JSON.parse(fs.readFileSync(webBundlePath, 'utf8'))
    if (raw?.address && raw?.abi) {
      return { address: raw.address, abi: raw.abi, source: webBundlePath }
    }
  }

  // Fallback to Hardhat artifact (ABI only) + CONTRACT_ADDRESS env.
  const artifactPath = resolveFromRepoRoot(
    'src',
    'artifacts',
    'src',
    'contracts',
    'Zeph.sol',
    'Compensation.json'
  )
  if (fs.existsSync(artifactPath)) {
    const raw = JSON.parse(fs.readFileSync(artifactPath, 'utf8'))
    if (raw?.abi) {
      const address = requireEnv('CONTRACT_ADDRESS')
      return { address, abi: raw.abi, source: artifactPath }
    }
  }

  throw new Error(
    'Unable to load contract config. Expected src/web/contracts/Compensation.json (with {abi,address}) or set CONTRACT_ADDRESS for artifact fallback.'
  )
}

function buildSupabaseAdminClient({ supabaseUrl, serviceRoleKey }) {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })
}

async function runOnce() {
  loadDefaultEnvFiles()

  const supabaseUrl = requireEnv('SUPABASE_URL')
  const supabaseServiceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  const rpcUrl = process.env.RPC_URL || 'http://127.0.0.1:8545'
  const oraclePrivateKey = requireEnv('ORACLE_PRIVATE_KEY')

  const cli = parseArgs(process.argv.slice(2))

  const dryRun = cli.dryRun ?? getBooleanEnv('ORACLE_DRY_RUN', false)
  const batchSize = cli.batchSize ?? getIntEnv('ORACLE_BATCH_SIZE', 10)

  const { address: contractAddress, abi, source: contractSource } = loadContractConfig()

  console.log('[oracle] starting run')
  console.log('[oracle] contract:', contractAddress)
  console.log('[oracle] contract config from:', contractSource)
  console.log('[oracle] rpc:', rpcUrl)
  console.log('[oracle] batch size:', batchSize)
  console.log('[oracle] dry run:', dryRun)

  const supabase = buildSupabaseAdminClient({
    supabaseUrl,
    serviceRoleKey: supabaseServiceRoleKey,
  })

  const provider = new ethers.JsonRpcProvider(rpcUrl)
  const wallet = new ethers.Wallet(oraclePrivateKey, provider)
  const contract = new ethers.Contract(contractAddress, abi, wallet)

  let delayThresholdMinutes = 180
  try {
    const threshold = await contract.DELAY_THRESHOLD_MINUTES()
    const parsed = Number.parseInt(String(threshold), 10)
    if (!Number.isNaN(parsed) && parsed > 0) delayThresholdMinutes = parsed
  } catch {
    // Ignore if contract doesn't expose the constant for some reason.
  }

  console.log('[oracle] delay threshold (minutes):', delayThresholdMinutes)

  const { data: pending, error: pendingError } = await supabase
    .from('flights')
    .select(
      'flight_id,delay_minutes,scheduled_arrival_at,actual_arrival_at,oracle_processed_at,oracle_tx_hash'
    )
    .not('actual_arrival_at', 'is', null)
    .is('oracle_processed_at', null)
    .not('delay_minutes', 'is', null)
    .order('actual_arrival_at', { ascending: true })
    .limit(batchSize)

  if (pendingError) {
    throw new Error(`Supabase query failed: ${pendingError.message}`)
  }

  const pendingList = Array.isArray(pending) ? pending : []
  console.log(`[oracle] pending flights: ${pendingList.length}`)
  if (pendingList.length === 0) return

  for (const flight of pendingList) {
    const flightId = flight.flight_id
    const delayMinutesRaw = Number.parseInt(String(flight.delay_minutes), 10)
    const delayMinutes = Number.isNaN(delayMinutesRaw) ? 0 : Math.max(0, delayMinutesRaw)

    const delayed = delayMinutes >= delayThresholdMinutes

    console.log(`[oracle] processing ${flightId} (delay_minutes=${delayMinutes})`) 

    if (dryRun) {
      console.log(`[oracle] dry-run: would call oracleReportDelay(${flightId}, ${delayMinutes})`)
      continue
    }

    const tx = await contract.oracleReportDelay(flightId, delayMinutes)
    console.log(`[oracle] tx sent: ${tx.hash}`)

    const receipt = await tx.wait(1)
    console.log(`[oracle] tx confirmed in block: ${receipt.blockNumber}`)

    const processedAtIso = new Date().toISOString()
    const { error: updateError } = await supabase
      .from('flights')
      .update({
        oracle_processed_at: processedAtIso,
        oracle_tx_hash: tx.hash,
      })
      .eq('flight_id', flightId)

    if (updateError) {
      throw new Error(`Supabase update failed for ${flightId}: ${updateError.message}`)
    }
    console.log(`[oracle] marked processed in DB: ${flightId}`)

    // Update claim status for all confirmed bookings on this flight.
    const targetClaimStatus = delayed ? 'awaiting_decision' : 'landed_on_time'

    const { data: bookingRows, error: bookingsError } = await supabase
      .from('bookings')
      .select('booking_ref')
      .eq('flight_id', flightId)

    if (bookingsError) {
      throw new Error(`Supabase bookings query failed for ${flightId}: ${bookingsError.message}`)
    }

    const bookingRefs = (Array.isArray(bookingRows) ? bookingRows : [])
      .map((b) => b.booking_ref)
      .filter(Boolean)

    if (bookingRefs.length === 0) {
      console.log(`[oracle] no bookings found for flight: ${flightId}`)
      continue
    }

    const { error: claimsUpdateError } = await supabase
      .from('registered_flights')
      .update({ claim_status: targetClaimStatus })
      .in('booking_ref', bookingRefs)
      .eq('status', 'confirmed')
      .eq('claim_status', 'registered')

    if (claimsUpdateError) {
      throw new Error(
        `Supabase registered_flights update failed for ${flightId}: ${claimsUpdateError.message}`
      )
    }

    console.log(`[oracle] updated claim_status=${targetClaimStatus} for flight: ${flightId}`)
  }
}

async function main() {
  const cli = parseArgs(process.argv.slice(2))
  const watch = cli.watch || getBooleanEnv('ORACLE_WATCH', false)
  const pollIntervalMs =
    cli.intervalMs ?? getIntEnv('ORACLE_POLL_INTERVAL_MS', 60_000)

  if (!watch) {
    await runOnce()
    return
  }

  console.log('[oracle] watch mode enabled')
  console.log('[oracle] poll interval (ms):', pollIntervalMs)

  let inFlight = false

  // Run immediately, then poll.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (inFlight) {
      await sleep(250)
      continue
    }

    inFlight = true
    try {
      await runOnce()
    } catch (err) {
      console.error('[oracle] run error:', err?.message || err)
    } finally {
      inFlight = false
    }

    await sleep(pollIntervalMs)
  }
}

main().catch((err) => {
  console.error('[oracle] fatal error:', err?.message || err)
  process.exitCode = 1
})
