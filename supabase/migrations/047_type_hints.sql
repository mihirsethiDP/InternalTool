-- =============================================================
-- Migration 047: describe what belongs in a section
--
-- 046 made an admin-added type a real section, but the AI splitter only saw
-- its label ("tds (Technical Data Sheet)") and kept routing spec sheets to
-- "other" — offered, but not usefully routable.
--
-- A hint says what belongs in the section. The built-in nine get the wording
-- the splitter already used; admins can write one for anything they add.
-- =============================================================
begin;

alter table public.document_types
  add column if not exists hint text;

update public.document_types set hint = v.hint from (values
  ('install_commission', 'Mounting, wiring, first start-up, commissioning, sample conditioning'),
  ('configure',          'Settings, parameters, menus, ranges, alarms, communication setup'),
  ('inspect',            'Visual checks, routine inspection, power and signal verification'),
  ('clean',              'Cleaning the sensor, probe, housing or flow cell; fouling removal'),
  ('calibrate',          'Calibration, zero/span, buffers, drift and verification checks'),
  ('replace',            'Replacing the sensor or its parts and consumables'),
  ('troubleshoot_repair','Faults, error codes, symptoms and their fixes, repair'),
  ('maintenance_planning','Maintenance schedules, intervals, frequencies, planning'),
  ('other',              'Anything that genuinely fits no other section')
) as v(key, hint) where document_types.key = v.key and document_types.hint is null;

-- The type this was reported for: specifications belong here, not in "other".
update public.document_types
   set hint = 'Technical specifications: measuring range, accuracy, response time, supply voltage, dimensions, IP rating, materials, communication interface'
 where key = 'tds' and hint is null;

commit;
