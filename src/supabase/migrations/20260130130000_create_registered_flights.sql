-- Registered flights table
-- Represents a booking that has been successfully redeemed/registered in Zeph.
-- One row per booking reference.

create table if not exists public.registered_flights (
  -- Matches the booking reference that a user enters in Zeph
  booking_ref uuid primary key references public.bookings(booking_ref) on delete restrict,

  -- Registration lifecycle
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'failed')),

  -- Optional metadata for auditability
  registered_by_wallet text null,

  -- On-chain proof (optional in early iterations)
  tx_hash text null,
  chain_id integer null,
  contract_address text null,

  created_at timestamptz not null default now(),
  confirmed_at timestamptz null,
  failed_at timestamptz null,
  error_message text null
);

create index if not exists registered_flights_status_idx
  on public.registered_flights (status);

create index if not exists registered_flights_tx_hash_idx
  on public.registered_flights (tx_hash);

create index if not exists registered_flights_created_at_idx
  on public.registered_flights (created_at);
