-- =============================================================
-- Migration 051: plants + device domains
--
-- The tool stops being sensor-only. Two ideas, both as data:
--
--  1. DOMAIN. A category is either a sensor or a piece of site electronics
--     (UPS, datalogger, camera …). Same catalogue, same documents, same flows,
--     same chat — the domain only drives grouping, wording and which checklist
--     sections count. Adding a fourth electronic later is one category row.
--
--  2. PLANT DEVICE REGISTER. `plant_sensors` (v1, never populated) becomes the
--     per-plant register at the grain the field data actually has: one row per
--     (plant, make/model) with a quantity, the example tags, the analyst's
--     notes, and — importantly — whether the entry is a nameplate reading or a
--     fleet-commonest working assumption. The chat reads this to skip the
--     "which make & model?" question when the plant already answers it.
--
-- Table names keep their `sensor_` prefix on purpose: renaming 50 migrations,
-- the edge function and every query buys nothing a user can see. The UI says
-- "devices"; storage says `sensor_models`. Documented here so nobody "fixes" it.
-- =============================================================
begin;

-- ---------- 1. categories: domain ----------
alter table public.sensor_categories
  add column if not exists domain text not null default 'sensor'
    check (domain in ('sensor', 'electronics'));

-- ---------- 2. plants: code / client / status ----------
-- `code` is the short site code every tag already carries (":GD", ":ADA",
-- ":AMAD" …) — the future join key to PLC/tag data, so it is stored now.
alter table public.plants
  add column if not exists code text,
  add column if not exists client text,
  add column if not exists status text not null default 'active'
    check (status in ('active', 'discontinued')),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists plants_code_key on public.plants (code) where code is not null;

-- ---------- 3. plant_sensors → the device register ----------
alter table public.plant_sensors
  add column if not exists category_id uuid references public.sensor_categories(id) on delete restrict,
  add column if not exists quantity int not null default 1 check (quantity >= 0),
  add column if not exists tags text[] not null default '{}',
  add column if not exists notes text,
  -- register = imported from the plant fill sheet; rule = derived (UPS by
  -- site rule, one camera per plant …); manual = added in the UI.
  add column if not exists source text not null default 'manual'
    check (source in ('register', 'rule', 'manual')),
  -- true = "fleet-commonest make, not a nameplate reading". The assistant
  -- says "recorded as … — check the nameplate" instead of asserting it.
  add column if not exists is_assumption boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- Register grain: one row per (plant, model). v1 never populated this table,
-- but dedupe defensively before the constraint lands. Tag-level rows belong
-- in their own table when that data arrives; this one stays per-model.
delete from public.plant_sensors a using public.plant_sensors b
 where a.plant_id = b.plant_id and a.sensor_model_id = b.sensor_model_id and a.id > b.id;
create unique index if not exists plant_sensors_plant_model_key
  on public.plant_sensors (plant_id, sensor_model_id);
create index if not exists plant_sensors_category_idx on public.plant_sensors (plant_id, category_id);

update public.plant_sensors ps
   set category_id = sm.category_id
  from public.sensor_models sm
 where sm.id = ps.sensor_model_id and ps.category_id is null;

-- ---------- 4. people: home plant ----------
alter table public.profiles
  add column if not exists home_plant_id uuid references public.plants(id) on delete set null;

-- ---------- 5. checklist sections per domain ----------
-- "Calibrate" should not count against a camera's completeness. Which
-- sections apply to which domain is data, editable in Admin → Types.
alter table public.document_types
  add column if not exists applies_to text[] not null default '{sensor,electronics}';
update public.document_types set applies_to = '{sensor}'
 where key = 'calibrate' and applies_to = '{sensor,electronics}';

-- ---------- 6. RLS ----------
alter table public.plants enable row level security;
alter table public.plant_sensors enable row level security;

drop policy if exists plants_select on public.plants;
create policy plants_select on public.plants for select to authenticated using (true);
drop policy if exists plants_write on public.plants;
create policy plants_write on public.plants for all to authenticated
  using (public.current_role() = 'admin') with check (public.current_role() = 'admin');

-- Uploaders maintain the register too: the person who knows a plant's
-- devices is the one on site, not necessarily an admin.
drop policy if exists plant_sensors_select on public.plant_sensors;
create policy plant_sensors_select on public.plant_sensors for select to authenticated using (true);
drop policy if exists plant_sensors_write on public.plant_sensors;
create policy plant_sensors_write on public.plant_sensors for all to authenticated
  using (public.current_role() in ('admin', 'uploader'))
  with check (public.current_role() in ('admin', 'uploader'));

