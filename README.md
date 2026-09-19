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

First boot fetches the latest treasury yield curve automatically. To reset
the database from scratch (e.g. after a schema change), run
`docker compose down -v` before `up` again.

## Architecture

Three containers, wired together by `docker-compose.yml`:

- **postgres** — stores two tables: `yield_curve_rates` and `orders`. Schema
  is applied once from `db/init.sql` on first container start.
- **backend** (TypeScript + Express) — on startup, fetches the latest row
  from the U.S. Treasury's public daily par yield curve CSV feed and upserts
  it into `yield_curve_rates`. Serves the API below.
- **frontend** (React + Tailwind + Recharts) — single page: yield curve
  chart, order form, order history table.

Data flow: `GET /api/yield-curve/latest` reads from Postgres. On a cold
cache (table empty) it fetches the Treasury CSV feed once, upserts it, then
serves from the DB from then on — a write-through cache, not a fetch-per-
request. Orders flow straight from the form -> `POST /api/orders` ->
Postgres -> history table.

## API

| Method | Path                       | Purpose                                 |
| ------ | -------------------------- | --------------------------------------- |
| GET    | `/api/yield-curve/latest`  | Latest yield curve, one point per term  |
| POST   | `/api/yield-curve/refresh` | Re-fetch the latest curve from Treasury |
| GET    | `/api/orders`              | All submitted orders, newest first      |
| POST   | `/api/orders`              | Submit an order: `{ term, amount }`     |

## Schema

- `yield_curve_rates(date, term, rate)` — one row per term per date fetched
- `orders(id, term, amount, submitted_at)` — one row per submitted order

## Scope notes

Deliberately out of scope:

- No auth — the app has a single implicit user, so order history is global.
- Only the latest date's yield curve is fetched and stored, not full history.
- No scheduled or time-based cache invalidation — once a row exists, reads
  never hit Treasury again. Use `POST /api/yield-curve/refresh` to force a
  re-pull (e.g. once a new business day's rates are published).
- No automated tests or CI.
- No migration framework — schema is applied once via Postgres's built-in
  `docker-entrypoint-initdb.d` mount.

## Demo

<!-- Add the ~30s screen recording link here -->
