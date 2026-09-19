-- The term list mirrors backend/src/terms.ts.
CREATE TABLE IF NOT EXISTS yield_curve_rates (
  date       DATE NOT NULL,
  term       TEXT NOT NULL CHECK (term IN (
    '1mo', '2mo', '3mo', '4mo', '6mo',
    '1yr', '2yr', '3yr', '5yr', '7yr', '10yr', '20yr', '30yr'
  )),
  rate       NUMERIC(5,3) NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (date, term)
);

CREATE TABLE IF NOT EXISTS orders (
  id              SERIAL PRIMARY KEY,
  idempotency_key UUID NOT NULL UNIQUE,
  term            TEXT NOT NULL CHECK (term IN (
    '1mo', '2mo', '3mo', '4mo', '6mo',
    '1yr', '2yr', '3yr', '5yr', '7yr', '10yr', '20yr', '30yr'
  )),
  amount          NUMERIC(14,2) NOT NULL CHECK (amount > 0),
  rate            NUMERIC(5,3) NOT NULL,
  settlement_date DATE NOT NULL,
  maturity_date   DATE NOT NULL,
  est_interest    NUMERIC(14,2) NOT NULL,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
