-- Add column to store the Supabase Storage path of the airline's
-- rejection report PDF (uploaded when the airline rejects a claim
-- due to uncontrollable circumstances).

alter table public.flight_claim_decisions
  add column if not exists rejection_report_path text null;

comment on column public.flight_claim_decisions.rejection_report_path is
  'Supabase Storage path to the airline''s PDF rejection report (e.g. rejection-reports/<flight_id>/report.pdf)';

-- ── Supabase Storage bucket ──
-- Create the bucket via SQL so that `supabase db reset` creates it automatically.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'rejection-reports',
  'rejection-reports',
  true,
  10485760,                        -- 10 MB
  array['application/pdf']
)
on conflict (id) do nothing;

-- Allow any authenticated user to upload (airline role checked in the API layer).
create policy "Allow authenticated uploads"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'rejection-reports');

-- Allow anyone to read (passengers view the rejection report).
create policy "Allow public reads"
  on storage.objects for select
  to public
  using (bucket_id = 'rejection-reports');
