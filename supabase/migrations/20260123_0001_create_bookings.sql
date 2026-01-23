-- Bookings table
-- Represents a passenger having booked a flight with an airline.
-- This is intentionally separate from any "registered with Zeph" table.

create extension if not exists pgcrypto;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),

  -- Airline booking reference (PNR-like). This is what the QR should reference.
  booking_ref uuid not null default gen_random_uuid(),

  -- Flight identifier used by the smart contract.
  flight_id text not null,

  -- Passenger details (minimal PII for demo).
  passenger_name text not null,
  passenger_email text null,

  -- Scheduled departure time (optional for delay checks, useful for display/validation).
  scheduled_departure_at timestamptz not null,

  -- Scheduled arrival time (used later to determine if the flight exceeded the delay threshold).
  scheduled_arrival_at timestamptz not null,

  -- Booking lifecycle
  status text not null default 'booked' check (status in ('booked', 'cancelled')),

  -- When the booking was created in our system
  created_at timestamptz not null default now(),

  -- When the QR was issued (optional) and whether it has been redeemed
  qr_issued_at timestamptz null,
  redeemed_at timestamptz null
);

create unique index if not exists bookings_booking_ref_uq
  on public.bookings (booking_ref);

create index if not exists bookings_flight_id_idx
  on public.bookings (flight_id);

create index if not exists bookings_redeemed_at_idx
  on public.bookings (redeemed_at);

create index if not exists bookings_scheduled_arrival_at_idx
  on public.bookings (scheduled_arrival_at);

create index if not exists bookings_scheduled_departure_at_idx
  on public.bookings (scheduled_departure_at);
