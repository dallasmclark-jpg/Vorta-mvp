CREATE TABLE IF NOT EXISTS area_shutdown_plans (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  area                      text        NOT NULL UNIQUE,
  current_risk_score        integer     NOT NULL,
  current_risk_level        text        NOT NULL,
  recommended_window_hours  integer     NOT NULL DEFAULT 0,
  target_asset_count        integer     NOT NULL DEFAULT 0,
  target_pm_count           integer     NOT NULL DEFAULT 0,
  target_calibration_count  integer     NOT NULL DEFAULT 0,
  target_spares_count       integer     NOT NULL DEFAULT 0,
  predicted_risk_score      integer     NOT NULL,
  predicted_risk_level      text        NOT NULL,
  estimated_reduction       integer     NOT NULL DEFAULT 0,
  confidence                text        NOT NULL DEFAULT 'Medium',
  justification             text,
  recommended_actions       jsonb       NOT NULL DEFAULT '[]',
  required_skills           jsonb       NOT NULL DEFAULT '[]',
  required_spares           jsonb       NOT NULL DEFAULT '[]',
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE area_shutdown_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_area_shutdown_plans" ON area_shutdown_plans
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "insert_area_shutdown_plans" ON area_shutdown_plans
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "update_area_shutdown_plans" ON area_shutdown_plans
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_area_shutdown_plans" ON area_shutdown_plans
  FOR DELETE TO authenticated USING (true);
