# School of Computing &mdash; Year 4 Project Proposal Form


## SECTION A


|                     |                   |
|---------------------|-------------------|
|Project Title:       | Zeph (Blockchain Insurance)  |
|Student 1 Name:      | Sean Sweeney            |
|Student 1 ID:        | 22408204            |
|Student 2 Name:      | Shane Mahon            |
|Student 2 ID:        | 22376743           |
|Project Supervisor:  | Geoff Hamilton            |


## SECTION B


### Introduction


The goal of this project is to automate the process of receiving compensation from an airline if a passenger's flight is delayed within the bounds of EU regulation EU261/2004.


This regulation states that if a passenger arrives 3 or more hours after their scheduled arrival then they are entitled to compensation. However if the flight delay is caused by extraordinary circumstances that the airline could not have avoided even if they had taken all reasonable measures, a passenger is not entitled to any compensation (e.g. severe weather, security risks, airport closures, medical emergencies etc). This compensation payment is all passengers right and is not part of any insurance premium.


The current process for claiming this compensation is opaque and difficult, airlines do this on purpose in the hopes that people who are entitled to the compensation never actually claim it.


Our web application ‘Zeph’ aims to tackle this issue by leveraging blockchain technology and stricter enforcement of this regulation.


We also acknowledge that airlines have little incentive to simplify this compensation process; the objective, therefore, is not to design a system airlines would voluntarily adopt, but to demonstrate how technology could enable a transparent and enforceable framework. This represents the ideal state of compliance: where passengers are compensated automatically and transparently.


### **Outline**


The project involves developing a web-based platform that leverages blockchain technology to automate and enforce EU261 compensation claims.  
The system will include two main user roles; Passenger and Airline each interacting with the platform through distinct workflows.


#### **Passenger Workflow**


1. **Flight Registration**  
   - The passenger logs into the web application and registers their upcoming flight.  
   - A hashed version of the flight and booking details is recorded on-chain to ensure immutability and privacy.  
   - Personal information is securely stored off-chain in a postgreSQL database managed by Supabase.  


2. **Flight Data Verification**  
   - When the flight lands an oracle service automatically retrieves verified flight arrival data from a public API.  
   - The oracle submits this to a smart contract deployed on Ethereums Sepolia testnet, this checks wheather the delay exceeds the three-hour threshold defined by EU261.


3. **Claim Evaluation**  
   - If compensation is due the smart contract updates the claim to a pending state.  
   - The airline is then notified and granted a one-week grace period to respond.


---


#### **Airline Workflow**


1. **Claim Review**  
   - Airlines access a dedicated dashboard to view all pending claims related to their flights.  
   - Each claim entry includes relevant details and timestamps taken directly from the blockchain.  


2. **Evidence Submission**  
   - Airlines may either confirm payment or upload supporting evidence (e.g., documentation of severe weather or ATC strikes) to justify exemption under EU261.  
   - Evidence files are stored off-chain but cryptographically linked to the corresponding on-chain record using a unique claim ID and file hash.


---


#### **Resolution Process**


1. **Passenger Decision**  
   - The passenger reviews any evidence submitted by the airline through their dashboard.  
   - If satisfied the claim is closed automatically.  
   - If the passenger disagrees, they can choose to escalate the case on their own.


2. **Automated Documentation**  
   - Upon escalation the system automatically generates a PDF dossier containing all relevant claim data, timestamps, and evidence references.  
   - This report can be sent to the appropriate regulatory body for further review.


---


#### **System Outcome**


This architecture ensures that all the stages of the compensation process, from claim submission to dispute resolution are transparent, verifiable, and tamper-proof. It also maintains data privacy and regulatory compliance with secure off-chain storage.


---


### Background


We are both interested in the practical applications of blockchain and smart contract technologies.


We wanted to explore how these can be used to solve real-world problems, particularly around transparency, accountability, and automation.


EU261 is an ideal case study because it combines legal frameworks that depend on trust, data-driven decision making and ethical challenges.


### Achievements


The system will provide the following core functions:
Flight Registration - Passengers register via web interface; hashed flight details stored on-chain.


- **Claim Evaluation** - Oracle retrieves real landing time and posts it to the contract for delay validation.


- **Automatic Claim State Change** - Smart contract automatically changes claim state to PENDING or REJECTED based on delay duration.


- **Evidence Submission** - Airlines upload supporting documents off-chain; linked by claim ID and file hash.


- **Dispute Resolution** - Passengers can review and accept or dispute the airline’s claim.


- **PDF Dossier Generation** - Automated creation of a verifiable report containing evidence and transaction hashes.


**Users:**


