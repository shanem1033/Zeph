-- Normalize legacy airline prefixes to the canonical demo codes used by the app:
--   AZ -> FR (Ryanair)
--   KL -> U2 (EasyJet)

create temporary table tmp_flight_code_normalization_map on commit drop as
select
  f.flight_id as old_flight_id,
  f.flight_code as old_flight_code,
  case
    when f.flight_id like 'AZ%' then 'FR' || substring(f.flight_id from 3)
    when f.flight_id like 'KL%' then 'U2' || substring(f.flight_id from 3)
    else f.flight_id
  end as new_flight_id,
  case
    when f.flight_code like 'AZ%' then 'FR' || substring(f.flight_code from 3)
    when f.flight_code like 'KL%' then 'U2' || substring(f.flight_code from 3)
    else f.flight_code
  end as new_flight_code,
  exists (
    select 1
    from public.flights f2
    where f2.flight_id = case
      when f.flight_id like 'AZ%' then 'FR' || substring(f.flight_id from 3)
      when f.flight_id like 'KL%' then 'U2' || substring(f.flight_id from 3)
      else f.flight_id
    end
      and f2.flight_id <> f.flight_id
  ) as target_exists
from public.flights f
where f.flight_code like 'AZ%' or f.flight_code like 'KL%';

insert into public.routes (origin, destination, flight_code, duration_minutes)
select
  r.origin,
  r.destination,
  case
    when r.flight_code like 'AZ%' then 'FR' || substring(r.flight_code from 3)
    when r.flight_code like 'KL%' then 'U2' || substring(r.flight_code from 3)
    else r.flight_code
  end,
  r.duration_minutes
from public.routes r
where r.flight_code like 'AZ%' or r.flight_code like 'KL%'
on conflict (origin, destination, flight_code) do update
set duration_minutes = excluded.duration_minutes;

delete from public.routes
where flight_code like 'AZ%' or flight_code like 'KL%';

alter table if exists public.flight_claim_decisions
  drop constraint if exists flight_claim_decisions_flight_id_fkey;

alter table if exists public.claim_payments
  drop constraint if exists claim_payments_flight_id_fkey;

update public.bookings b
set flight_id = m.new_flight_id
from tmp_flight_code_normalization_map m
where b.flight_id = m.old_flight_id;

insert into public.flight_claim_decisions (
  flight_id,
  decision,
  evidence,
  evidence_hash,
  decided_at,
  decided_by_wallet,
  chain_id,
  contract_address,
  tx_hash,
  created_at,
  rejection_report_path,
  auto_accepted_at
)
select
  m.new_flight_id,
  d.decision,
  d.evidence,
  d.evidence_hash,
  d.decided_at,
  d.decided_by_wallet,
  d.chain_id,
  d.contract_address,
  d.tx_hash,
  d.created_at,
  d.rejection_report_path,
  d.auto_accepted_at
from public.flight_claim_decisions d
join tmp_flight_code_normalization_map m on m.old_flight_id = d.flight_id
on conflict (flight_id) do update
set
  decision = case
    when excluded.decided_at >= public.flight_claim_decisions.decided_at then excluded.decision
    else public.flight_claim_decisions.decision
  end,
  evidence = case
    when excluded.decided_at >= public.flight_claim_decisions.decided_at then excluded.evidence
    else public.flight_claim_decisions.evidence
  end,
  evidence_hash = case
    when excluded.decided_at >= public.flight_claim_decisions.decided_at then excluded.evidence_hash
    else public.flight_claim_decisions.evidence_hash
  end,
  decided_at = greatest(public.flight_claim_decisions.decided_at, excluded.decided_at),
  decided_by_wallet = case
    when excluded.decided_at >= public.flight_claim_decisions.decided_at then excluded.decided_by_wallet
    else public.flight_claim_decisions.decided_by_wallet
  end,
  chain_id = case
    when excluded.decided_at >= public.flight_claim_decisions.decided_at then excluded.chain_id
    else public.flight_claim_decisions.chain_id
  end,
  contract_address = case
    when excluded.decided_at >= public.flight_claim_decisions.decided_at then excluded.contract_address
    else public.flight_claim_decisions.contract_address
  end,
  tx_hash = case
    when excluded.decided_at >= public.flight_claim_decisions.decided_at then excluded.tx_hash
    else public.flight_claim_decisions.tx_hash
  end,
  rejection_report_path = case
    when excluded.decided_at >= public.flight_claim_decisions.decided_at then excluded.rejection_report_path
    else public.flight_claim_decisions.rejection_report_path
  end,
  auto_accepted_at = greatest(public.flight_claim_decisions.auto_accepted_at, excluded.auto_accepted_at);

delete from public.flight_claim_decisions d
using tmp_flight_code_normalization_map m
where d.flight_id = m.old_flight_id;

update public.claim_payments cp
set flight_id = m.new_flight_id
from tmp_flight_code_normalization_map m
where cp.flight_id = m.old_flight_id;

update public.flights canonical
set
  origin = coalesce(canonical.origin, legacy.origin),
  destination = coalesce(canonical.destination, legacy.destination),
  scheduled_departure_at = coalesce(canonical.scheduled_departure_at, legacy.scheduled_departure_at),
  scheduled_arrival_at = coalesce(canonical.scheduled_arrival_at, legacy.scheduled_arrival_at),
  actual_arrival_at = coalesce(canonical.actual_arrival_at, legacy.actual_arrival_at),
  delay_minutes = coalesce(canonical.delay_minutes, legacy.delay_minutes),
  oracle_processed_at = coalesce(canonical.oracle_processed_at, legacy.oracle_processed_at),
  oracle_tx_hash = coalesce(canonical.oracle_tx_hash, legacy.oracle_tx_hash),
  created_at = least(canonical.created_at, legacy.created_at)
from tmp_flight_code_normalization_map m
join public.flights legacy on legacy.flight_id = m.old_flight_id
where m.target_exists
  and canonical.flight_id = m.new_flight_id;

update public.flights f
set
  flight_id = m.new_flight_id,
  flight_code = m.new_flight_code
from tmp_flight_code_normalization_map m
where f.flight_id = m.old_flight_id
  and not m.target_exists;

delete from public.flights f
using tmp_flight_code_normalization_map m
where f.flight_id = m.old_flight_id
  and m.target_exists;

update public.claim_payments cp
set airline_code = public.airline_code_from_flight_code(f.flight_code)
from public.flights f
where cp.flight_id = f.flight_id
  and cp.airline_code is distinct from public.airline_code_from_flight_code(f.flight_code);

do $$
begin
  if to_regclass('public.flight_claim_decisions') is not null then
    alter table public.flight_claim_decisions
      add constraint flight_claim_decisions_flight_id_fkey
      foreign key (flight_id) references public.flights(flight_id) on delete cascade;
  end if;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if to_regclass('public.claim_payments') is not null then
    alter table public.claim_payments
      add constraint claim_payments_flight_id_fkey
      foreign key (flight_id) references public.flights(flight_id) on delete cascade;
  end if;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  if to_regprocedure('public.recompute_all_airline_stats()') is not null then
    perform public.recompute_all_airline_stats();
  end if;
end $$;
