// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Compensation 
/// @notice Minimal prototype: users register a flight, an oracle reports delay, and the airline records a per-flight accept/reject decision.

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Compensation is AccessControl, ReentrancyGuard{
    bytes32 public constant AIRLINE_ROLE = keccak256("AIRLINE_ROLE");
    bytes32 public constant ORACLE_ROLE  = keccak256("ORACLE_ROLE");

    uint256 public constant DELAY_THRESHOLD_MINUTES = 180;

    struct ClaimRecord {
        bool registered;
    }

    enum FlightDecision {
        None,
        Accepted,
        Rejected
    }

    // flightId (hashed) -> user -> claim record
    mapping(bytes32 => mapping(address => ClaimRecord)) public claims;

    // flightId (hashed) -> delayed?
    mapping(bytes32 => bool) public flightDelayed;

    // flightId (hashed) -> airline decision
    mapping(bytes32 => FlightDecision) public flightDecision;

    // flightId (hashed) -> evidence hash (only meaningful for Rejected)
    mapping(bytes32 => bytes32) public flightDecisionEvidenceHash;

    event FlightRegistered(string flightId, address indexed traveler);
    event FlightStatusUpdated(string flightId, bool delayed);
    event FlightDecisionRecorded(string flightId, FlightDecision decision, bytes32 evidenceHash);

    constructor(address airline, address oracle) {
        // Admin role for managing other roles
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);

        // Domain roles
        _grantRole(AIRLINE_ROLE, airline);
        _grantRole(ORACLE_ROLE, oracle);
    }

    /// @notice Traveler registers a flight (demo uses escrow to fund contract logic)
    function registerFlight(string calldata flightId) external  {
        bytes32 key = keccak256(abi.encode(flightId));

        ClaimRecord storage r = claims[key][msg.sender];
        require(!r.registered, "Already registered");
        r.registered = true;

        emit FlightRegistered(flightId, msg.sender);
    }

    event OracleDelayReported(string flightId, uint256 delayMinutes, bool delayed);

    function oracleReportDelay(string calldata flightId, uint256 delayMinutes)
        external
        onlyRole(ORACLE_ROLE)
    {
        bytes32 key = keccak256(abi.encode(flightId));
        bool delayed = delayMinutes >= DELAY_THRESHOLD_MINUTES;

        flightDelayed[key] = delayed;

        emit OracleDelayReported(flightId, delayMinutes, delayed);
        emit FlightStatusUpdated(flightId, delayed);
    }

    function airlineDecideFlight(string calldata flightId, bool accept, bytes32 evidenceHash)
        external
        onlyRole(AIRLINE_ROLE)
        nonReentrant
    {
        bytes32 key = keccak256(abi.encode(flightId));

        require(flightDelayed[key], "Flight not delayed");
        require(flightDecision[key] == FlightDecision.None, "Decision already recorded");

        if (!accept) {
            require(evidenceHash != bytes32(0), "Evidence required");
        }

        FlightDecision decision = accept ? FlightDecision.Accepted : FlightDecision.Rejected;
        flightDecision[key] = decision;
        flightDecisionEvidenceHash[key] = evidenceHash;

        emit FlightDecisionRecorded(flightId, decision, evidenceHash);
    }

    function getClaim(string calldata flightId, address traveler)
        external
        view
        returns (bool registered, bool delayed, FlightDecision decision, bytes32 evidenceHash)
    {
        bytes32 key = keccak256(abi.encode(flightId));
        ClaimRecord storage r = claims[key][traveler];
        return (r.registered, flightDelayed[key], flightDecision[key], flightDecisionEvidenceHash[key]);
    }
}
