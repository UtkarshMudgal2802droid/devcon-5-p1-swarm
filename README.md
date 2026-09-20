# Eight hundred winters, one lapsed invoice - Swarm Archival Tool

An enterprise-grade, strict TypeScript implementation for publishing and recovering collections of data on the Ethereum Swarm decentralized network. This project fulfills the requirements of Devcon 5 (P1) by leveraging Single Owner Chunks (Feeds) and Content Addressed Chunks (Collections).

## Architecture

This project strictly adheres to robust blockchain architecture patterns:
1. **Content Addressed Chunks (CAC):** The raw archival folios are uploaded into a directory collection, producing an immutable, cryptographically secure root reference.
2. **Single Owner Chunks (SOC):** A Sequence Feed is utilized to bind a mutable identity (derived from an Ethereum Private Key) to the immutable collection.
3. **Manifest Routing:** A feed manifest is generated to allow standard gateways (`/bzz/`) to seamlessly resolve the latest sequence index of the SOC.
4. **Postage Batches:** The application dynamically interfaces with the Swarm network to acquire and utilize funded Postage Batches, ensuring data retention (TTL).

## Prerequisites
- Node.js (v18+)
- Active Swarm Desktop Node (or local Bee node) running on `http://localhost:1633`
- A funded Postage Batch on the Swarm network
- An Ethereum Private Key

## Installation

```bash
npm install
```

## Configuration

Duplicate the `.env.example` file to create a `.env` file:
```bash
cp .env.example .env
```
Fill in your `PRIVATE_KEY`. (Optional: explicitly provide a `STAMP_ID` if you wish to bypass dynamic lookup).

## Usage

### 1. Build the TypeScript Project
```bash
npm run build
```

### 2. Publish to Swarm
This will recursively upload the `data/` directory, update the sequence feed, and write the deterministic identifiers to `feed-info.json`.
```bash
npm run publish
```

### 3. Recover from Swarm
Demonstrates a pure recovery path using only the published identifiers (Owner Address and Topic Hex).
```bash
npm run recover
```

## Code Quality Standards
- **Strict TypeScript:** Compiled with `strict: true`, eliminating all implicit or explicit `any` usage for maximum type safety.
- **Prettier:** Code is strictly formatted.
- **Modular Design:** Concerns are explicitly separated across `src/config.ts`, `src/swarm.ts`, and `src/publish.ts`.

## License
MIT
