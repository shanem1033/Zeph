import hre from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  console.log("Testing Compensation Contract...\n");

  // Get accounts
  const [deployer, airline, oracle, passenger1] = await hre.ethers.getSigners();

  // Load deployed contract address from deployment file
  const deploymentFile = path.join(process.cwd(), "deployments", `${hre.network.name}.json`);
  
  if (!fs.existsSync(deploymentFile)) {
    console.error("❌ Deployment file not found:", deploymentFile);
    console.error(
      "Please run: npx hardhat run src/scripts/deploy.js --network",
      hre.network.name
    );
    process.exit(1);
  }

  const deployment = JSON.parse(fs.readFileSync(deploymentFile, "utf8"));
  const contractAddress = deployment.contractAddress;
  const Compensation = await hre.ethers.getContractAt("Compensation", contractAddress);

  console.log("Test Setup:");
  console.log("├─ Contract:", contractAddress);
  console.log("├─ Passenger:", passenger1.address);
  console.log("├─ Oracle:", oracle.address);
  console.log("├─ Airline:", airline.address);
  console.log("└─ Flight ID: BA249\n");

  // Test 1: Register Flight as Passenger
  console.log("Test 1: Registering flight BA249...");
  const registerTx = await Compensation.connect(passenger1).registerFlight("BA249");
  await registerTx.wait();
  console.log("✅ Flight registered!\n");

  // Test 2: Check Claim Status Before Delay
  console.log("Test 2: Checking claim status (before delay reported)...");
  const claimBefore = await Compensation.getClaim("BA249", passenger1.address);
  console.log("├─ Registered:", claimBefore[0]);
  console.log("├─ Flight Delayed:", claimBefore[1]);
  console.log("├─ Decision:", claimBefore[2]);
  console.log("└─ Evidence Hash:", claimBefore[3], "\n");

  // Test 3: Oracle Marks Flight Delayed
  console.log("Test 3: Oracle reporting delay for BA249 (185 minutes)...");
  const delayTx = await Compensation.connect(oracle).oracleReportDelay("BA249", 185);
  await delayTx.wait();
  console.log("✅ Flight marked as delayed!\n");

  // Test 5: Check Claim Status After Delay
  console.log("Test 4: Airline rejecting claim for BA249 (evidence required)...");
  const evidenceHash = hre.ethers.keccak256(hre.ethers.toUtf8Bytes("weather diversion"));
  const decideTx = await Compensation.connect(airline).airlineDecideFlight("BA249", false, evidenceHash);
  await decideTx.wait();
  console.log("✅ Airline decision recorded!\n");

  console.log("Test 5: Final claim status...");
  const claimFinal = await Compensation.getClaim("BA249", passenger1.address);
  console.log("├─ Registered:", claimFinal[0]);
  console.log("├─ Flight Delayed:", claimFinal[1]);
  console.log("├─ Decision:", claimFinal[2]);
  console.log("└─ Evidence Hash:", claimFinal[3], "\n");

  console.log("All tests passed!\n");
  console.log("Summary:");
  console.log("✅ Passenger registered flight");
  console.log("✅ Oracle reported delay");
  console.log("✅ Airline recorded per-flight decision with evidence hash");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
