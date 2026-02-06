-- Align bookings schema with current UI: store passport number and allow passenger_name to be optional.

alter table public.bookings
  add column if not exists passport_number text;

-- Best-effort backfill for any existing rows (if any)
update public.bookings
  set passport_number = coalesce(passport_number, passenger_name, 'UNKNOWN')
  where passport_number is null;

alter table public.bookings
  alter column passenger_name drop not null;

alter table public.bookings
  alter column passport_number set not null;

create index if not exists bookings_passport_number_idx
  on public.bookings (passport_number);
