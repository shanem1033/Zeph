require("@nomicfoundation/hardhat-toolbox");
const fs = require("fs");
const path = require("path");

// Load src/web/.env.local early so PRIVATE_KEY etc. are available for network config.
const webEnvPath = path.resolve(__dirname, "src", "web", ".env.local");
if (fs.existsSync(webEnvPath)) {
  const lines = fs.readFileSync(webEnvPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

module.exports = {
  solidity: "0.8.20",
  paths: {
    sources: "src/contracts",
    artifacts: "src/artifacts"
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    polygon: {
      url: process.env.POLYGON_RPC_URL || "https://polygon-bor-rpc.publicnode.com",
      accounts: process.env.PRIVATE_KEY
        ? [process.env.PRIVATE_KEY.startsWith("0x") ? process.env.PRIVATE_KEY : `0x${process.env.PRIVATE_KEY}`]
        : [],
      chainId: 137,
    },
    // Sepolia testnet (free alternative if needed)
    // sepolia: {
    //   url: process.env.SEPOLIA_RPC_URL || "",
    //   accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    //   chainId: 11155111,
    // },
  },
};
