# ModernFi Liquidity Desk

A small full stack app for a bank managing liquidity: pulls U.S. Treasury
par yield curve rates, plots the yield curve, lets a user submit an order for
a specific term and amount, and shows the user's order history.

## Prerequisites

- Docker and Docker Compose

## Run it

```
git clone <this-repo-url>
cd modernFi
docker compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:4000

The first load of the yield curve chart triggers a fetch from Treasury;
after that it's served from Postgres until the 24h cache TTL expires. To
reset the database from scratch (e.g. after a schema change), run
`docker compose down -v` before `up` again.

## Architecture

Three containers, wired together by `docker-compose.yml`:

- **postgres** — stores two tables: `yield_curve_rates` and `orders`. Schema
  is applied once from `db/init.sql` on first container start.
- **backend** (TypeScript + Express) — fetches the latest row from the
  U.S. Treasury's public daily par yield curve CSV feed on a cache miss or
  TTL expiry, upserting it into `yield_curve_rates`. Serves the API below.
- **frontend** (React + Tailwind + Recharts) — single page: yield curve
  chart, order form, order history table.

Data flow: `GET /api/yield-curve` reads from Postgres. If there's no cached
row, or the cached row is older than the 24h TTL, it fetches the Treasury
CSV feed, upserts it, and serves the fresh row; otherwise it serves straight
from the DB with no external call. Orders flow straight from the form ->
`POST /api/orders` -> Postgres -> history table.

## API

| Method | Path                       | Purpose                                                        |
| ------ | -------------------------- | -------------------------------------------------------------- |
| GET    | `/api/yield-curve`         | Latest curve, one point per term, with change vs prior day (bp) |
| GET    | `/api/orders/quote`        | Order ticket preview: `?term=&amount=`. Writes nothing.         |
| GET    | `/api/orders`              | Submitted orders, paginated and sortable                        |
| POST   | `/api/orders`              | Place an order: `{ term, amount }` + `Idempotency-Key` header   |

`POST /api/orders` responses:

- `201` new order persisted.
- `200` + `Idempotent-Replayed: true`: the key was already used with the same
  order. The original order is returned and the payment processor is not called.
- `400` bad input or a missing/non-UUID `Idempotency-Key`.
- `422` the key was already used with a different term or amount.
- `502` the payment processor declined (simulated, 15%) or Treasury data was
  unavailable. Nothing is written. The same key can be retried.

## Order safety

The client sends one UUID per order intent and keeps it across retries. The
row is written only after the payment processor accepts, so a decline leaves
nothing behind. Two layers stop duplicates:

- An in-memory map of in-flight keys. A duplicate that arrives while the first
  request is talking to the processor waits for that result. The processor runs once.
- A unique index on `orders.idempotency_key`, with `INSERT ... ON CONFLICT DO
  NOTHING`. If another process wins the race, its order is returned.

## Schema

- `yield_curve_rates(date, term, rate, fetched_at)`: one row per term per
  date. The latest two dates are stored. `fetched_at` drives the 24h cache TTL.
- `orders(id, idempotency_key, term, amount, rate, settlement_date,
  maturity_date, est_interest, submitted_at)`: one row per placed order. `rate`
  is the yield locked in at submit.

## Order ticket

The server builds the ticket from the current cached yield. The client never
sends a rate.

- Settlement: T+1 business day, counted from today's date in New York.
- Maturity: settlement date plus the term, clamped to month end.
- Estimated interest: `amount * rate * years`, simple interest paid at maturity.

## Scope notes

Deliberately out of scope:

- No auth. The app has a single implicit user, so order history is global.
- Only the latest two dates of the yield curve are stored, not full history.
  On the first business day of a year Treasury's CSV has one row, so the
  change vs prior day shows as `-`.
- Cache staleness is a flat 24h TTL on `fetched_at`, not tied to Treasury's
  publish schedule. There is no manual refresh endpoint.
- The in-flight map covers one backend process. The unique index covers more.
- Settlement skips weekends only. No holiday calendar.
- No CI. Backend unit tests run with `cd backend && npm test`.
- No migration framework. The schema is applied once via Postgres's
  `docker-entrypoint-initdb.d` mount, so this change needs `docker compose
  down -v` on an existing volume.

## Demo

<!-- Add the ~30s screen recording link here -->
