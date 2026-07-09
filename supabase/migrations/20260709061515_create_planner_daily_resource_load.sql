/*
# Create planner_daily_resource_load table

1. New Tables
   - `planner_daily_resource_load`
     - area (text) — production area
     - load_date (date) — the shift date
     - shift (text) — "Day Shift" or "Night Shift"
     - resource_name (text) — engineer or contractor name
     - resource_type (text) — "Internal" or "Contractor"
     - primary_skill (text) — discipline (Mechanical, Electrical, etc.)
     - planned_hours (numeric) — hours scheduled on this shift
     - capacity_hours (numeric) — total hours available this shift
     - available_hours (numeric) — remaining unallocated hours
     - trained_for_selected_work (boolean) — whether trained for the active work pack
     - status (text) — Available, Tight, Full, Overloaded
     - assigned_work_refs (jsonb) — array of work order refs assigned
     - notes (text) — optional notes

2. Security
   - RLS enabled. Single-tenant: anon + authenticated can CRUD.
*/

CREATE TABLE IF NOT EXISTS planner_daily_resource_load (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area text NOT NULL,
  load_date date NOT NULL,
  shift text NOT NULL,
  resource_name text NOT NULL,
  resource_type text NOT NULL DEFAULT 'Internal',
  primary_skill text NOT NULL DEFAULT '',
  planned_hours numeric NOT NULL DEFAULT 0,
  capacity_hours numeric NOT NULL DEFAULT 0,
  available_hours numeric NOT NULL DEFAULT 0,
  trained_for_selected_work boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'Available',
  assigned_work_refs jsonb NOT NULL DEFAULT '[]',
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE planner_daily_resource_load ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_daily_load" ON planner_daily_resource_load;
CREATE POLICY "anon_select_daily_load" ON planner_daily_resource_load FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_daily_load" ON planner_daily_resource_load;
CREATE POLICY "anon_insert_daily_load" ON planner_daily_resource_load FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_daily_load" ON planner_daily_resource_load;
CREATE POLICY "anon_update_daily_load" ON planner_daily_resource_load FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_daily_load" ON planner_daily_resource_load;
CREATE POLICY "anon_delete_daily_load" ON planner_daily_resource_load FOR DELETE
  TO anon, authenticated USING (true);
