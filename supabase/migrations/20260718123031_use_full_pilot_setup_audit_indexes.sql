drop index if exists private.vorta_pilot_programs_pilot_owner_idx;
drop index if exists private.vorta_pilot_programs_manager_contact_idx;
drop index if exists private.vorta_pilot_programs_launch_confirmed_by_idx;
drop index if exists private.vorta_pilot_programs_created_by_idx;
drop index if exists private.vorta_pilot_programs_updated_by_idx;
drop index if exists private.vorta_pilot_manual_checks_checked_by_idx;
drop index if exists private.vorta_pilot_rehearsal_attempts_recorded_by_idx;
drop index if exists private.vorta_pilot_weekly_reviews_completed_by_idx;
drop index if exists private.vorta_pilot_weekly_reviews_created_by_idx;
drop index if exists private.vorta_pilot_weekly_reviews_updated_by_idx;

create index vorta_pilot_programs_pilot_owner_idx
  on private.vorta_pilot_programs (pilot_owner_user_id);

create index vorta_pilot_programs_manager_contact_idx
  on private.vorta_pilot_programs (manager_contact_user_id);

create index vorta_pilot_programs_launch_confirmed_by_idx
  on private.vorta_pilot_programs (launch_confirmed_by);

create index vorta_pilot_programs_created_by_idx
  on private.vorta_pilot_programs (created_by);

create index vorta_pilot_programs_updated_by_idx
  on private.vorta_pilot_programs (updated_by);

create index vorta_pilot_manual_checks_checked_by_idx
  on private.vorta_pilot_manual_checks (checked_by);

create index vorta_pilot_rehearsal_attempts_recorded_by_idx
  on private.vorta_pilot_rehearsal_attempts (recorded_by);

create index vorta_pilot_weekly_reviews_completed_by_idx
  on private.vorta_pilot_weekly_reviews (completed_by);

create index vorta_pilot_weekly_reviews_created_by_idx
  on private.vorta_pilot_weekly_reviews (created_by);

create index vorta_pilot_weekly_reviews_updated_by_idx
  on private.vorta_pilot_weekly_reviews (updated_by);
