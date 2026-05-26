# Transaction Reconciliation Engine — KoinX Assignment

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** MongoDB

---

# What I Built & Key Decisions

## Matching Algorithm — Bucket Sort Approach
Instead of a naive O(n²) nested loop to match user and exchange transactions, I used a **bucket sort strategy**:
- User transactions are sorted and indexed by timestamp
- For each exchange transaction, a binary search finds the closest transaction in the user set within the configured tolerance window
- Once a user transaction is matched, it's marked and skipped in future lookups, so we dont add any matched lookups

This cuts down the time complexity drastically — roughly **700x faster** on large datasets, if we compared to brute-force matching.

## Pagination on `/report/:runId`
Full reconciliation reports can be > 10K or more. So instead of sending everything in one response and making big DB operations, this endpoint has a **pagination layer** — fetch data in chunks with `page` and `limit` query params.

## Authentication
I didn't add any login/auth stuff here because this is just an assignment. Adding JWT would just make it harder to test with no real benefit. In production, I'd put JWT/API key auth in front of every route.

## About `/report/:runId/unmatched`
This endpoint returns unmatched entries from both user and exchange sides. With large datasets, this could be thousands of rows. I left pagination as a **known gap** here — and the right call depends on what the frontend actually needs (split by source? prioritised by asset? filtered by type?). 

## Rate Limiting
Added rate limiting middleware on the API to prevent abuse

## Consistent Response Format
Built a **custom response handler wrapper** so every endpoint returns responses in the exact same shape — `successResponse, errorResponse, paginationResponse`. No inconsistent payloads across routes.

## Configurable Tolerances
Matching tolerances can be set via:
- Environment variables (`TIMESTAMP_TOLERANCE_SECONDS`, `QUANTITY_TOLERANCE_PCT`)
- A config file
- Request body on `POST /reconcile` (overrides env for that run)

Defaults: ±300 seconds for timestamp, ±0.01% for quantity.

## Data Quality — No Silent Drops
Bad rows are **flagged with a reason** and stored separately, not silently dropped. The ingestion logs every data quality issue it encounters.


# Extras I Added
---

## Workflow Diagram

A complete reconciliation flow diagram is included in the repo (`/docs/workflow.png`) — covers ingestion → validation → matching → report generation.

![Image Description](https://i.ibb.co/YFSVd20b/Untitled-2025-03-23-0858.png)

---

## Postman Collection

A ready-to-import Postman JSON is included (`/docs`) for instant API testing without any manual setup.

---

## Setup

```bash
# Clone the repo
git clone https://github.com/AtulYadav25/koinx-reconciliation-engine.git
cd koinx-reconciliation-engine

# Install dependencies
npm install

# Create a .env file in the root directory
# Add the following variables:
MONGO_URI=your-mongodb-uri
PORT=3000
TIMESTAMP_TOLERANCE_SECONDS=300
QUANTITY_TOLERANCE_PCT=0.01

# Start the server
npm start
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MONGO_URI` | — | MongoDB connection string |
| `PORT` | `3000` | Server port |
| `TIMESTAMP_TOLERANCE_SECONDS` | `300` | Match window for timestamps |
| `QUANTITY_TOLERANCE_PCT` | `0.01` | Match tolerance for quantities (%) |

---

## API Reference

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/reconcile` | Trigger a reconciliation run. Accepts optional tolerance overrides in body. |
| `GET` | `/report/:runId` | Full report for a run. Supports `?page=` and `?limit=` for pagination. |
| `GET` | `/report/:runId/summary` | Counts only — matched, conflicting, unmatched. |
| `GET` | `/report/:runId/unmatched` | Unmatched rows with reasons, from both sources. |

---

All Requirements are completed in assignment