CREATE TABLE IF NOT EXISTS area_intervention_plans (
  id                                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  area                              text        NOT NULL UNIQUE,
  current_risk_score                integer     NOT NULL,
  current_risk_level                text        NOT NULL,
  recommended_option                text        NOT NULL,
  recommended_duration_hours        numeric     NOT NULL DEFAULT 0,
  recommended_predicted_risk_score  integer     NOT NULL,
  recommended_predicted_risk_level  text        NOT NULL,
  recommended_reduction             integer     NOT NULL DEFAULT 0,
  recommended_efficiency            numeric     NOT NULL DEFAULT 0,
  justification                     text,
  options                           jsonb       NOT NULL DEFAULT '[]',
  target_work_package               jsonb       NOT NULL DEFAULT '{}',
  resource_requirements             jsonb       NOT NULL DEFAULT '[]',
  date_note                         text,
  created_at                        timestamptz NOT NULL DEFAULT now(),
  updated_at                        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE area_intervention_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_area_intervention_plans" ON area_intervention_plans
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "insert_area_intervention_plans" ON area_intervention_plans
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "update_area_intervention_plans" ON area_intervention_plans
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_area_intervention_plans" ON area_intervention_plans
  FOR DELETE TO authenticated USING (true);
