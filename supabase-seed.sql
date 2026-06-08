-- EveSite 2D — Seed Data: Cedar Grove Apartments
-- Paste this into: Supabase Dashboard → SQL Editor → New Query → Run
-- Run AFTER supabase-schema.sql has already been applied.

-- ─── Additional tables (extend schema for rich jobsite data) ─────────────────

create table if not exists jobsite_phases (
  id            text        not null,
  project_id    uuid        not null references projects(id) on delete cascade,
  name          text        not null,
  summary       text,
  display_order integer     not null default 0,
  primary key (project_id, id)
);

create table if not exists jobsite_layers (
  id              text    not null,
  project_id      uuid    not null references projects(id) on delete cascade,
  name            text    not null,
  color           text    not null,
  default_visible boolean not null default true,
  display_order   integer not null default 0,
  primary key (project_id, id)
);

create table if not exists blueprint_objects (
  id              text    not null,
  project_id      uuid    not null references projects(id) on delete cascade,
  type            text    not null,
  layer_id        text    not null,
  x               numeric not null,
  y               numeric not null,
  label           text    not null,
  phase           text,
  elevation       text,
  depth           text,
  slope           text,
  nearby_ref      text,
  blueprint_sheet text,
  notes           text,
  primary key (project_id, id)
);

create table if not exists utility_lines (
  id         text  not null,
  project_id uuid  not null references projects(id) on delete cascade,
  layer_id   text  not null,
  label      text,
  phase      text,
  points     jsonb not null,
  primary key (project_id, id)
);

-- ─── RLS for new tables (same policy: public read, auth write) ────────────────

alter table jobsite_phases   enable row level security;
alter table jobsite_layers   enable row level security;
alter table blueprint_objects enable row level security;
alter table utility_lines    enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='jobsite_phases' and policyname='Public read jobsite_phases') then
    create policy "Public read jobsite_phases" on jobsite_phases for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='jobsite_phases' and policyname='Auth write jobsite_phases') then
    create policy "Auth write jobsite_phases" on jobsite_phases for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;

  if not exists (select 1 from pg_policies where tablename='jobsite_layers' and policyname='Public read jobsite_layers') then
    create policy "Public read jobsite_layers" on jobsite_layers for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='jobsite_layers' and policyname='Auth write jobsite_layers') then
    create policy "Auth write jobsite_layers" on jobsite_layers for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;

  if not exists (select 1 from pg_policies where tablename='blueprint_objects' and policyname='Public read blueprint_objects') then
    create policy "Public read blueprint_objects" on blueprint_objects for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='blueprint_objects' and policyname='Auth write blueprint_objects') then
    create policy "Auth write blueprint_objects" on blueprint_objects for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;

  if not exists (select 1 from pg_policies where tablename='utility_lines' and policyname='Public read utility_lines') then
    create policy "Public read utility_lines" on utility_lines for select using (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='utility_lines' and policyname='Auth write utility_lines') then
    create policy "Auth write utility_lines" on utility_lines for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;
end $$;

-- ─── Seed: Cedar Grove Apartments project ─────────────────────────────────────

-- Fixed UUID so the seed is repeatable (re-running is safe — uses ON CONFLICT DO NOTHING)
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_name='projects' and column_name='plan_image_url'
  ) then
    alter table projects
      add column plan_image_url text,
      add column plan_width_ft  numeric,
      add column plan_height_ft numeric;
  end if;
end $$;

insert into projects (id, name, plan_image_url, plan_width_ft, plan_height_ft, created_at)
values (
  '00000000-0000-0000-0000-000000000001',
  'Cedar Grove Apartments — Site Civil',
  '/plan-cedar-grove-apartments.svg',
  320,
  260,
  now()
)
on conflict (id) do nothing;

-- ─── Phases ──────────────────────────────────────────────────────────────────

insert into jobsite_phases (id, project_id, name, summary, display_order) values
(
  'phase-grading',
  '00000000-0000-0000-0000-000000000001',
  'Phase 1 — Demo, Mass Grading & Erosion Control',
  'Clear and grub the site, rough-grade to subgrade per the cut/fill plan, install erosion control (silt fence, inlet protection), and re-establish survey control before utility work begins.',
  0
),
(
  'phase-utilities',
  '00000000-0000-0000-0000-000000000001',
  'Phase 2 — Underground Utilities',
  'Install water, sanitary sewer, and storm drain mains and laterals; set manholes and catch basins; tie in to the public mains at the entry connection point.',
  1
),
(
  'phase-pads',
  '00000000-0000-0000-0000-000000000001',
  'Phase 3 — Building Pads, Foundations & Site Vaults',
  'Over-excavate and recompact building pads to finish-floor subgrade per the geotech report; set power transformer/switchgear vaults and fire-protection valve vaults.',
  2
),
(
  'phase-paving',
  '00000000-0000-0000-0000-000000000001',
  'Phase 4 — Paving, Curbs & Final Grade',
  'Install curb & gutter and pave the loop road / entry drive, mount FDC connections at each building, and fine-grade landscape areas to final elevations.',
  3
)
on conflict (project_id, id) do nothing;

