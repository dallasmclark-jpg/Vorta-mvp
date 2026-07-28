-- VOR-009 performance follow-up: cover all workflow foreign keys used by audit and lifecycle operations.

create index if not exists shift_handover_actions_organisation_idx
  on public.shift_handover_actions (organisation_id);
create index if not exists shift_handover_actions_acknowledged_by_idx
  on public.shift_handover_actions (acknowledged_by)
  where acknowledged_by is not null;
create index if not exists shift_handover_actions_carry_from_idx
  on public.shift_handover_actions (carry_forward_from)
  where carry_forward_from is not null;
create index if not exists shift_handover_actions_carry_to_idx
  on public.shift_handover_actions (carried_forward_to)
  where carried_forward_to is not null;
create index if not exists shift_handover_actions_created_by_idx
  on public.shift_handover_actions (created_by);
create index if not exists shift_handover_actions_updated_by_idx
  on public.shift_handover_actions (updated_by);

create index if not exists shift_handover_action_events_organisation_idx
  on public.shift_handover_action_events (organisation_id);
create index if not exists shift_handover_action_events_site_idx
  on public.shift_handover_action_events (site_id, created_at desc);
create index if not exists shift_handover_action_events_actor_idx
  on public.shift_handover_action_events (actor_id, created_at desc);
