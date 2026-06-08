-- EveSite 2D — Supabase Schema
-- Paste this into: Supabase Dashboard → SQL Editor → New Query → Run

-- ─── Tables ──────────────────────────────────────────────────────────────────

create table if not exists projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

create table if not exists plan_sheets (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  name          text not null,
  sheet_type    text,
  storage_path  text not null,
  display_order integer not null default 0,
  created_at    timestamptz not null default now()
);

-- ─── Row Level Security ───────────────────────────────────────────────────────
-- Read: anyone (including unauthenticated crew in the field)
-- Write: authenticated managers only

alter table projects enable row level security;
alter table plan_sheets enable row level security;

-- Projects: public read
create policy "Public read projects"
  on projects for select
  using (true);

-- Projects: authenticated write
create policy "Auth insert projects"
  on projects for insert
  with check (auth.role() = 'authenticated');

create policy "Auth update projects"
  on projects for update
  using (auth.role() = 'authenticated');

create policy "Auth delete projects"
  on projects for delete
  using (auth.role() = 'authenticated');

-- Plan sheets: public read
create policy "Public read plan_sheets"
  on plan_sheets for select
  using (true);

-- Plan sheets: authenticated write
create policy "Auth insert plan_sheets"
  on plan_sheets for insert
  with check (auth.role() = 'authenticated');

create policy "Auth update plan_sheets"
  on plan_sheets for update
  using (auth.role() = 'authenticated');

create policy "Auth delete plan_sheets"
  on plan_sheets for delete
  using (auth.role() = 'authenticated');

-- ─── Storage Bucket ───────────────────────────────────────────────────────────
-- Run this separately in the SQL editor (storage schema commands):

insert into storage.buckets (id, name, public)
values ('plan-sheets', 'plan-sheets', true)
on conflict (id) do nothing;

-- Storage policies: public read, authenticated write
create policy "Public read plan-sheets storage"
  on storage.objects for select
  using (bucket_id = 'plan-sheets');

create policy "Auth upload plan-sheets"
  on storage.objects for insert
  with check (bucket_id = 'plan-sheets' and auth.role() = 'authenticated');

create policy "Auth update plan-sheets"
  on storage.objects for update
  using (bucket_id = 'plan-sheets' and auth.role() = 'authenticated');

create policy "Auth delete plan-sheets"
  on storage.objects for delete
  using (bucket_id = 'plan-sheets' and auth.role() = 'authenticated');
