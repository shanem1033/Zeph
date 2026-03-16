-- Migration: Add routes and flights tables, plus claim tracking
-- This lets us track flight landings and calculate delays for compensation

-- Routes table: hardcoded journey info (origin -> destination with duration)
-- Add some demo routes at the bottom of this file
create table if not exists public.routes (
  id serial primary key,
  origin text not null,
  destination text not null,
  flight_code text not null,
  duration_minutes integer not null,
  unique(origin, destination, flight_code)
);

create index if not exists routes_origin_dest_idx
  on public.routes (origin, destination);

-- Flights table: each actual flight instance
-- Gets created automatically when someone books a flight for the first time
-- flight_id format: "EI123-2026-02-15" (flight_code + date)
create table if not exists public.flights (
  flight_id text primary key,
  flight_code text not null,
  origin text not null,
  destination text not null,
  scheduled_departure_at timestamptz not null,
  scheduled_arrival_at timestamptz not null,  -- calculated from route duration
  
  -- These get filled in when we record the landing
  actual_arrival_at timestamptz null,
  delay_minutes integer null,
  
  -- Oracle tracking - when/if we reported this to the smart contract
  oracle_processed_at timestamptz null,
  oracle_tx_hash text null,
  
  created_at timestamptz not null default now()
);

create index if not exists flights_flight_code_idx
  on public.flights (flight_code);

create index if not exists flights_scheduled_departure_idx
  on public.flights (scheduled_departure_at);

create index if not exists flights_actual_arrival_idx
  on public.flights (actual_arrival_at);

-- Track whether oracle has processed this flight yet
create index if not exists flights_oracle_pending_idx
  on public.flights (actual_arrival_at, oracle_processed_at)
  where actual_arrival_at is not null and oracle_processed_at is null;

-- Add claim status to registered_flights
-- Tracks where each passenger's compensation claim is at:
--   registered        = flight registered on zeph, waiting for it to land
--   landed_on_time    = flight was less than 3 hours late, no compensation
--   awaiting_decision = flight was 3+ hours late, waiting for airline decision
--   rejected          = airline rejected claim (e.g. weather, not their fault)
--   accepted          = airline accepted, compensation owed
alter table public.registered_flights 
  add column if not exists claim_status text default 'registered'
  check (claim_status in ('registered', 'landed_on_time', 'awaiting_decision', 'rejected', 'accepted', 'auto_accepted'));

create index if not exists registered_flights_claim_status_idx
  on public.registered_flights (claim_status);

-- Add origin/destination to bookings so we can easily look up routes
alter table public.bookings
  add column if not exists origin text;

alter table public.bookings
  add column if not exists destination text;

create index if not exists bookings_origin_dest_idx
  on public.bookings (origin, destination);

-- All possible routes between our 6 cities
-- Flight codes are made up but look realistic
-- Durations are approximate real flight times in minutes

insert into public.routes (origin, destination, flight_code, duration_minutes) values
  -- London routes
  ('London', 'Paris', 'BA214', 75),
  ('London', 'Berlin', 'BA962', 110),
  ('London', 'Dublin', 'BA548', 85),
  ('London', 'Madrid', 'BA456', 145),
  ('London', 'Amsterdam', 'BA432', 70),
  
  -- Paris routes
  ('Paris', 'London', 'AF112', 75),
  ('Paris', 'Berlin', 'AF234', 105),
  ('Paris', 'Dublin', 'AF348', 110),
  ('Paris', 'Madrid', 'AF782', 120),
  ('Paris', 'Amsterdam', 'AF680', 80),
  
  -- Berlin routes
  ('Berlin', 'London', 'LH903', 110),
  ('Berlin', 'Paris', 'LH456', 105),
  ('Berlin', 'Dublin', 'LH712', 140),
  ('Berlin', 'Madrid', 'LH834', 180),
  ('Berlin', 'Amsterdam', 'LH523', 90),
  
  -- Dublin routes (Ryanair)
  ('Dublin', 'London', 'FR201', 80),
  ('Dublin', 'Paris', 'FR340', 120),
  ('Dublin', 'Berlin', 'FR567', 150),
  ('Dublin', 'Madrid', 'FR892', 165),
  ('Dublin', 'Amsterdam', 'FR654', 110),
  
  -- Madrid routes
  ('Madrid', 'London', 'IB321', 145),
  ('Madrid', 'Paris', 'IB743', 120),
  ('Madrid', 'Berlin', 'IB982', 180),
  ('Madrid', 'Dublin', 'IB654', 155),
  ('Madrid', 'Amsterdam', 'IB876', 150),
  
  -- Amsterdam routes (EasyJet)
  ('Amsterdam', 'London', 'U2118', 70),
  ('Amsterdam', 'Paris', 'U2245', 80),
  ('Amsterdam', 'Berlin', 'U2672', 90),
  ('Amsterdam', 'Dublin', 'U2489', 110),
  ('Amsterdam', 'Madrid', 'U2357', 150)

on conflict (origin, destination, flight_code) do nothing;