- **Primary users:** Passengers and airline
- **Secondary users:** Regulators and enforcement bodies


### Justification


This system will be useful because it:
Promotes accountability and fairness in the airline industry
Reduces dealy time for processing claims
Provides tamper-proof records that regulators can verify directly.
Demonstrates how smart contracts can enhance regulatory compliance.
Acts as a proof of concept for suture regulation enforcement frameworks.


In a broader sense, Zeph explores how code can enforce law, reducing human bias and inefficiency.


### Programming language(s)


- **Solidity** (smart contracts)
- **JavaScript** (scripts, backend, frontend)
- **CSS** (frontend styling)


### Programming tools / Tech stack


- **Ethereum Sepolia** (testnet)
- **Solidity + Hardhat** (smart contract)
- **Ethers.js** (blockchain interaction)
- **Next.js** (frontend + API)
- **Pirsma ORM** (database management)
- **Supabase** (postgres DB + storge + auth)
- **pdfkit / puppeteer** (PDF generation)
- **Node.js worker** (oracle + automation)
- **Metamask** (wallet integration)




### Hardware


No non-stranded hardware is required


### Learning Challenges


We will need to learn and implement:


- Smart contract design and deployment on Ethereum using Hardhat.
- Oracle integration to feed real-world flight data into blockchain contracts
- Secure hash and salt management for GDPR-compliant data storage.
- Database schema design using Prisma and Supabase.
- Frontend blockchain interaction using Ethers.js
- Off-chain and on-chain synchronization through event listeners.
- Automated PDF report generation


### Breakdown of work


> Clearly identify who will undertake which parts of the project.
>
> It must be clear from the explanation of this breakdown of work both that each student is responsible for
> separate, clearly-defined tasks, and that those responsibilities substantially cover all of the work required
> for the project.




### Risk Register


| Description | Likelihood | Severity | Mitigation |
|--------------|-------------|-----------|-------------|
| Blockchain integration complexity — Smart contracts may be difficult to develop or deploy correctly. | Medium | High | Start with simple contracts on Remix, test on testnets before integration. Use Hardhat later for local testing. |
| Smart contract bugs or vulnerabilities — Could lead to incorrect payouts or system failures. | Medium | High | Conduct multiple rounds of testing, use Solidity linters and auditing tools. Keep contract logic simple and transparent. |
| Oracle/API data issues — Live flight or hotel APIs may be unreliable, limited, or require payment. | High | High | Begin testing early with free-tier APIs. Have fallback APIs or mock data to simulate real responses. |
| Delays in integrating oracles (e.g., Chainlink) — Setup may be complex or documentation unclear. | Medium | Medium | Use Chainlink test contracts or simulate oracle data manually at first. Add real oracles later once system logic works. |
| MetaMask or wallet connection problems — Users might face issues connecting to contracts. | Low | Medium | Provide clear user instructions and test across browsers. Implement retry and fallback handling. |
| Team coordination — Conflicts in code, unclear task division, or version control issues. | Medium | Medium | Use GitLab branches for separate features. Hold weekly check-ins and merge carefully after reviews. |
| Difficulty building frontend integration — Connecting UI to blockchain might be challenging. | Medium | High | Start with minimal UI to test contract calls (purchase policy, trigger payout). Expand features gradually. |
| Deployment and hosting challenges — Issues deploying UI or connecting to testnets. | Medium | Medium | Use testnets and free hosting (Vercel/GitLab Pages). Document setup carefully. |
| Scope creep — Trying to implement too many insurance cases (flights, baggage, hotels, etc.) in limited time. | High | High | Focus on one or two use cases (e.g., flight delay payouts) first, expand if time permits. |
| Learning curve for new technologies     |    Medium        |    Medium      |  Split responsibilities; pair programming for complex integration steps.          |










#### Student 1


Student 1 will focus on the blockchain and smart contract development aspect of the project. This includes designing and implementing the smart contracts that handle travel insurance policies, claim conditions, and automated payouts. They will also integrate the contracts with oracles to retrieve real-time data, such as flight delays or cancellations. In addition, Student 1 will be responsible for testing and deploying the contracts on a blockchain test network and ensuring that all transactions are secure, transparent, and efficient.


#### Student 2


Student 2 will concentrate on the frontend and backend development, building the user interface and managing off-chain operations. This involves developing a web-based platform that allows users to purchase insurance policies, connect their wallets (e.g., via MetaMask), and track claim statuses. They will also handle API integration for flight and travel data, as well as set up any necessary backend services or databases. Student 2 will ensure smooth communication between the UI, the blockchain contracts, and external data sources.








