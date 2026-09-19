CREATE TABLE IF NOT EXISTS yield_curve_rates (
  id         SERIAL PRIMARY KEY,
  date       DATE NOT NULL,
  term       TEXT NOT NULL,
  rate       NUMERIC(5,3) NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (date, term)
);

CREATE TABLE IF NOT EXISTS orders (
  id           SERIAL PRIMARY KEY,
  term         TEXT NOT NULL,
  amount       NUMERIC(14,2) NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