-- ─── Layers ───────────────────────────────────────────────────────────────────

insert into jobsite_layers (id, project_id, name, color, default_visible, display_order) values
('water-pipe',      '00000000-0000-0000-0000-000000000001', 'Water',               '#1a73e8', true,  0),
('sewer',           '00000000-0000-0000-0000-000000000001', 'Sewer',               '#34a853', true,  1),
('storm',           '00000000-0000-0000-0000-000000000001', 'Storm Drain',         '#9334e6', true,  2),
('curb-sidewalk',   '00000000-0000-0000-0000-000000000001', 'Curb / Sidewalk',     '#f9ab00', true,  3),
('manholes',        '00000000-0000-0000-0000-000000000001', 'Manholes',            '#ea4335', true,  4),
('buildings',       '00000000-0000-0000-0000-000000000001', 'Buildings',           '#9aa0a6', true,  5),
('streets',         '00000000-0000-0000-0000-000000000001', 'Streets',             '#5f6368', true,  6),
('power',           '00000000-0000-0000-0000-000000000001', 'Power',               '#ffd600', true,  7),
('fire-protection', '00000000-0000-0000-0000-000000000001', 'Fire Protection',     '#c2185b', true,  8),
('control-points',  '00000000-0000-0000-0000-000000000001', 'Control Points',      '#ff6d00', true,  9),
('slopes',          '00000000-0000-0000-0000-000000000001', 'Slopes / Elevations', '#00897b', true, 10)
on conflict (project_id, id) do nothing;

-- ─── Utility Lines ────────────────────────────────────────────────────────────

insert into utility_lines (id, project_id, layer_id, label, phase, points) values
(
  'water-main-loop',
  '00000000-0000-0000-0000-000000000001',
  'water-pipe',
  'Water Main 12" DIP — Looped',
  'phase-utilities',
  '[{"x":71,"y":71},{"x":249,"y":71},{"x":249,"y":199},{"x":71,"y":199},{"x":71,"y":71}]'
),
(
  'water-lateral-a',
  '00000000-0000-0000-0000-000000000001',
  'water-pipe',
  '1" Service — Bldg A',
  'phase-utilities',
  '[{"x":115,"y":95},{"x":115,"y":71}]'
),
(
  'sewer-main',
  '00000000-0000-0000-0000-000000000001',
  'sewer',
  'Sanitary Sewer 10" PVC @ 0.40%',
  'phase-utilities',
  '[{"x":100,"y":95},{"x":100,"y":191},{"x":160,"y":191},{"x":160,"y":232}]'
),
(
  'storm-main',
  '00000000-0000-0000-0000-000000000001',
  'storm',
  'Storm Drain 18" RCP to Detention Basin',
  'phase-utilities',
  '[{"x":205,"y":180},{"x":115,"y":180},{"x":75,"y":205}]'
),
(
  'loop-road-cl',
  '00000000-0000-0000-0000-000000000001',
  'streets',
  'Cedar Grove Loop',
  'phase-paving',
  '[{"x":75,"y":75},{"x":245,"y":75},{"x":245,"y":195},{"x":75,"y":195},{"x":75,"y":75}]'
),
(
  'entry-drive-cl',
  '00000000-0000-0000-0000-000000000001',
  'streets',
  'Magnolia Way (Entry Drive)',
  'phase-paving',
  '[{"x":160,"y":232},{"x":160,"y":195}]'
),
(
  'curb-loop',
  '00000000-0000-0000-0000-000000000001',
  'curb-sidewalk',
  'Curb & Gutter — Loop Road',
  'phase-paving',
  '[{"x":68,"y":68},{"x":252,"y":68},{"x":252,"y":202},{"x":68,"y":202},{"x":68,"y":68}]'
)
on conflict (project_id, id) do nothing;

-- ─── Blueprint Objects ────────────────────────────────────────────────────────

insert into blueprint_objects
  (id, project_id, type, layer_id, x, y, label, phase, elevation, depth, slope, nearby_ref, blueprint_sheet, notes)
