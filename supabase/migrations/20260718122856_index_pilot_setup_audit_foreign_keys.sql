create index vorta_pilot_programs_pilot_owner_idx
  on private.vorta_pilot_programs (pilot_owner_user_id)
  where pilot_owner_user_id is not null;

create index vorta_pilot_programs_manager_contact_idx
  on private.vorta_pilot_programs (manager_contact_user_id)
  where manager_contact_user_id is not null;

create index vorta_pilot_programs_launch_confirmed_by_idx
  on private.vorta_pilot_programs (launch_confirmed_by)
  where launch_confirmed_by is not null;

create index vorta_pilot_programs_created_by_idx
  on private.vorta_pilot_programs (created_by)
  where created_by is not null;

create index vorta_pilot_programs_updated_by_idx
  on private.vorta_pilot_programs (updated_by)
  where updated_by is not null;

create index vorta_pilot_manual_checks_checked_by_idx
  on private.vorta_pilot_manual_checks (checked_by)
  where checked_by is not null;

create index vorta_pilot_rehearsal_attempts_recorded_by_idx
  on private.vorta_pilot_rehearsal_attempts (recorded_by)
  where recorded_by is not null;

create index vorta_pilot_weekly_reviews_completed_by_idx
  on private.vorta_pilot_weekly_reviews (completed_by)
  where completed_by is not null;

create index vorta_pilot_weekly_reviews_created_by_idx
  on private.vorta_pilot_weekly_reviews (created_by)
  where created_by is not null;

create index vorta_pilot_weekly_reviews_updated_by_idx
  on private.vorta_pilot_weekly_reviews (updated_by)
  where updated_by is not null;
