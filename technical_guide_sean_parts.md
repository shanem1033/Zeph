# Technical Guide - Sean's Sections (Draft)

## 1. Introduction (Sean)
This document outlines the design, implementation, and testing of a decentralized flight delay compensation platform. The system aims to automate and streamline the traditionally slow and bureaucratic process of claiming compensation for delayed or canceled flights. By bridging a modern web architecture (Next.js and Supabase) with blockchain technology (smart contracts on the Polygon network), the platform ensures transparent, immutable, and automated payouts. This guide details the project motivation, technical research, system architecture, core implementation details, and a comprehensive breakdown of our testing and verification strategies.

---

## 3. Research (Sean)
The foundational research for this project focused on three main areas: domain regulations, blockchain interoperability, and modern full-stack web frameworks. 

**Regulatory Context:** We analyzed existing compensation frameworks, primarily EU Regulation 261/2004 (EU261), which mandates compensation for passengers experiencing delays exceeding 180 minutes. The research highlighted immense inefficiencies in how airlines process these claims manually, leading to delayed payouts and frustrated consumers.

**Blockchain and Oracles:** To guarantee trustless payouts, we researched smart contracts. A major hurdle discovered during research was the "Oracle Problem"—smart contracts cannot natively access off-chain data (such as live flight statuses). This informed our decision to build a custom external Oracle worker that fetches real-world flight data and pushes it on-chain to trigger state changes securely. Polygon was chosen as the target network due to its low gas fees and high transaction throughput compared to Ethereum mainnet.

**Web Technology Stack:** For the off-chain Web2 components, research led us to Next.js for its robust server-side API routes and seamless React frontend integration. Supabase was selected as the database provider over Firebase or traditional AWS RDS due to its built-in PostgreSQL row-level security (RLS), real-time capabilities, and seamless authentication handling.

---

## 5. Implementation (Sean)
The system was implemented using a hybrid Web2/Web3 architecture. 

**Frontend & API (Next.js):** The user interface was built using React components, styled for responsive design. The backend relies heavily on Next.js API routes (`/api/*`) to handle secure operations that cannot be exposed to the client, such as cron jobs, PDF/ZIP evidence generation via `adm-zip`, and administrative flight state updates. 

**Database & Auth (Supabase):** PostgreSQL (managed by Supabase) acts as the central source of truth for off-chain relational data. We utilized structured tables (e.g., `registered_flights`, `flight_claim_decisions`, `bookings`) to track the lifecycle of a claim. Supabase Auth manages passenger and airline sessions securely via JWTs. 

**Blockchain Integration:** The Web3 layer connects the web frontend to the Polygon network using `ethers.js`. Smart contracts written in Solidity handle the escrow of funds and conditional payouts. When a passenger claims their compensation, MetaMask is invoked to sign the transaction.

**Automation (Cron & Oracle):** To ensure airlines cannot ignore claims indefinitely, we implemented a serverless cron job that automatically accepts claims (`auto_accepted`) if the airline fails to provide a decision within a 7-day window threshold relative to the flight's actual arrival time.

---

## 7. Problems Solved (Sean)
Throughout development, several major technical hurdles were overcome:

* **State Synchronization between Web2 and Web3:** Ensuring that the Supabase database perfectly mirrored the state of the blockchain smart contract was challenging. This was solved by ensuring API routes that interacted with the blockchain used explicit transactional logic, only updating the database upon successful transaction receipts.
* **Handling Inactive Airlines:** A design flaw in early iterations meant that if an airline ignored a valid claim, the passenger's request would sit in limbo forever. By implementing a daily cron job (`/api/cron/auto-accept`) that scans for claims older than 7 days, we automated the acceptance process, resolving the bottleneck and protecting the passenger.
* **Backend Evidence Generation:** Airlines required structured evidence to review claims. We solved this by creating a complex backend pipeline that aggregates flight data, queries Supabase, and dynamically streams PDF reports and ZIP archives directly to the browser without requiring intermediate disk storage.
* **Blockchain Transaction UX:** Handling rejected MetaMask prompts, insufficient gas errors, and pending transaction states often resulted in poor UX. We mitigated this by wrapping blockchain calls in robust `try/catch` blocks that update the UI with user-friendly error messages and loading spinners.

---

## 8.2 Unit Testing (Sean)
Unit testing was conducted using the **Jest** framework to verify individual backend functions and API routes in isolation. Because our API routes interact heavily with the database, we built a custom chainable mock builder for Supabase (`utils/__mocks__/supabaseServer.js`). This allowed us to simulate database queries (e.g., `.select()`, `.eq()`, `.not()`, `.gte()`) and return predicted JSON payloads without hitting a live database. We tested critical logic routes, verifying that invalid inputs returned `400 Bad Request` and valid payloads triggered the correct internal data transformations and `200/201` success status codes.

| | |
|---|---|
| **ROUTE** | POST /api/cron/auto-accept |
| **INPUT** | Flight with awaiting claims older than 7 days |
| **EXPECTED** | 200 (Count: 1) |
| **RESULT** | Pass |

<br>

| | |
|---|---|
| **ROUTE** | POST /api/bookings |
| **INPUT** | Missing departureCity |
| **EXPECTED** | 400 |
| **RESULT** | Pass |

<br>

