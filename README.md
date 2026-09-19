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

| Method | Path                       | Purpose                                 |
| ------ | -------------------------- | --------------------------------------- |
| GET    | `/api/yield-curve`         | Yield curve, one point per term         |
| GET    | `/api/orders`              | All submitted orders, newest first      |
| POST   | `/api/orders`              | Submit an order: `{ term, amount }`     |

## Schema

- `yield_curve_rates(date, term, rate, fetched_at)` — one row per term per
  date fetched; `fetched_at` drives the 24h cache TTL
- `orders(id, term, amount, submitted_at)` — one row per submitted order

## Scope notes

Deliberately out of scope:

- No auth — the app has a single implicit user, so order history is global.
- Only the latest date's yield curve is fetched and stored, not full history.
- Cache staleness is a flat 24h TTL on `fetched_at`, not tied to Treasury's
  actual publish schedule, and there's no manual/admin refresh endpoint —
  the TTL is the only invalidation path.
- No automated tests or CI.
- No migration framework — schema is applied once via Postgres's built-in
  `docker-entrypoint-initdb.d` mount.

## Demo

<!-- Add the ~30s screen recording link here -->
