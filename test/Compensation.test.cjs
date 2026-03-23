const { expect } = require('chai')
const { ethers } = require('hardhat')

describe('Compensation', function () {
  let contract, deployer, airline, oracle, passenger, other

  beforeEach(async function () {
    ;[deployer, airline, oracle, passenger, other] = await ethers.getSigners()
    const Factory = await ethers.getContractFactory('Compensation')
    contract = await Factory.deploy(airline.address, oracle.address)
  })

  // ─── Deployment ───────────────────────────────────────────────────────────

  describe('Deployment', function () {
    it('grants DEFAULT_ADMIN_ROLE to deployer', async function () {
      const adminRole = await contract.DEFAULT_ADMIN_ROLE()
      expect(await contract.hasRole(adminRole, deployer.address)).to.be.true
    })

    it('grants AIRLINE_ROLE to airline address', async function () {
      const airlineRole = await contract.AIRLINE_ROLE()
      expect(await contract.hasRole(airlineRole, airline.address)).to.be.true
    })

    it('grants ORACLE_ROLE to oracle address', async function () {
      const oracleRole = await contract.ORACLE_ROLE()
      expect(await contract.hasRole(oracleRole, oracle.address)).to.be.true
    })
  })

  // ─── registerFlight ───────────────────────────────────────────────────────

  describe('registerFlight', function () {
    it('allows a passenger to register a flight', async function () {
      await contract.connect(passenger).registerFlight('FR340')
      const [registered] = await contract.getClaim('FR340', passenger.address)
      expect(registered).to.be.true
    })

    it('emits FlightRegistered event', async function () {
      await expect(contract.connect(passenger).registerFlight('FR340'))
        .to.emit(contract, 'FlightRegistered')
        .withArgs('FR340', passenger.address)
    })

    it('reverts if the same passenger registers the same flight twice', async function () {
      await contract.connect(passenger).registerFlight('FR340')
      await expect(
        contract.connect(passenger).registerFlight('FR340')
      ).to.be.revertedWith('Already registered')
    })
  })

  // ─── oracleReportDelay ────────────────────────────────────────────────────

  describe('oracleReportDelay', function () {
    it('sets flightDelayed=true for delay >= 180 min', async function () {
      await contract.connect(oracle).oracleReportDelay('FR340', 200)
      const [, delayed] = await contract.getClaim('FR340', passenger.address)
      expect(delayed).to.be.true
    })

    it('sets flightDelayed=false for delay < 180 min', async function () {
      await contract.connect(oracle).oracleReportDelay('FR340', 100)
      const [, delayed] = await contract.getClaim('FR340', passenger.address)
      expect(delayed).to.be.false
    })

    it('sets flightDelayed=true for exactly 180 min (boundary)', async function () {
      await contract.connect(oracle).oracleReportDelay('FR340', 180)
      const [, delayed] = await contract.getClaim('FR340', passenger.address)
      expect(delayed).to.be.true
    })

    it('emits OracleDelayReported event', async function () {
      await expect(contract.connect(oracle).oracleReportDelay('FR340', 200))
        .to.emit(contract, 'OracleDelayReported')
        .withArgs('FR340', 200, true)
    })

    it('reverts if caller lacks ORACLE_ROLE', async function () {
      await expect(
        contract.connect(other).oracleReportDelay('FR340', 200)
      ).to.be.reverted
    })
  })

  // ─── airlineDecideFlight ──────────────────────────────────────────────────

  describe('airlineDecideFlight', function () {
    const flightId = 'FR340'
    const evidenceHash = ethers.encodeBytes32String('evidence-001')

    beforeEach(async function () {
      // Oracle reports a qualifying delay so the flight is eligible for a decision
      await contract.connect(oracle).oracleReportDelay(flightId, 200)
    })

    it('airline can accept a delayed flight', async function () {
      await contract
        .connect(airline)
        .airlineDecideFlight(flightId, true, ethers.ZeroHash)
      const [, , decision] = await contract.getClaim(flightId, passenger.address)
      expect(decision).to.equal(1) // FlightDecision.Accepted = 1
    })

    it('airline can reject with a non-zero evidence hash', async function () {
      await contract
        .connect(airline)
        .airlineDecideFlight(flightId, false, evidenceHash)
      const [, , decision, storedHash] = await contract.getClaim(
        flightId,
        passenger.address
      )
      expect(decision).to.equal(2) // FlightDecision.Rejected = 2
      expect(storedHash).to.equal(evidenceHash)
    })

    it('reverts if flight is not delayed', async function () {
      await expect(
        contract
          .connect(airline)
          .airlineDecideFlight('UNKNOWN_FLIGHT', true, ethers.ZeroHash)
      ).to.be.revertedWith('Flight not delayed')
    })

    it('reverts when rejecting without an evidence hash', async function () {
      await expect(
        contract
          .connect(airline)
          .airlineDecideFlight(flightId, false, ethers.ZeroHash)
      ).to.be.revertedWith('Evidence required')
    })

    it('reverts if decision already recorded', async function () {
      await contract
        .connect(airline)
        .airlineDecideFlight(flightId, true, ethers.ZeroHash)
      await expect(
        contract
          .connect(airline)
          .airlineDecideFlight(flightId, true, ethers.ZeroHash)
      ).to.be.revertedWith('Decision already recorded')
    })

    it('reverts if caller lacks AIRLINE_ROLE', async function () {
      await expect(
        contract
          .connect(other)
          .airlineDecideFlight(flightId, true, ethers.ZeroHash)
      ).to.be.reverted
    })
  })

  // ─── getClaim ─────────────────────────────────────────────────────────────

  describe('getClaim', function () {
    it('returns correct composite state after full registration + oracle + decision flow', async function () {
      const flightId = 'FR340'
      const evidenceHash = ethers.encodeBytes32String('evidence-xyz')

      await contract.connect(passenger).registerFlight(flightId)
      await contract.connect(oracle).oracleReportDelay(flightId, 210)
      await contract
        .connect(airline)
        .airlineDecideFlight(flightId, false, evidenceHash)

      const [registered, delayed, decision, storedHash] =
        await contract.getClaim(flightId, passenger.address)

      expect(registered).to.be.true
      expect(delayed).to.be.true
      expect(decision).to.equal(2) // Rejected
      expect(storedHash).to.equal(evidenceHash)
    })
  })
})
