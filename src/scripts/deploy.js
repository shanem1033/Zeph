import hre from "hardhat";
import fs from "fs";
import path from "path";

function resolveOptionalAddress(value, label) {
  if (!value) return null;
  if (!hre.ethers.isAddress(value)) {
    throw new Error(`${label} is not a valid address: ${value}`);
  }
  return hre.ethers.getAddress(value);
}

function upsertEnvVars(filePath, vars) {
  let content = "";
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, "utf8");
  }

  for (const [key, value] of Object.entries(vars)) {
    const line = `${key}=${value}`;
    const re = new RegExp(`^${key}=.*$`, "m");
    if (re.test(content)) {
      content = content.replace(re, line);
    } else {
      if (content.length > 0 && !content.endsWith("\n")) content += "\n";
      content += line + "\n";
    }
  }

  fs.writeFileSync(filePath, content, "utf8");
}

async function main() {
  console.log(" Starting deployment...\n");

  // Get signers — on mainnet (Polygon etc.) only ONE signer is available from PRIVATE_KEY.
  // Airline and oracle fall back to the deployer in that case.
  const signers = await hre.ethers.getSigners();
  const deployer = signers[0];

  // Allow using an external wallet (e.g., MetaMask) as the airline.
  // This avoids needing to grant AIRLINE_ROLE manually after each redeploy.
  const airlineFromEnv = resolveOptionalAddress(
    process.env.AIRLINE_ADDRESS || process.env.NEXT_PUBLIC_AIRLINE_ADDRESS,
    "AIRLINE_ADDRESS"
  );
  const airlineAddress = airlineFromEnv || (signers[1] ? signers[1].address : deployer.address);

  // Oracle: use ORACLE_ADDRESS env var, or fall back to third signer, or deployer.
  const oracleFromEnv = resolveOptionalAddress(
    process.env.ORACLE_ADDRESS,
    "ORACLE_ADDRESS"
  );
  const oracle = signers[2] || signers[1] || deployer;
  const oracleAddress = oracleFromEnv || oracle.address;

  console.log("Deployment Details:");
  console.log("├─ Network:", hre.network.name);
  console.log("├─ Deployer:", deployer.address);
  console.log("├─ Airline:", airlineAddress);
  console.log("└─ Oracle:", oracleAddress);
  console.log();

  // Get contract factory
  const Compensation = await hre.ethers.getContractFactory("Compensation");

  // Deploy contract with airline and oracle addresses
  console.log("Deploying Compensation contract...");
  const compensation = await Compensation.deploy(airlineAddress, oracleAddress);

  await compensation.waitForDeployment();
  const contractAddress = await compensation.getAddress();

  console.log("Contract deployed to:", contractAddress);
  console.log();

  // Only seed test flight data on local/localhost networks to avoid wasting real gas on mainnet.
  const isLocalNetwork = ["hardhat", "localhost"].includes(hre.network.name);
  if (isLocalNetwork) {
    console.log("Setting up test flight FR123 with 240 minute delay...");
    const oracleContract = compensation.connect(oracle);
    const setDelayTx = await oracleContract.oracleReportDelay("FR123", 240);
    await setDelayTx.wait();
    console.log("FR123 marked as delayed (240 minutes)");
    console.log();
  } else {
    console.log("Skipping test data seed on", hre.network.name, "(mainnet — use oracle worker to report real delays)");
    console.log();
  }

  // Save deployment info for the frontend
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: contractAddress,
    deployer: deployer.address,
    airline: airlineAddress,
    oracle: oracleAddress,
    deployedAt: new Date().toISOString(),
  };

  const network = await hre.ethers.provider.getNetwork();

  const deploymentsDir = path.join(process.cwd(), "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const deploymentFile = path.join(deploymentsDir, `${hre.network.name}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));

  console.log("Deployment info saved to:", deploymentFile);
  console.log();

  // Write runtime config for Next.js (gitignored) so the UI always uses the latest deployment
  const webEnvPath = path.join(process.cwd(), "src", "web", ".env.local");
  upsertEnvVars(webEnvPath, {
    NEXT_PUBLIC_CONTRACT_ADDRESS: contractAddress,
    NEXT_PUBLIC_CHAIN_ID: network.chainId.toString(),
  });

  console.log("Frontend env written to:", webEnvPath);
  console.log();

  // Copy contract ABI to web directory for frontend
  const artifactPath = path.join(
    process.cwd(),
    "src/artifacts/src/contracts/Zeph.sol/Compensation.json"
  );

  if (fs.existsSync(artifactPath)) {
    const webContractsDir = path.join(process.cwd(), "src", "web", "contracts");
    if (!fs.existsSync(webContractsDir)) {
      fs.mkdirSync(webContractsDir, { recursive: true });
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));
    const abiFile = path.join(webContractsDir, "Compensation.json");

    fs.writeFileSync(
      abiFile,
      JSON.stringify({ abi: artifact.abi, address: contractAddress }, null, 2)
    );

    console.log("Contract ABI copied to:", abiFile);
    console.log();
  }

  console.log("Deployment complete!\n");
  console.log("Next steps:");
  console.log("1. Start your UI: cd src/web && npm run dev");
  console.log("2. The contract address is now available in src/web/contracts/Compensation.json");
  console.log("3. Use the oracle account to mark flights delayed");
  console.log("4. Use passenger accounts to register flights");
  console.log("5. Use the airline account to accept/reject delayed flights (evidence required for rejection)");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
