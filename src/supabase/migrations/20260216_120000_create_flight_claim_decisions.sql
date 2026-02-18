-- Per-flight airline decisions for delayed flights
-- Decision applies to all passengers booked on the flight.

create table if not exists public.flight_claim_decisions (
  flight_id text primary key references public.flights(flight_id) on delete cascade,

  -- accepted | rejected
  decision text not null check (decision in ('accepted', 'rejected')),

  -- Evidence stored in DB (structured JSON for flexibility)
  evidence jsonb null,
  evidence_hash text null,

  decided_at timestamptz not null default now(),
  decided_by_wallet text null,

  -- Optional on-chain linkage
  chain_id integer null,
  contract_address text null,
  tx_hash text null,

  created_at timestamptz not null default now()
);

create index if not exists flight_claim_decisions_decision_idx
  on public.flight_claim_decisions (decision);