-- Anyone may set their own home plant (015 already lets a user update their
-- own row; 044's trigger keeps role / is_super out of reach on that path).

-- ---------- 7. categories the register uses that the master list lacks ----------
-- Four real product classes from the plant fill sheet, plus the first three
-- electronics. Aliases feed the chat's routing, so "battery backup", "RPi"
-- and "CCTV" all land on the right category.
insert into public.sensor_categories (name, "group", domain, aliases) values
  ('Biomass Health',  'Instrumentation', 'sensor',      array['BHT','Bio Health Tracker','Biomass Health Tracker','SV30','Floc Detector','Sludge Volume']),
  ('Bar Screen Level','Instrumentation', 'sensor',      array['Bar Screen','Screen Level','Bar Screen Sensor','BS']),
  ('TDS',             'Instrumentation', 'sensor',      array['Total Dissolved Solids','TDS Sensor','TDS Meter','TDS Transmitter']),
  ('Air Flow',        'Instrumentation', 'sensor',      array['Airflow Meter','Air Flow Meter','Pitot Tube','Blower Air Flow']),
  ('UPS',             'Electronics',     'electronics', array['Uninterruptible Power Supply','Inverter','Battery Backup','Power Backup','Online UPS','1KVA UPS']),
  ('Datalogger',      'Electronics',     'electronics', array['Data Logger','Raspberry Pi','RPi','Pi','Gateway','PLC Gateway','Modbus Gateway','Site Gateway','Edge Device','IoT Box','Logger']),
  ('Camera',          'Electronics',     'electronics', array['CCTV','IP Camera','EZVIZ','Wi-Fi Camera','Webcam','Surveillance Camera'])
on conflict (name) do update
  set domain  = excluded.domain,
      "group" = coalesce(public.sensor_categories."group", excluded."group"),
      aliases = (select array(select distinct unnest(public.sensor_categories.aliases || excluded.aliases)));

-- Every category gets its general entry (022's rule), including the new ones.
insert into public.sensor_models (make_id, category_id, model_no, name, is_general)
select null, c.id, 'General — ' || c.name, 'General ' || c.name || ' guidance', true
  from public.sensor_categories c
 where not exists (select 1 from public.sensor_models sm where sm.category_id = c.id and sm.is_general = true);

-- ---------- 8. the electronics fleet ----------
insert into public.sensor_makes (name) values
  ('Microtek'), ('BPE'), ('Emerson (Vertiv)'), ('Raspberry Pi'), ('EZVIZ (Hikvision)')
on conflict (name) do nothing;

-- UPS: three makes, one handbook. The shared troubleshooting + PPM lives on
-- the category's general entry; the per-make rows exist so a plant can say
-- which OEM to call. Model numbers are not on record yet — fill in when known.
insert into public.sensor_models (make_id, category_id, model_no, name, is_general)
select mk.id, c.id, v.model_no, v.name, false
  from (values
    ('Microtek',          '1 kVA Online UPS', 'Microtek 1 kVA Online UPS'),
    ('BPE',               '1 kVA Online UPS', 'BPE 1 kVA Online UPS'),
    ('Emerson (Vertiv)',  '1 kVA Online UPS', 'Emerson (Vertiv) 1 kVA Online UPS')
  ) as v(make, model_no, name)
  join public.sensor_makes mk on mk.name = v.make
  join public.sensor_categories c on c.name = 'UPS'
 where not exists (select 1 from public.sensor_models sm where sm.make_id = mk.id and sm.category_id = c.id and sm.model_no = v.model_no);

insert into public.sensor_models (make_id, category_id, model_no, name, vendor_url, is_general)
select mk.id, c.id, v.model_no, v.name, v.url, false
  from (values
    ('Raspberry Pi',      'Datalogger', 'Pi 4 Model B (4 GB)', 'Raspberry Pi 4 Model B, 4 GB RAM — site datalogger', 'https://www.raspberrypi.com/products/raspberry-pi-4-model-b/'),
    ('EZVIZ (Hikvision)', 'Camera',     'CS-H6C',              'EZVIZ H6C Wi-Fi pan & tilt camera',                  'https://www.ezviz.com/product/h6c/')
  ) as v(make, category, model_no, name, url)
  join public.sensor_makes mk on mk.name = v.make
  join public.sensor_categories c on c.name = v.category
 where not exists (select 1 from public.sensor_models sm where sm.make_id = mk.id and sm.category_id = c.id and sm.model_no = v.model_no);

commit;

-- Verify
-- select name, domain, cardinality(aliases) from public.sensor_categories where domain = 'electronics' or name in ('Biomass Health','Bar Screen Level','TDS','Air Flow');
-- select mk.name, sm.model_no, c.name from public.sensor_models sm join public.sensor_makes mk on mk.id = sm.make_id join public.sensor_categories c on c.id = sm.category_id where c.domain = 'electronics';
