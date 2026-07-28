-- VOR-009 security follow-up: Supabase default privileges grant anon execute on new functions.
-- Remove that explicit grant so handover controls are authenticated-only at the API boundary.

revoke all on function public.vorta_get_shift_handover_actions(uuid, timestamptz, timestamptz) from public, anon;
revoke all on function public.vorta_save_shift_handover_action(uuid, uuid, timestamptz, timestamptz, text, text, text, timestamptz, integer) from public, anon;
revoke all on function public.vorta_acknowledge_shift_handover_action(uuid, integer) from public, anon;
revoke all on function public.vorta_carry_forward_shift_handover_action(uuid, integer, timestamptz, timestamptz, timestamptz) from public, anon;

grant execute on function public.vorta_get_shift_handover_actions(uuid, timestamptz, timestamptz) to authenticated, service_role;
grant execute on function public.vorta_save_shift_handover_action(uuid, uuid, timestamptz, timestamptz, text, text, text, timestamptz, integer) to authenticated, service_role;
grant execute on function public.vorta_acknowledge_shift_handover_action(uuid, integer) to authenticated, service_role;
grant execute on function public.vorta_carry_forward_shift_handover_action(uuid, integer, timestamptz, timestamptz, timestamptz) to authenticated, service_role;
