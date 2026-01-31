require("@nomicfoundation/hardhat-toolbox");

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
    // Uncomment and configure when ready for testnet deployment
    // sepolia: {
    //   url: process.env.SEPOLIA_RPC_URL || "",
    //   accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    //   chainId: 11155111,
    // },
  },
};
