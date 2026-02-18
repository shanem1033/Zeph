import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import net from "node:net";

const HARDHAT_HOST = "127.0.0.1";
const HARDHAT_PORT = 8545;

function run(cmd, args, options = {}) {
  const child = spawn(cmd, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });

  child.on("exit", (code) => {
    if (code && code !== 0) {
      process.exitCode = code;
    }
  });

  return child;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const content = fs.readFileSync(filePath, "utf8");
  const env = {};

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    if (!key) continue;
    env[key] = value;
  }

  return env;
}

function isPortOpen(host, port, timeoutMs = 500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const onDone = (open) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(open);
    };

    socket.setTimeout(timeoutMs);
    socket.once("connect", () => onDone(true));
    socket.once("timeout", () => onDone(false));
    socket.once("error", () => onDone(false));

    socket.connect(port, host);
  });
}

async function waitForPort(host, port, timeoutMs = 20_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    // eslint-disable-next-line no-await-in-loop
    const open = await isPortOpen(host, port, 500);
    if (open) return;
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 500));
  }

  throw new Error(`Timed out waiting for ${host}:${port}`);
}

async function main() {
  // Load Next.js env vars so Hardhat scripts can read values like NEXT_PUBLIC_AIRLINE_ADDRESS.
  const webEnvPath = path.join(process.cwd(), "src", "web", ".env.local");
  const webEnv = loadEnvFile(webEnvPath);
  const childEnv = { ...process.env, ...webEnv };

  const alreadyRunning = await isPortOpen(HARDHAT_HOST, HARDHAT_PORT, 500);

  let hardhatProcess;
  if (alreadyRunning) {
    console.log(`Hardhat RPC already running at http://${HARDHAT_HOST}:${HARDHAT_PORT}`);
  } else {
    console.log("Starting Hardhat node...");
    hardhatProcess = run("npx", ["hardhat", "node"]);
    await waitForPort(HARDHAT_HOST, HARDHAT_PORT);
  }

  console.log("Deploying contract to localhost...");
  const deploy = spawn(
    "npx",
    ["hardhat", "run", "src/scripts/deploy.js", "--network", "localhost"],
    { stdio: "inherit", shell: process.platform === "win32", env: childEnv }
  );

  await new Promise((resolve, reject) => {
    deploy.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Deploy failed with exit code ${code}`));
    });
    deploy.on("error", reject);
  });

  console.log("Starting Next.js UI...");
  const web = run("npm", ["--prefix", "src/web", "run", "dev"], { env: childEnv });

  console.log("Starting oracle worker (polling)...");
  const oracle = run("npm", ["run", "oracle:watch"], { env: childEnv });

  const shutdown = () => {
    if (web && !web.killed) web.kill("SIGINT");
    if (oracle && !oracle.killed) oracle.kill("SIGINT");
    if (hardhatProcess && !hardhatProcess.killed) hardhatProcess.kill("SIGINT");
  };

  process.on("SIGINT", () => {
    shutdown();
    process.exit(0);
  });
  process.on("SIGTERM", () => {
    shutdown();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
