# Zeph — Blockchain Flight Compensation Platform

A decentralised EU flight-delay compensation system. Passengers register flights on-chain, an oracle monitors delays, and airlines accept or reject claims — all enforced by a Solidity smart contract on Polygon. Compensation is paid automatically if an airline fails to respond within 7 days.

Final-year university project — CSC1097, DCU, 2025/26.

## Team

| Name | Student ID |
|---|---|
| Shane Mahon | 22376743 |
| Sean Sweeney | 22408204 |

## Tech Stack

| Layer | Technology |
|---|---|
| Smart Contract | Solidity 0.8.20, Hardhat, Ethers.js v5 |
| Blockchain | Polygon (local Hardhat node for development) |
| Frontend | Next.js 13, React 18 |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (JWT) |
| Oracle | Custom Node.js worker |
| Testing | Jest (frontend/API), Chai + Hardhat (contracts) |

## Architecture

- **Passengers** register flights and track claims via the web app
- **Oracle** polls flight data every 60 seconds and reports delays ≥ 180 minutes on-chain
- **Airlines** accept or reject claims; evidence hashes are stored on-chain for rejected claims
- **7-day auto-accept**: claims are automatically approved if the airline does not respond in time


For setup, deployment, and testing instructions see [User Manual](docs/documentation/)


## Documentation

- [Functional Specification](docs/functional-spec/)
- [Technical Guide](docs/documentation/)
- [User Manual](docs/documentation/)
- [Ethics Review](docs/ethics.pdf)
- [Video Walkthrough](docs/video-walk-through/)
