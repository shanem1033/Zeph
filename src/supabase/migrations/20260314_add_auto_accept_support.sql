-- Add auto-accept support for claims not disputed within 7 days.

-- 1. Add auto_accepted_at timestamp to flight_claim_decisions
alter table public.flight_claim_decisions
  add column if not exists auto_accepted_at timestamptz null;

-- 2. Widen the decision check constraint to allow 'auto_accepted'
--    Drop the old constraint and re-create it.
alter table public.flight_claim_decisions
  drop constraint if exists flight_claim_decisions_decision_check;

alter table public.flight_claim_decisions
  add constraint flight_claim_decisions_decision_check
  check (decision in ('accepted', 'rejected', 'auto_accepted'));
