-- VOR-069 performance follow-up from the Supabase database advisor.
create index if not exists vorta_demo_backtest_scenarios_equipment_idx
  on private.vorta_demo_backtest_scenarios (equipment_id);
create index if not exists vorta_demo_backtest_scenarios_component_idx
  on private.vorta_demo_backtest_scenarios (component_id);
create index if not exists vorta_demo_backtest_scenarios_work_order_idx
  on private.vorta_demo_backtest_scenarios (work_order_id)
  where work_order_id is not null;
