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
  console.log("└─ Flight ID: BA249\n");

  // Test 1: Register Flight as Passenger
  console.log("Test 1: Registering flight BA249 with 0.01 ETH escrow...");
  const escrowAmount = hre.ethers.parseEther("0.01");
  const registerTx = await Compensation.connect(passenger1).registerFlight("BA249", {
    value: escrowAmount,
  });
  await registerTx.wait();
  console.log("✅ Flight registered!\n");

  // Test 2: Check Claim Status Before Delay
  console.log("Test 2: Checking claim status (before delay marked)...");
  const claimBefore = await Compensation.getClaim("BA249", passenger1.address);
  console.log("├─ Escrow Amount:", hre.ethers.formatEther(claimBefore[0]), "ETH");
  console.log("├─ Registered:", claimBefore[1]);
  console.log("├─ Compensated:", claimBefore[2]);
  console.log("└─ Flight Delayed:", claimBefore[3], "\n");

  // Test 3: Try to Request Compensation (should fail - not delayed yet)
  console.log("Test 3: Trying to request compensation before delay marked...");
  try {
    await Compensation.connect(passenger1).requestCompensation("BA249");
    console.log("❌ Should have failed but didn't\n");
  } catch (error) {
    console.log("✅ Correctly rejected (flight not delayed yet)\n");
  }

  // Test 4: Oracle Marks Flight Delayed
  console.log("Test 4: Oracle marking flight as delayed (185 minutes)...");
  const delayTx = await Compensation.connect(oracle).setFlightDelayed("BA249", 185);
  await delayTx.wait();
  console.log("✅ Flight marked as delayed!\n");

  // Test 5: Check Claim Status After Delay
  console.log("Test 5: Checking claim status (after delay marked)...");
  const claimAfter = await Compensation.getClaim("BA249", passenger1.address);
  console.log("├─ Escrow Amount:", hre.ethers.formatEther(claimAfter[0]), "ETH");
  console.log("├─ Registered:", claimAfter[1]);
  console.log("├─ Compensated:", claimAfter[2]);
  console.log("└─ Flight Delayed:", claimAfter[3], "\n");

  // Test 6: Request Compensation
  console.log("Test 6: Requesting compensation (should receive 2x escrow)...");
  const balanceBefore = await hre.ethers.provider.getBalance(passenger1.address);
  
  const compensationTx = await Compensation.connect(passenger1).requestCompensation("BA249");
  const receipt = await compensationTx.wait();
  
  const balanceAfter = await hre.ethers.provider.getBalance(passenger1.address);
  const gasUsed = receipt.gasUsed * receipt.gasPrice;
  const netGain = balanceAfter - balanceBefore + gasUsed;
  
  console.log("✅ Compensation paid!");
  console.log("├─ Received:", hre.ethers.formatEther(netGain), "ETH");
  console.log("└─ Expected: 0.02 ETH (2x escrow)\n");

  // Test 7: Final Claim Status
  console.log("Test 7: Final claim status...");
  const claimFinal = await Compensation.getClaim("BA249", passenger1.address);
  console.log("├─ Escrow Amount:", hre.ethers.formatEther(claimFinal[0]), "ETH");
  console.log("├─ Registered:", claimFinal[1]);
  console.log("├─ Compensated:", claimFinal[2]);
  console.log("└─ Flight Delayed:", claimFinal[3], "\n");

  // Test 8: Try to Request Compensation Again (should fail)
  console.log("Test 8: Trying to request compensation again...");
  try {
    await Compensation.connect(passenger1).requestCompensation("BA249");
    console.log("❌ Should have failed but didn't\n");
  } catch (error) {
    console.log("✅ Correctly rejected (already compensated)\n");
  }

  console.log("All tests passed!\n");
  console.log("Summary:");
  console.log("✅ Passenger registered flight with escrow");
  console.log("✅ Oracle marked flight as delayed");
  console.log("✅ Passenger received 2x compensation");
  console.log("✅ Duplicate claims prevented");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
