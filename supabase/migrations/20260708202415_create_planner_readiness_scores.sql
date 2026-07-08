/*
# Create planner_readiness_scores table

1. New Tables
- `planner_readiness_scores`
  - area (text) — production area name
  - proposed_date (date) — the date being evaluated
  - proposed_shift (text) — "Day Shift" or "Night Shift"
  - readiness_score (integer) — 0–100 composite score
  - readiness_level (text) — "Ready", "Review", "At Risk", "Blocked"
  - labour_required_hours (numeric) — total labour hours needed
  - labour_available_hours (numeric) — total labour hours available
  - labour_status (text)
  - skills_required (integer) — distinct skill types needed
  - skills_covered (integer) — distinct skill types available
  - skills_status (text)
  - spares_required (integer) — spare parts needed
  - spares_ready (integer) — spare parts confirmed available
  - spares_status (text)
  - workload_clash_hours (numeric) — hours of scheduling conflict
  - warnings (jsonb) — array of warning strings
  - recommendation (text) — planner recommendation text
2. Security
  - Enable RLS. Single-tenant demo app so anon + authenticated can read.
*/

CREATE TABLE IF NOT EXISTS planner_readiness_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area text NOT NULL,
  proposed_date date NOT NULL,
  proposed_shift text NOT NULL,
  readiness_score integer NOT NULL DEFAULT 0,
  readiness_level text NOT NULL DEFAULT 'Unknown',
  labour_required_hours numeric NOT NULL DEFAULT 0,
  labour_available_hours numeric NOT NULL DEFAULT 0,
  labour_status text NOT NULL DEFAULT 'Unknown',
  skills_required integer NOT NULL DEFAULT 0,
  skills_covered integer NOT NULL DEFAULT 0,
  skills_status text NOT NULL DEFAULT 'Unknown',
  spares_required integer NOT NULL DEFAULT 0,
  spares_ready integer NOT NULL DEFAULT 0,
  spares_status text NOT NULL DEFAULT 'Unknown',
  workload_clash_hours numeric NOT NULL DEFAULT 0,
  warnings jsonb NOT NULL DEFAULT '[]',
  recommendation text,
  created_at timestamptz DEFAULT now(),
  UNIQUE (area, proposed_date, proposed_shift)
);

ALTER TABLE planner_readiness_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_readiness" ON planner_readiness_scores;
CREATE POLICY "anon_select_readiness" ON planner_readiness_scores FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_readiness" ON planner_readiness_scores;
CREATE POLICY "anon_insert_readiness" ON planner_readiness_scores FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_readiness" ON planner_readiness_scores;
CREATE POLICY "anon_update_readiness" ON planner_readiness_scores FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_readiness" ON planner_readiness_scores;
CREATE POLICY "anon_delete_readiness" ON planner_readiness_scores FOR DELETE
  TO anon, authenticated USING (true);
