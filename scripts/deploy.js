import hre from "hardhat";
import fs from "fs";
import path from "path";

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

  // Get signers (accounts from the network)
  const [deployer, airline, oracle] = await hre.ethers.getSigners();

  console.log("Deployment Details:");
  console.log("├─ Network:", hre.network.name);
  console.log("├─ Deployer:", deployer.address);
  console.log("├─ Airline:", airline.address);
  console.log("└─ Oracle:", oracle.address);
  console.log();

  // Get contract factory
  const Compensation = await hre.ethers.getContractFactory("Compensation");

  // Deploy contract with airline and oracle addresses
  console.log("Deploying Compensation contract...");
  const compensation = await Compensation.deploy(airline.address, oracle.address);

  await compensation.waitForDeployment();
  const contractAddress = await compensation.getAddress();

  console.log("Contract deployed to:", contractAddress);
  console.log();

  // Fund the contract with some ETH for compensation payouts
  const fundAmount = hre.ethers.parseEther("10.0");
  console.log("Funding contract with", hre.ethers.formatEther(fundAmount), "ETH...");
  
  const tx = await deployer.sendTransaction({
    to: contractAddress,
    value: fundAmount,
  });
  await tx.wait();
  
  console.log("Contract funded successfully");
  console.log();

  // Save deployment info for the frontend
  const deploymentInfo = {
    network: hre.network.name,
    contractAddress: contractAddress,
    deployer: deployer.address,
    airline: airline.address,
    oracle: oracle.address,
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
  const webEnvPath = path.join(process.cwd(), "web", ".env.local");
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
    const webContractsDir = path.join(process.cwd(), "web/contracts");
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
  console.log("1. Start your UI: cd web && npm run dev");
  console.log("2. The contract address is now available in web/contracts/Compensation.json");
  console.log("3. Use the oracle account to mark flights delayed");
  console.log("4. Use any account to register flights and request compensation");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
