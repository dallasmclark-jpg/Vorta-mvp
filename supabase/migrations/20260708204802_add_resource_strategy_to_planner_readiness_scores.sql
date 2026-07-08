/*
# Add resource strategy fields to planner_readiness_scores

1. Modified Tables
   - `planner_readiness_scores`
     - `resource_strategy` (jsonb, default []) — array of per-skill objects:
       { skill, required, internalAvailable, status }
     - `contractor_required` (boolean, default false) — true when any skill has insufficient internal coverage
     - `contractor_recommendation` (text, nullable) — free-text recommendation for external support

2. Notes
   - Additive-only change; no existing data or columns are altered.
   - Safe to re-run (IF NOT EXISTS / column existence check via DO block).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'planner_readiness_scores' AND column_name = 'resource_strategy'
  ) THEN
    ALTER TABLE planner_readiness_scores ADD COLUMN resource_strategy jsonb NOT NULL DEFAULT '[]';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'planner_readiness_scores' AND column_name = 'contractor_required'
  ) THEN
    ALTER TABLE planner_readiness_scores ADD COLUMN contractor_required boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'planner_readiness_scores' AND column_name = 'contractor_recommendation'
  ) THEN
    ALTER TABLE planner_readiness_scores ADD COLUMN contractor_recommendation text;
  END IF;
END $$;
