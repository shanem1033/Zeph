// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title SimpleFlightCompensation (MVP)
/// @notice Minimal prototype: users register a flight, an admin marks it delayed, and eligible users request compensation.
contract FlightCompensation {
    address public admin;
    //string flightID;
    uint256 constant DELAY_THRESHOLD_MINUTES = 180;   

    struct ClaimRecord {
        uint256 escrowAmount; // funds provided up-front for the demo (can be removed in later versions)
        bool registered;      
        bool compensated;
    }

    // flightId (hashed) -> user -> claim record
    mapping(bytes32 => mapping(address => ClaimRecord)) public claims;

    // flightId (hashed) -> delayed?
    mapping(bytes32 => bool) public flightDelayed;

    event FlightRegistered(string flightId, address indexed traveler, uint256 escrowAmount);
    event FlightStatusUpdated(string flightId, bool delayed);
    event CompensationPaid(string flightId, address indexed traveler, uint256 amount);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }

    constructor() {
        admin = msg.sender;
    }

    /// @notice Traveler registers a flight (demo uses escrow to fund contract logic)
    function registerFlight(string calldata flightId) external payable {
        require(msg.value > 0, "Send escrow amount");
        bytes32 key = keccak256(abi.encode(flightId));

        ClaimRecord storage r = claims[key][msg.sender];
        require(!r.registered, "Already registered");

        r.escrowAmount = msg.value;
        r.registered = true;
        r.compensated = false;

        emit FlightRegistered(flightId, msg.sender, msg.value);
    }

    /// @notice Admin updates flight status (simulates external flight data / verification)
    function setFlightDelayed(string calldata flightId, uint256 delayMinutes) external onlyAdmin {
        bytes32 key = keccak256(abi.encode(flightId));
        bool delayed = (delayMinutes > DELAY_THRESHOLD_MINUTES);
    
        flightDelayed[key] = delayed;
        emit FlightStatusUpdated(flightId, delayed);
    }

    /// @notice Traveler requests compensation if the flight is marked delayed
    function requestCompensation(string calldata flightId) external {
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

    /// @notice Fund the contract so it can pay compensation (send ETH directly)
    receive() external payable {}
}
