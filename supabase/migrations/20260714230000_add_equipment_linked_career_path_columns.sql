alter table public.engineer_career_paths
  add column equipment_id uuid references public.equipment_assets(id) on delete cascade,
  add column target_capability_role text,
  add column supervised_interventions_required smallint not null default 0,
  add column supervised_interventions_completed smallint not null default 0,
  add column evidence_items_required smallint not null default 0,
  add column evidence_items_completed smallint not null default 0,
  add column expected_risk_reduction numeric(5,1) not null default 0,
  add column target_completion_date date,
  add column development_summary text;

alter table public.engineer_career_paths
  add constraint engineer_career_paths_capability_role_check
    check (
      target_capability_role is null
      or target_capability_role in (
        'PRIMARY_SME',
        'BACKUP_SME',
        'QUALIFIED_SUPPORT',
        'INDEPENDENT_MAINTAINER'
      )
    ),
  add constraint engineer_career_paths_equipment_role_check
    check (equipment_id is null or target_capability_role is not null),
  add constraint engineer_career_paths_interventions_check
    check (
      supervised_interventions_required >= 0
      and supervised_interventions_completed >= 0
      and supervised_interventions_completed <= supervised_interventions_required
    ),
  add constraint engineer_career_paths_evidence_check
    check (
      evidence_items_required >= 0
      and evidence_items_completed >= 0
      and evidence_items_completed <= evidence_items_required
    ),
  add constraint engineer_career_paths_risk_reduction_check
    check (expected_risk_reduction between 0 and 100);

create unique index engineer_career_paths_active_equipment_target_idx
  on public.engineer_career_paths (
    engineer_id,
    equipment_id,
    target_capability_role
  )
  where equipment_id is not null
    and status = 'active';

create index engineer_career_paths_equipment_idx
  on public.engineer_career_paths (equipment_id, status, readiness_score desc);

alter table public.operator_career_paths
  add column equipment_id uuid references public.equipment_assets(id) on delete cascade,
  add column target_capability_role text,
  add column current_am_step smallint,
  add column target_am_step smallint,
  add column supervised_routines_required smallint not null default 0,
  add column supervised_routines_completed smallint not null default 0,
  add column evidence_items_required smallint not null default 0,
  add column evidence_items_completed smallint not null default 0,
  add column expected_risk_reduction numeric(5,1) not null default 0,
  add column target_completion_date date,
  add column development_summary text,
  add column mentor_engineer_id uuid references public.engineers(id) on delete set null;

alter table public.operator_career_paths
  add constraint operator_career_paths_capability_role_check
    check (
      target_capability_role is null
      or target_capability_role in (
        'AM_STEP',
        'LEAD_AM_OPERATOR',
        'RELIEF_AM_OPERATOR'
      )
    ),
  add constraint operator_career_paths_equipment_role_check
    check (equipment_id is null or target_capability_role is not null),
  add constraint operator_career_paths_am_steps_check
    check (
      (current_am_step is null and target_am_step is null)
      or (
        current_am_step between 0 and 7
        and target_am_step between 0 and 7
        and target_am_step >= current_am_step
      )
    ),
  add constraint operator_career_paths_routines_check
    check (
      supervised_routines_required >= 0
      and supervised_routines_completed >= 0
      and supervised_routines_completed <= supervised_routines_required
    ),
  add constraint operator_career_paths_evidence_check
    check (
      evidence_items_required >= 0
      and evidence_items_completed >= 0
      and evidence_items_completed <= evidence_items_required
    ),
  add constraint operator_career_paths_risk_reduction_check
    check (expected_risk_reduction between 0 and 100);

create unique index operator_career_paths_active_equipment_target_idx
  on public.operator_career_paths (
    operator_id,
    equipment_id,
    target_capability_role
  )
  where equipment_id is not null
    and status = 'active';

create index operator_career_paths_equipment_idx
  on public.operator_career_paths (equipment_id, status, readiness_score desc);
