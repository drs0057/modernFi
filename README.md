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
after that it's served from Postgres until the 1h cache TTL expires. To
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
row, or the cached row is older than the 1h TTL, it fetches the Treasury
CSV feed, upserts it in one statement, and serves the fresh row; otherwise it
serves straight from the DB with no external call. Orders flow straight from
the form -> `POST /api/orders` -> Postgres -> history table.

Refresh behavior:

- Concurrent requests that find a stale cache share one Treasury fetch.
- Each Treasury request times out after 10s.
- If a refresh fails, the stale curve is served. The backend does not try
  Treasury again for 60s, so a broken upstream does not slow every request.
- With no cached curve and a failed refresh, the API returns `502`.

## Project layout

```
backend/src/
  app.ts            builds the Express app (middleware, routers, error handler)
  index.ts          starts the server
  errors.ts         HttpError, asyncHandler, error middleware
  terms.ts          the 13 Treasury terms: code, months, CSV header
  lib/dates.ts      ISO date math, New York date
  yieldCurve/       routes, cache policy (curveService), SQL (curveRepository),
                    Treasury fetch + CSV parse (treasuryClient), refresh
                    (curveRefresh), comparison dates (curveDates)
  orders/           routes, idempotency + quoting (orderService), SQL
                    (orderRepository), validation, list paging/sorting,
                    ticket math, mock payment processor
frontend/src/       App, components (ui/ holds Button and TabButton), api.ts,
                    lib/ (formatting, order-to-ticket mapping)
```

## API

| Method | Path                       | Purpose                                                        |
| ------ | -------------------------- | -------------------------------------------------------------- |
| GET    | `/api/yield-curve`         | Latest curve, one point per term, with 1D / 1M / 1Y change (bp) |
| GET    | `/api/orders/quote`        | Order ticket preview: `?term=&amount=`. Writes nothing.         |
| GET    | `/api/orders`              | Submitted orders, paginated and sortable                        |
| POST   | `/api/orders`              | Place an order: `{ term, amount }` + `Idempotency-Key` header   |

`POST /api/orders` responses:

- `201` new order persisted.
- `200` + `Idempotent-Replayed: true`: the key was already used with the same
  order. The original order is returned and the payment processor is not called.
- `400` bad input, malformed JSON, or a missing/non-UUID `Idempotency-Key`.
- `422` the key was already used with a different term or amount.
- `502` the payment processor declined or Treasury data was unavailable.
  Nothing is written. The same key can be retried. The mock processor never
  declines, so a decline only happens with a real one.
- `500` unexpected server error, such as the database being down.

## Order safety

The client sends one UUID per order intent. It keeps the key across retries
and changes it when the term or amount changes. Reopening the order panel
clears the amount. The row is written only after the payment processor
accepts, so a decline leaves nothing behind. Two layers stop duplicates:

- An in-memory map of in-flight keys. A duplicate that arrives while the first
  request is talking to the processor waits for that result. The processor runs
  once per process.
- A unique index on `orders.idempotency_key`, with `INSERT ... ON CONFLICT DO
  NOTHING`. If another process wins the race, its order is returned.

The unique index stops duplicate rows. It does not stop two processes from
both calling the payment processor before either inserts. The backend passes
the key to the processor for that case. A real processor dedupes on the key.
The mock here does not.

The quote and the order each read the current curve. If a refresh lands
between them, the rate locked on the order can differ from the quoted one.
The success screen shows the rate that was locked.

## Schema

- `yield_curve_rates(date, term, rate, fetched_at)`: one row per term per
  date, primary key `(date, term)`. Only the latest date and its 1 day, 1
  month and 1 year comparison dates are stored per refresh. `fetched_at`
  drives the 1h cache TTL.
- `orders(id, idempotency_key, term, amount, rate, settlement_date,
  maturity_date, est_interest, submitted_at)`: one row per placed order. `rate`
  is the yield locked in at submit. `CHECK` constraints require `amount > 0`
  and a known `term`.

## Order ticket

The server builds the ticket from the current cached yield. The client never
sends a rate.

- Settlement: T+1 business day, counted from today's date in New York.
- Maturity: settlement date plus the term, clamped to month end.
- Estimated interest: `amount * rate * years`, simple interest paid at maturity.

## Scope notes

Deliberately out of scope:

- No auth. The app has a single implicit user, so order history is global.
- Yield curve history is not stored. Each refresh keeps the latest date and
  its 1 day, 1 month and 1 year comparison dates. A refresh fetches this
  year's and last year's Treasury CSV. Comparison dates are the calendar date
  minus 1 day / 1 month / 1 year, moved back to the nearest earlier business
  day. If none exists within 7 days, or last year's fetch fails, that change
  shows as `-`.
- Cache staleness is a flat 1h TTL on `fetched_at`, not tied to Treasury's
  publish schedule. A new day's curve shows up within an hour of Treasury
  posting it. There is no manual refresh endpoint.
- Refresh sharing and the failure cooldown cover one backend process. Two
  processes can both refresh. The upsert is idempotent, so the data stays correct.
- The in-flight map covers one backend process. The unique index covers more.
- Settlement skips weekends only. No holiday calendar.
- No CI. Backend unit tests run with `cd backend && npm test`. Tests that run
  the real SQL need Postgres: `docker compose up -d postgres`, then
  `TEST_DATABASE_URL=postgres://modernfi:modernfi@localhost:5432/modernfi npm
  run test:integration`. They use a scratch schema and drop it afterward.
- No migration framework. The schema is applied once via Postgres's
  `docker-entrypoint-initdb.d` mount, so a schema change needs `docker compose
  down -v` on an existing volume. This applies to the primary key and `CHECK`
  constraints added to `db/init.sql`.
- The frontend `types.ts` mirrors the backend types. Keep the two in sync.

## Demo

[Watch the ~30 second screen recording](https://www.loom.com/share/3b11748525524cc2aa2ab8b991f09b5c)
