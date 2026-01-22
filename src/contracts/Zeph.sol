// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title Compensation 
/// @notice Minimal prototype: users register a flight, an admin marks it delayed, and eligible users request compensation.

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract Compensation is AccessControl, ReentrancyGuard{
    bytes32 public constant AIRLINE_ROLE = keccak256("AIRLINE_ROLE");
    bytes32 public constant ORACLE_ROLE  = keccak256("ORACLE_ROLE");

    uint256 public constant DELAY_THRESHOLD_MINUTES = 180;

    struct ClaimRecord {
        uint256 escrowAmount; // funds provided up-front for the demo (can be removed in later versions)
        bool registered;      
        bool compensated;     
    }

    enum flightState {
        Unknown,
        Registered, 
        VerifiedDelayed,
        VerifiedNotDelayed
    }

    enum claimState {
        None,
        Eligible,
        Paid,
        Disputed
    }

    // flightId (hashed) -> user -> claim record
    mapping(bytes32 => mapping(address => ClaimRecord)) public claims;

    // flightId (hashed) -> delayed?
    mapping(bytes32 => bool) public flightDelayed;

    event FlightRegistered(string flightId, address indexed traveler);
    event FlightStatusUpdated(string flightId, bool delayed);
    event CompensationPaid(string flightId, address indexed traveler, uint256 amount);

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
        r.compensated = false;

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


    /// @notice Traveler requests compensation if the flight is marked delayed
    function requestCompensation(string calldata flightId) external nonReentrant {
        bytes32 key = keccak256(abi.encode(flightId));
        ClaimRecord storage r = claims[key][msg.sender];

        require(r.registered, "Flight not registered");
        require(!r.compensated, "Already compensated");
        require(flightDelayed[key], "Flight not delayed");

        // Simple demo rule: compensation = 2x escrow amount
        uint256 compensation = r.escrowAmount * 2;
        require(address(this).balance >= compensation, "Contract needs more funds");

        r.compensated = true;

        (bool ok, ) = msg.sender.call{value: compensation}("");
        require(ok, "Transfer failed");

        emit CompensationPaid(flightId, msg.sender, compensation);
    }
    
    function getClaim(string calldata flightId, address traveler)
    external view
    returns (uint256 escrowAmount, bool registered, bool compensated, bool delayed)
    {
        bytes32 key = keccak256(abi.encode(flightId));
        ClaimRecord storage r = claims[key][traveler];
        return (r.escrowAmount, r.registered, r.compensated, flightDelayed[key]);
    }

    /// @notice Fund the contract so it can pay compensation (send ETH directly)
    receive() external payable {}
}
