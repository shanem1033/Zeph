import { spawn } from "node:child_process";
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
    ["hardhat", "run", "scripts/deploy.js", "--network", "localhost"],
    { stdio: "inherit", shell: process.platform === "win32" }
  );

  await new Promise((resolve, reject) => {
    deploy.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Deploy failed with exit code ${code}`));
    });
    deploy.on("error", reject);
  });

  console.log("Starting Next.js UI...");
  const web = run("npm", ["--prefix", "web", "run", "dev"]);

  const shutdown = () => {
    if (web && !web.killed) web.kill("SIGINT");
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