| | |
|---|---|
| **ROUTE** | POST /api/airline/claims/decide |
| **INPUT** | Rejecting claim without providing evidence |
| **EXPECTED** | 400 |
| **RESULT** | Pass |

<br>

| | |
|---|---|
| **ROUTE** | POST /api/bookings |
| **INPUT** | Valid booking payload for known route |
| **EXPECTED** | 200 |
| **RESULT** | Pass |

---

## 8.4 Smart Contract and Blockchain Testing (Sean)
The blockchain components were tested using the **Hardhat** development environment alongside **Chai** assertions. Operating on a local Hardhat node, we simulated deployment, role assumption, and transaction execution. Tests verified that:
* Only addresses with the designated `ORACLE_ROLE` could report flight delays.
* The contract accurately tracked passenger registrations.
* Funds were locked and successfully transferred back to passengers upon an "accepted" claim state. 
* Gas consumption remained within expected limits.

| | |
|---|---|
| **FUNCTION** | registerFlight(string flightId) |
| **INPUT** | Passenger registers flight twice |
| **EXPECTED** | Reverted with "Already registered" |
| **RESULT** | Pass |

<br>

| | |
|---|---|
| **FUNCTION** | oracleReportDelay(string flightId, uint256 delay) |
| **INPUT** | Delay reported >= 180 mins |
| **EXPECTED** | delayed flag set to true |
| **RESULT** | Pass |

<br>

| | |
|---|---|
| **FUNCTION** | airlineDecideFlight(string flightId, bool delayAccepted, bytes32 evidenceHash) |
| **INPUT** | Airline rejects without evidence |
| **EXPECTED** | Reverted with "Evidence required" |
| **RESULT** | Pass |

---

## 8.6 User Interface Testing (Sean)
UI testing was approached from a user-centric perspective, testing both the Passenger and Airline dashboards. For the passenger experience, we verified that the flow of entering a booking reference, registering a flight, and viewing claim statuses (e.g., "Awaiting Decision", "Auto-Accepted ✓") functioned smoothly across differing browser window sizes. For airlines, we validated the filtering mechanisms (viewing delayed vs. on-time flights) and ensured claim decision modals rendered accurately, cleanly surfacing rejection reasoning and evidence files.

---

## 8.8 Error Handling and Edge Cases (Sean)
To ensure system resilience, diverse edge cases and error states were rigorously tested:
* **Missing/Malformed Inputs:** API routes were tested with empty arrays, undefined variables, and malformed booking UUIDs, successfully catching these and returning safe `400` errors.
* **Blockchain Failures:** Tested scenarios where users rejected MetaMask signature requests or didn't have enough MATIC for gas, ensuring the UI didn't crash and displayed a helpful toast notification instead.
* **Database Outages:** Simulated Supabase connection failures to ensure API endpoints gracefully failed with comprehensive `500 Server Error` JSON responses instead of crashing the Node process.
* **Duplicate Actions:** Tested race conditions, such as a cron job attempting to auto-accept a claim at the exact second an airline manually accepted it, utilizing database constraints to prevent duplicate database entries.

---

## 8.10 Future Testing Improvements + Testing Limitations (Sean)
**Limitations:** Due to time constraints, the project relied heavily on manual UI testing over automated browser tests. Simulating real-world blockchain network congestion, fluctuating gas fees, and block-mining delays is inherently difficult on a local, instant-mining Hardhat node, meaning some Web3 UX edge cases were difficult to replicate exactly as they would appear on mainnet.

**Future Improvements:** In later iterations, testing could be drastically improved by integrating End-to-End (E2E) testing frameworks like Cypress or Playwright. Using specialized Web3 testing tools (like Synpress) would allow us to automate MetaMask wallet interactions and test the complete visual flow from React click to blockchain transaction in a CI/CD pipeline (e.g., GitHub Actions).

---

## 10. Future Work (Sean)
While the core architecture successfully processes automated claims, future versions could be expanded in several ways:
1. **Decentralized Oracles:** Transitioning from a single, centralized custom oracle worker to a decentralized oracle network (DON) like Chainlink. This would remove the single point of failure when fetching flight delay data.
2. **Zero-Knowledge Proofs (ZKPs):** Integrating ZKP technology to verify passenger identity and passport details on-chain without exposing personally identifiable information (PII) to the public ledger.
3. **Stablecoin Payouts:** Upgrading the smart contracts to support payouts in USDC or USDT to protect passengers from the volatility of native cryptocurrency tokens.
4. **Expanded Claim Scenarios:** Extending the operational logic beyond 180-minute delays to cover outright flight cancellations, lost baggage claims, and tiered compensation based on flight distance.

---

## 11. References (Both)
*(To be populated with links to EU261 regulations, Next.js documentation, Solidity docs, Supabase docs, etc.)*
1. European Union, "Regulation (EC) No 261/2004 of the European Parliament", Official Journal of the European Union, 2004.
2. Next.js Documentation. Vercel. https://nextjs.org/docs
3. Supabase Documentation. https://supabase.com/docs
4. Hardhat Documentation. Nomic Foundation. https://hardhat.org/

---

## 12. Appendices (Both)
*(To be populated with supporting material)*
* **Appendix A:** Database Schema Diagram (Supabase).
* **Appendix B:** Smart Contract Application Binary Interface (ABI) excerpts.
* **Appendix C:** Sequence Diagram illustrating the Flight Delay Oracle data flow.