values

-- Property corners / control points
('pc-nw',  '00000000-0000-0000-0000-000000000001', 'property_corner', 'control-points',  28,  28, 'PC-1 (NW)', null, '258.4', null, null, 'NW corner of parcel',  'C1.0', 'Found monument — verify against record plat before relying on it.'),
('pc-ne',  '00000000-0000-0000-0000-000000000001', 'property_corner', 'control-points', 292,  28, 'PC-2 (NE)', null, '257.9', null, null, 'NE corner of parcel',  'C1.0', 'Set monument — use as primary calibration point.'),
('pc-se',  '00000000-0000-0000-0000-000000000001', 'property_corner', 'control-points', 292, 232, 'PC-3 (SE)', null, '254.6', null, null, 'SE corner of parcel',  'C1.0', 'Found monument — verify against record plat before relying on it.'),
('pc-sw',  '00000000-0000-0000-0000-000000000001', 'property_corner', 'control-points',  28, 232, 'PC-4 (SW)', null, '255.1', null, null, 'SW corner of parcel',  'C1.0', 'Set monument — use as secondary calibration point.'),

-- Phase 1 — Grading
('cut-marker-nw',  '00000000-0000-0000-0000-000000000001', 'slope_marker', 'slopes',  95,  55, 'CUT 3H:1V',  'phase-grading', '259.0', null, '3H:1V',   'NW pad over-excavation limit',       'C2.1', 'Cut slope per geotech report — bench at 8 ft max height.'),
('fill-marker-se', '00000000-0000-0000-0000-000000000001', 'slope_marker', 'slopes', 235, 210, 'FILL 2H:1V', 'phase-grading', '253.5', null, '2H:1V',   'SE pad fill area',                    'C2.1', 'Compact engineered fill in 8" lifts to 95% relative compaction.'),
('pad-subgrade-cl','00000000-0000-0000-0000-000000000001', 'elevation',    'slopes', 160, 135, 'SG ±256.0',  'phase-grading', '256.0', null, '1.5% min', 'Site centerline subgrade',            'C2.2', 'Rough-grade to subgrade elevation — verify with laser before utility rough-in.'),

-- Phase 2 — Utilities
('mh-101',             '00000000-0000-0000-0000-000000000001', 'manhole',      'manholes', 100, 191, 'MH-101', 'phase-utilities', '254.2', '8.5 ft', null,     'Sewer main / entry drive junction',       'C3.1', 'Drop manhole — confirm invert-in/invert-out elevations against the profile sheet.'),
('mh-102',             '00000000-0000-0000-0000-000000000001', 'manhole',      'manholes', 100, 130, 'MH-102', 'phase-utilities', '255.6', '7.0 ft', null,     'Sewer main, mid-run',                     'C3.1', 'Standard 48" precast manhole — set rim to finish grade, not subgrade.'),
('mh-103',             '00000000-0000-0000-0000-000000000001', 'manhole',      'manholes', 160, 232, 'MH-103', 'phase-utilities', '253.0', '9.5 ft', null,     'Tie-in to public sewer main at street',   'C3.2', 'Connection manhole — coordinate shutdown / tie-in timing with the utility district.'),
('cb-101',             '00000000-0000-0000-0000-000000000001', 'catch_basin',  'storm',    205, 180, 'CB-101', 'phase-utilities', '254.8', '4.5 ft', null,     'NE parking area low point',               'C3.3', 'Curb inlet — confirm grate orientation faces the direction of flow.'),
('cb-102',             '00000000-0000-0000-0000-000000000001', 'catch_basin',  'storm',    115, 180, 'CB-102', 'phase-utilities', '254.5', '4.0 ft', null,     'Clubhouse courtyard low point',           'C3.3', 'Area drain — ties into the 18" RCP storm main heading to the detention basin.'),
('cb-103',             '00000000-0000-0000-0000-000000000001', 'catch_basin',  'storm',     75, 205, 'CB-103', 'phase-utilities', '253.2', '5.0 ft', null,     'Detention basin forebay inlet',           'C3.4', 'Outlet structure — verify orifice plate size with the engineer before backfilling.'),
('invert-slope-sewer', '00000000-0000-0000-0000-000000000001', 'slope_marker', 'slopes',   130, 191, 'S=0.40%','phase-utilities', '254.0', null,     '0.40% SE','Sewer main invert, MH-102 to MH-101',   'C3.1', 'Minimum gravity slope for 10" PVC — verify with pipe laser before backfill.'),

