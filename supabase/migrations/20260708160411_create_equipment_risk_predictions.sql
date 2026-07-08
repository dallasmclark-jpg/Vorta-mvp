CREATE TABLE IF NOT EXISTS equipment_risk_predictions (
  id                            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id                  text        NOT NULL,
  prediction_date               date        NOT NULL DEFAULT CURRENT_DATE,
  current_score                 integer     NOT NULL,
  projected_7_day_score         integer     NOT NULL,
  projected_30_day_score        integer     NOT NULL,
  projected_90_day_score        integer     NOT NULL,
  projected_level               text        NOT NULL,
  trend_direction               text        NOT NULL,
  primary_driver                text,
  reason                        text,
  recommended_action            text,
  estimated_score_after_action  integer,
  created_at                    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipment_risk_predictions_equipment_date
  ON equipment_risk_predictions (equipment_id, prediction_date DESC);

ALTER TABLE equipment_risk_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_equipment_risk_predictions" ON equipment_risk_predictions
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "insert_equipment_risk_predictions" ON equipment_risk_predictions
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "update_equipment_risk_predictions" ON equipment_risk_predictions
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_equipment_risk_predictions" ON equipment_risk_predictions
  FOR DELETE TO authenticated USING (true);
