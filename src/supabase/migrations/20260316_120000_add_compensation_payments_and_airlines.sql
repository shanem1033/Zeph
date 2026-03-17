-- Add internal compensation ledger and airline aggregate stats

create table if not exists public.airlines (
  airline_code text primary key,
  name text not null,
  email_domain text not null unique,
  total_paid_eur integer not null default 0 check (total_paid_eur >= 0),
  paid_claims_count integer not null default 0 check (paid_claims_count >= 0),
  accepted_claims_count integer not null default 0 check (accepted_claims_count >= 0),
  rejected_claims_count integer not null default 0 check (rejected_claims_count >= 0),
  auto_accepted_claims_count integer not null default 0 check (auto_accepted_claims_count >= 0),
  awaiting_claims_count integer not null default 0 check (awaiting_claims_count >= 0),
  delayed_flights_count integer not null default 0 check (delayed_flights_count >= 0),
  on_time_flights_count integer not null default 0 check (on_time_flights_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.airlines (airline_code, name, email_domain) values
  ('FR', 'Ryanair', 'ryanair.com'),
  ('U2', 'EasyJet', 'easyjet.com'),
  ('LH', 'Lufthansa', 'lufthansa.com'),
  ('AF', 'Air France', 'airfrance.com'),
  ('IB', 'Iberia', 'iberia.com'),
  ('BA', 'British Airways', 'britishairways.com')
on conflict (airline_code) do update
set name = excluded.name,
    email_domain = excluded.email_domain;

create table if not exists public.claim_payments (
  booking_ref uuid primary key references public.registered_flights(booking_ref) on delete cascade,
  flight_id text not null references public.flights(flight_id) on delete cascade,
  passenger_email text not null,
  airline_code text not null references public.airlines(airline_code) on delete restrict,
  amount_eur integer not null default 300 check (amount_eur > 0),
  source_status text not null check (source_status in ('accepted', 'auto_accepted')),
  credited_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists claim_payments_passenger_email_idx
  on public.claim_payments (passenger_email);

create index if not exists claim_payments_airline_code_idx
  on public.claim_payments (airline_code);

create index if not exists claim_payments_credited_at_idx
  on public.claim_payments (credited_at desc);

create or replace function public.airline_code_from_flight_code(p_flight_code text)
returns text
language sql
immutable
as $$
  select case
    when p_flight_code is null then null
    when upper(p_flight_code) like 'FR%' then 'FR'
    when upper(p_flight_code) like 'U2%' then 'U2'
    when upper(p_flight_code) like 'LH%' then 'LH'
    when upper(p_flight_code) like 'AF%' then 'AF'
    when upper(p_flight_code) like 'IB%' then 'IB'
    when upper(p_flight_code) like 'BA%' then 'BA'
    else null
  end
$$;

create or replace function public.recompute_airline_stats(p_airline_code text)
returns void
language plpgsql
as $$
begin
  update public.airlines as a
  set
    total_paid_eur = coalesce((
      select sum(cp.amount_eur)::integer
      from public.claim_payments cp
      where cp.airline_code = p_airline_code
    ), 0),
    paid_claims_count = coalesce((
      select count(*)::integer
      from public.claim_payments cp
      where cp.airline_code = p_airline_code
    ), 0),
    accepted_claims_count = coalesce((
      select count(*)::integer
      from public.registered_flights rf
      join public.bookings b on b.booking_ref = rf.booking_ref
      join public.flights f on f.flight_id = b.flight_id
      where rf.status = 'confirmed'
        and rf.claim_status = 'accepted'
        and public.airline_code_from_flight_code(f.flight_code) = p_airline_code
    ), 0),
    rejected_claims_count = coalesce((
      select count(*)::integer
      from public.registered_flights rf
      join public.bookings b on b.booking_ref = rf.booking_ref
      join public.flights f on f.flight_id = b.flight_id
      where rf.status = 'confirmed'
        and rf.claim_status = 'rejected'
        and public.airline_code_from_flight_code(f.flight_code) = p_airline_code
    ), 0),
    auto_accepted_claims_count = coalesce((
      select count(*)::integer
      from public.registered_flights rf
      join public.bookings b on b.booking_ref = rf.booking_ref
      join public.flights f on f.flight_id = b.flight_id
      where rf.status = 'confirmed'
        and rf.claim_status = 'auto_accepted'
        and public.airline_code_from_flight_code(f.flight_code) = p_airline_code
    ), 0),
    awaiting_claims_count = coalesce((
      select count(*)::integer
      from public.registered_flights rf
      join public.bookings b on b.booking_ref = rf.booking_ref
      join public.flights f on f.flight_id = b.flight_id
      where rf.status = 'confirmed'
        and rf.claim_status = 'awaiting_decision'
        and public.airline_code_from_flight_code(f.flight_code) = p_airline_code
    ), 0),
    delayed_flights_count = coalesce((
      select count(*)::integer
      from public.flights f
      where public.airline_code_from_flight_code(f.flight_code) = p_airline_code
        and f.actual_arrival_at is not null
        and coalesce(f.delay_minutes, 0) >= 180
    ), 0),
    on_time_flights_count = coalesce((
      select count(*)::integer
      from public.flights f
      where public.airline_code_from_flight_code(f.flight_code) = p_airline_code
        and f.actual_arrival_at is not null
        and coalesce(f.delay_minutes, 0) < 180
    ), 0),
    updated_at = now()
  where a.airline_code = p_airline_code;
end;
$$;

create or replace function public.recompute_all_airline_stats()
returns void
language plpgsql
as $$
declare
  airline_record record;
begin
  for airline_record in
    select airline_code from public.airlines
  loop
    perform public.recompute_airline_stats(airline_record.airline_code);
  end loop;
end;
$$;

create or replace function public.sync_claim_payment_and_airline_stats()
returns trigger
language plpgsql
as $$
declare
  v_flight_id text;
  v_passenger_email text;
  v_airline_code text;
begin
  select
    b.flight_id,
    b.passenger_email,
    public.airline_code_from_flight_code(f.flight_code)
  into
    v_flight_id,
    v_passenger_email,
    v_airline_code
  from public.bookings b
  join public.flights f on f.flight_id = b.flight_id
  where b.booking_ref = new.booking_ref;

  if v_airline_code is null then
    return new;
  end if;

  if new.status = 'confirmed'
     and v_passenger_email is not null
     and new.claim_status in ('accepted', 'auto_accepted')
     and (old.claim_status is distinct from new.claim_status
       or old.status is distinct from new.status) then
    insert into public.claim_payments (
      booking_ref,
      flight_id,
      passenger_email,
      airline_code,
      amount_eur,
      source_status,
      credited_at
    ) values (
      new.booking_ref,
      v_flight_id,
      v_passenger_email,
      v_airline_code,
      300,
      new.claim_status,
      now()
    )
    on conflict (booking_ref) do nothing;
  end if;

  perform public.recompute_airline_stats(v_airline_code);

  return new;
end;
$$;

create or replace function public.sync_airline_stats_from_flight()
returns trigger
language plpgsql
as $$
declare
  v_new_airline_code text;
  v_old_airline_code text;
begin
  v_new_airline_code := public.airline_code_from_flight_code(new.flight_code);
  v_old_airline_code := public.airline_code_from_flight_code(old.flight_code);

  if v_new_airline_code is not null then
    perform public.recompute_airline_stats(v_new_airline_code);
  end if;

  if v_old_airline_code is not null and v_old_airline_code <> v_new_airline_code then
    perform public.recompute_airline_stats(v_old_airline_code);
  end if;

  return new;
end;
$$;

create or replace function public.sync_airline_stats_from_payment()
returns trigger
language plpgsql
as $$
declare
  v_airline_code text;
begin
  v_airline_code := case
    when tg_op = 'DELETE' then old.airline_code
    else new.airline_code
  end;

  if v_airline_code is not null then
    perform public.recompute_airline_stats(v_airline_code);
  end if;

  return coalesce(new, old);
end;
$$;

insert into public.claim_payments (
  booking_ref,
  flight_id,
  passenger_email,
  airline_code,
  amount_eur,
  source_status,
  credited_at
)
select
  rf.booking_ref,
  b.flight_id,
  b.passenger_email,
  public.airline_code_from_flight_code(f.flight_code),
  300,
  rf.claim_status,
  coalesce(fcd.auto_accepted_at, fcd.decided_at, rf.confirmed_at, now())
from public.registered_flights rf
join public.bookings b on b.booking_ref = rf.booking_ref
join public.flights f on f.flight_id = b.flight_id
left join public.flight_claim_decisions fcd on fcd.flight_id = f.flight_id
where rf.status = 'confirmed'
  and rf.claim_status in ('accepted', 'auto_accepted')
  and b.passenger_email is not null
  and public.airline_code_from_flight_code(f.flight_code) is not null
on conflict (booking_ref) do nothing;

select public.recompute_all_airline_stats();

drop trigger if exists trg_registered_flights_sync_claim_payment on public.registered_flights;
create trigger trg_registered_flights_sync_claim_payment
after update of claim_status, status on public.registered_flights
for each row
when (old.claim_status is distinct from new.claim_status or old.status is distinct from new.status)
execute function public.sync_claim_payment_and_airline_stats();

drop trigger if exists trg_flights_sync_airline_stats on public.flights;
create trigger trg_flights_sync_airline_stats
after update of actual_arrival_at, delay_minutes, flight_code on public.flights
for each row
execute function public.sync_airline_stats_from_flight();

drop trigger if exists trg_claim_payments_sync_airline_stats on public.claim_payments;
create trigger trg_claim_payments_sync_airline_stats
after insert or update or delete on public.claim_payments
for each row
execute function public.sync_airline_stats_from_payment();