-- Phase 3 — Building Pads & Vaults
('bldg-a-pad',   '00000000-0000-0000-0000-000000000001', 'building_pad', 'buildings',      115, 110, 'Bldg A Pad',   'phase-pads', '256.4', null,     null, null,                       'A1.1',  'FF = 256.40 — over-excavate 3 ft and recompact per the geotech report.'),
('bldg-b-pad',   '00000000-0000-0000-0000-000000000001', 'building_pad', 'buildings',      205, 110, 'Bldg B Pad',   'phase-pads', '256.6', null,     null, null,                       'A1.2',  'FF = 256.60 — over-excavate 3 ft and recompact per the geotech report.'),
('bldg-c-pad',   '00000000-0000-0000-0000-000000000001', 'building_pad', 'buildings',      115, 160, 'Bldg C Pad',   'phase-pads', '255.2', null,     null, null,                       'A1.3',  'FF = 255.20 — over-excavate 2.5 ft and recompact per the geotech report.'),
('bldg-d-pad',   '00000000-0000-0000-0000-000000000001', 'building_pad', 'buildings',      205, 160, 'Bldg D Pad',   'phase-pads', '255.0', null,     null, null,                       'A1.4',  'FF = 255.00 — over-excavate 2.5 ft and recompact per the geotech report.'),
('clubhouse-pad','00000000-0000-0000-0000-000000000001', 'building_pad', 'buildings',      160, 135, 'Clubhouse Pad','phase-pads', '256.0', null,     null, null,                       'A1.0',  'FF = 256.00 — pool equipment vault adjacent; coordinate utility stub-outs early.'),
('pv-1',         '00000000-0000-0000-0000-000000000001', 'vault',        'power',           88, 135, 'PV-1',         'phase-pads', '255.8', '5.0 ft', null, 'Between Bldg A and Bldg C','E1.1',  'Transformer vault — coordinate clearance envelope with the utility company.'),
('pv-2',         '00000000-0000-0000-0000-000000000001', 'vault',        'power',          232, 135, 'PV-2',         'phase-pads', '255.9', '5.0 ft', null, 'Between Bldg B and Bldg D','E1.1',  'Switchgear vault — verify pad orientation against the electrical sheet before pour.'),
('fdv-1',        '00000000-0000-0000-0000-000000000001', 'vault',        'fire-protection',140, 200, 'FDV-1',        'phase-pads', '254.6', '4.5 ft', null, 'Near loop road, south leg', 'FP1.1', 'Fire system valve vault — keep clear of landscape irrigation mainlines.'),
('fdv-2',        '00000000-0000-0000-0000-000000000001', 'vault',        'fire-protection',180,  85, 'FDV-2',        'phase-pads', '256.2', '4.5 ft', null, 'Near loop road, north leg', 'FP1.1', 'PIV vault — verify access cover is rated for fire apparatus loading.'),

-- Phase 4 — Paving, Curbs & Final Grade
('fdc-a',         '00000000-0000-0000-0000-000000000001', 'fdc',       'fire-protection',115,  95, 'FDC-A',      'phase-paving', '256.4', null, null, 'Bldg A — front entry, fire lane side', 'FP1.2', 'Wall-mount FDC — must remain visible and accessible from the fire lane.'),
('fdc-b',         '00000000-0000-0000-0000-000000000001', 'fdc',       'fire-protection',205,  95, 'FDC-B',      'phase-paving', '256.6', null, null, 'Bldg B — front entry, fire lane side', 'FP1.2', 'Wall-mount FDC — must remain visible and accessible from the fire lane.'),
('fdc-c',         '00000000-0000-0000-0000-000000000001', 'fdc',       'fire-protection',115, 175, 'FDC-C',      'phase-paving', '255.2', null, null, 'Bldg C — front entry, fire lane side', 'FP1.2', 'Wall-mount FDC — must remain visible and accessible from the fire lane.'),
('fdc-d',         '00000000-0000-0000-0000-000000000001', 'fdc',       'fire-protection',205, 175, 'FDC-D',      'phase-paving', '255.0', null, null, 'Bldg D — front entry, fire lane side', 'FP1.2', 'Wall-mount FDC — must remain visible and accessible from the fire lane.'),
('final-grade-cl','00000000-0000-0000-0000-000000000001', 'elevation', 'slopes',         160, 195, 'FG ±254.8',  'phase-paving', '254.8', null, '2.0% cross', 'Entry drive finished grade at loop tie-in', 'C7.1', 'Final lift paving — confirm cross-slope drains away from building entries.')

on conflict (project_id, id) do nothing;
