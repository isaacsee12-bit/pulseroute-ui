-- PulseRoute community crowd feedback
-- Run once in the Supabase SQL Editor for the project used by PulseRoute.
-- Store the publishable key in Google Secret Manager for the Cloud Run backend.
-- Never use a secret/service_role key; the backend preserves these RLS policies.

create table if not exists public.crowd_reports (
  id uuid primary key default gen_random_uuid(),
  station text not null check (char_length(station) between 1 and 120),
  station_code text not null check (station_code ~ '^(NS|EW|CG|NE|CC|DT|TE)[0-9]{1,2}[A-Z]?$'),
  line text not null check (line in ('NSL','EWL','NEL','CCL','DTL','TEL')),
  crowd_level text not null check (crowd_level in ('green','yellow','red')),
  crowd_value smallint not null check (crowd_value between 0 and 2),
  client_tag text not null check (char_length(client_tag) between 16 and 80),
  report_bucket bigint not null,
  reported_at timestamptz not null default now(),
  unique (client_tag, station_code, line, report_bucket)
);

create index if not exists crowd_reports_reported_at_idx on public.crowd_reports (reported_at desc);
create index if not exists crowd_reports_station_line_idx on public.crowd_reports (station_code, line, reported_at desc);

alter table public.crowd_reports enable row level security;

revoke all on table public.crowd_reports from anon, authenticated;
grant select, insert on table public.crowd_reports to anon, authenticated;

drop policy if exists "crowd reports recent read" on public.crowd_reports;
create policy "crowd reports recent read"
on public.crowd_reports
for select
to anon, authenticated
using (reported_at >= now() - interval '2 hours');

drop policy if exists "crowd reports public insert" on public.crowd_reports;
create policy "crowd reports public insert"
on public.crowd_reports
for insert
to anon, authenticated
with check (
  reported_at between now() - interval '2 minutes' and now() + interval '2 minutes'
  and report_bucket between floor(extract(epoch from now()) / 300)::bigint - 1
                        and floor(extract(epoch from now()) / 300)::bigint + 1
);

-- The unique(client_tag, station_code, line, report_bucket) constraint limits an honest
-- browser identifier to one report per station/line per 5-minute bucket.
-- This is hackathon-grade abuse resistance, not production anti-fraud.
