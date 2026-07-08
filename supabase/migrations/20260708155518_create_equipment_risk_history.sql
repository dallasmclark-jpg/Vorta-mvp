CREATE TABLE IF NOT EXISTS equipment_risk_history (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  equipment_id      text        NOT NULL,
  snapshot_date     date        NOT NULL,
  snapshot_label    text,
  risk_score        integer     NOT NULL,
  risk_level        text        NOT NULL,
  primary_driver    text,
  main_driver_pct   integer,
  change_reason     text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_equipment_risk_history_equipment_date
  ON equipment_risk_history (equipment_id, snapshot_date);

ALTER TABLE equipment_risk_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_equipment_risk_history" ON equipment_risk_history
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY "insert_equipment_risk_history" ON equipment_risk_history
  FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "update_equipment_risk_history" ON equipment_risk_history
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_equipment_risk_history" ON equipment_risk_history
  FOR DELETE TO authenticated USING (true);
