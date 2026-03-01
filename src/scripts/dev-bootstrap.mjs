import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

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

async function main() {
  // Load Next.js env vars so Hardhat scripts can read values like NEXT_PUBLIC_AIRLINE_ADDRESS.
  const webEnvPath = path.join(process.cwd(), "src", "web", ".env.local");
  const webEnv = loadEnvFile(webEnvPath);
  const childEnv = { ...process.env, ...webEnv };

  console.log(`Contract: ${childEnv.NEXT_PUBLIC_CONTRACT_ADDRESS || "(not set)"}`);
  console.log();

  console.log("Starting Next.js UI...");
  const web = run("npm", ["--prefix", "src/web", "run", "dev"], { env: childEnv });

  console.log("Starting oracle worker (polling)...");
  const oracle = run("npm", ["run", "oracle:watch"], { env: childEnv });

  const shutdown = () => {
    if (web && !web.killed) web.kill("SIGINT");
    if (oracle && !oracle.killed) oracle.kill("SIGINT");
  };

  process.on("SIGINT", () => { shutdown(); process.exit(0); });
  process.on("SIGTERM", () => { shutdown(); process.exit(0); });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
