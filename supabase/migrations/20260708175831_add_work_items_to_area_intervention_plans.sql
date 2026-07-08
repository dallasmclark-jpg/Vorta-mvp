ALTER TABLE area_intervention_plans
  ADD COLUMN IF NOT EXISTS work_items jsonb NOT NULL DEFAULT '[]';