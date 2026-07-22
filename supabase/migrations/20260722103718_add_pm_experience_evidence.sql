-- Additive PM experience evidence foundation for the Skills Matrix.
-- Existing skills, capability and risk calculations remain unchanged.

create table if not exists public.engineer_source_identities (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  engineer_id uuid not null references public.engineers(id) on delete cascade,
  source_system text not null,
  identity_type text not null,
  source_identity text not null,
  mapping_status text not null default 'suggested'
    check (mapping_status in ('suggested', 'verified', 'rejected', 'expired')),
  confidence_score numeric(5,4) not null default 0
    check (confidence_score >= 0 and confidence_score <= 1),
  mapping_basis text,
  valid_from date,
  valid_until date,
  verified_by uuid references public.profiles(id) on delete set null,
  verified_at timestamptz,
  import_batch_id uuid references private.vorta_import_batches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint engineer_source_identities_identity_not_blank
    check (length(btrim(source_identity)) > 0),
  constraint engineer_source_identities_valid_dates
    check (valid_until is null or valid_from is null or valid_until >= valid_from),
  constraint engineer_source_identities_source_identity_key
    unique (site_id, source_system, identity_type, source_identity)
);

comment on table public.engineer_source_identities is
  'Verified or reviewable mappings between Vorta engineers and external personnel identities such as SAP personnel numbers.';
comment on column public.engineer_source_identities.mapping_status is
  'Only verified mappings contribute to PM experience evidence.';

create index if not exists engineer_source_identities_engineer_idx
  on public.engineer_source_identities (engineer_id, mapping_status);
create index if not exists engineer_source_identities_lookup_idx
  on public.engineer_source_identities (site_id, source_system, identity_type, source_identity, mapping_status);

alter table public.engineer_source_identities enable row level security;
drop policy if exists engineer_source_identities_site_read on public.engineer_source_identities;
create policy engineer_source_identities_site_read
  on public.engineer_source_identities
  for select
  to authenticated
  using (
    private.vorta_rls_has_site_access(site_id, false)
    and private.vorta_rls_has_engineer_access(engineer_id)
  );

revoke all on public.engineer_source_identities from anon, authenticated;
grant select on public.engineer_source_identities to authenticated;
grant all on public.engineer_source_identities to service_role;

create table if not exists public.engineer_pm_experience_snapshots (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  engineer_id uuid not null references public.engineers(id) on delete cascade,
  preventive_maintenance_id uuid not null references public.preventive_maintenance(id) on delete cascade,
  equipment_id uuid not null references public.equipment_assets(id) on delete cascade,
  confirmed_pm_count integer not null default 0 check (confirmed_pm_count >= 0),
  confirmation_line_count integer not null default 0 check (confirmation_line_count >= 0),
  final_confirmation_count integer not null default 0 check (final_confirmation_count >= 0),
  confirmation_text_count integer not null default 0 check (confirmation_text_count >= 0),
  experience_score smallint not null default 0 check (experience_score between 0 and 5),
  first_completed_at date,
  last_completed_at date,
  total_actual_work numeric not null default 0 check (total_actual_work >= 0),
  work_unit text,
  evidence_quality text not null default 'partial'
    check (evidence_quality in ('strong', 'standard', 'partial')),
  recency_status text not null default 'unknown'
    check (recency_status in ('current', 'aging', 'stale', 'unknown')),
  recency_factor numeric(5,4) not null default 0
    check (recency_factor >= 0 and recency_factor <= 1),
  source_systems text[] not null default '{}'::text[],
  source_updated_at timestamptz,
  calculated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint engineer_pm_experience_snapshot_key
    unique (site_id, engineer_id, preventive_maintenance_id),
  constraint engineer_pm_experience_snapshot_dates
    check (last_completed_at is null or first_completed_at is null or last_completed_at >= first_completed_at)
);

comment on table public.engineer_pm_experience_snapshots is
  'Derived, read-only PM execution evidence. One distinct PM work order contributes at most one experience event per engineer.';
comment on column public.engineer_pm_experience_snapshots.experience_score is
  'Capped 0-5 score based on distinct non-reversed PM work orders confirmed by the mapped engineer.';

create index if not exists engineer_pm_experience_engineer_idx
  on public.engineer_pm_experience_snapshots (site_id, engineer_id, experience_score desc);
create index if not exists engineer_pm_experience_equipment_idx
  on public.engineer_pm_experience_snapshots (site_id, equipment_id, experience_score desc);
create index if not exists engineer_pm_experience_pm_idx
  on public.engineer_pm_experience_snapshots (preventive_maintenance_id, engineer_id);

alter table public.engineer_pm_experience_snapshots enable row level security;
drop policy if exists engineer_pm_experience_snapshots_site_read on public.engineer_pm_experience_snapshots;
create policy engineer_pm_experience_snapshots_site_read
  on public.engineer_pm_experience_snapshots
  for select
  to authenticated
  using (
    private.vorta_rls_has_site_access(site_id, false)
    and private.vorta_rls_has_engineer_access(engineer_id)
    and private.vorta_rls_has_equipment_access(equipment_id, false)
  );

revoke all on public.engineer_pm_experience_snapshots from anon, authenticated;
grant select on public.engineer_pm_experience_snapshots to authenticated;
grant all on public.engineer_pm_experience_snapshots to service_role;

create or replace function private.vorta_refresh_engineer_pm_experience(
  p_site_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_snapshot_count integer := 0;
  v_mapped_confirmation_count integer := 0;
  v_unresolved_confirmation_count integer := 0;
begin
  -- Demo confirmation identities are deterministic and can be safely mapped
  -- when exactly one engineer at the same site has the recorded full name.
  with identity_candidates as (
    select
      wc.site_id,
      upper(btrim(wc.personnel_number)) as source_identity,
      lower(btrim(wc.confirmed_by)) as normalised_name,
      min(wc.posting_date) as first_seen_at
    from public.work_order_confirmations wc
    where wc.personnel_number is not null
      and length(btrim(wc.personnel_number)) > 0
      and wc.confirmed_by is not null
      and length(btrim(wc.confirmed_by)) > 0
      and wc.source_system in (
        'demo-expansion',
        'demo-realism',
        'demo-realism-thin',
        'SAP_DEMO',
        'VORTA_DEMO_EXECUTION'
      )
      and (p_site_id is null or wc.site_id = p_site_id)
    group by wc.site_id, upper(btrim(wc.personnel_number)), lower(btrim(wc.confirmed_by))
  ), exact_matches as (
    select
      candidate.site_id,
      candidate.source_identity,
      candidate.first_seen_at,
      (array_agg(engineer.id order by engineer.id))[1] as engineer_id
    from identity_candidates candidate
    join public.engineers engineer
      on engineer.site_id = candidate.site_id
     and lower(btrim(engineer.full_name)) = candidate.normalised_name
    group by candidate.site_id, candidate.source_identity, candidate.first_seen_at
    having count(engineer.id) = 1
  )
  insert into public.engineer_source_identities (
    site_id,
    engineer_id,
    source_system,
    identity_type,
    source_identity,
    mapping_status,
    confidence_score,
    mapping_basis,
    valid_from,
    verified_at,
    created_at,
    updated_at
  )
  select
    match.site_id,
    match.engineer_id,
    'SAP',
    'personnel_number',
    match.source_identity,
    'verified',
    1,
    'demo_exact_name_match',
    match.first_seen_at,
    now(),
    now(),
    now()
  from exact_matches match
  on conflict (site_id, source_system, identity_type, source_identity) do nothing;

  delete from public.engineer_pm_experience_snapshots snapshot
  where p_site_id is null or snapshot.site_id = p_site_id;

  with mapped_lines as (
    select
      confirmation.site_id,
      identity.engineer_id,
      work_order.preventive_maintenance_id,
      work_order.equipment_id,
      confirmation.work_order_id,
      coalesce(confirmation.posting_date, confirmation.confirmation_timestamp::date) as evidence_date,
      confirmation.final_confirmation,
      nullif(btrim(confirmation.confirmation_text), '') is not null as has_confirmation_text,
      greatest(coalesce(confirmation.actual_work, 0), 0) as actual_work,
      nullif(btrim(confirmation.work_unit), '') as work_unit,
      confirmation.source_system,
      confirmation.updated_at
    from public.work_order_confirmations confirmation
    join public.work_orders work_order
      on work_order.id = confirmation.work_order_id
     and work_order.site_id = confirmation.site_id
    join public.engineer_source_identities identity
      on identity.site_id = confirmation.site_id
     and identity.source_system = 'SAP'
     and identity.identity_type = 'personnel_number'
     and identity.source_identity = upper(btrim(confirmation.personnel_number))
     and identity.mapping_status = 'verified'
     and (
       identity.valid_from is null
       or coalesce(confirmation.posting_date, confirmation.confirmation_timestamp::date, current_date) >= identity.valid_from
     )
     and (
       identity.valid_until is null
       or coalesce(confirmation.posting_date, confirmation.confirmation_timestamp::date, current_date) <= identity.valid_until
     )
    where confirmation.reversal = false
      and confirmation.personnel_number is not null
      and work_order.preventive_maintenance_id is not null
      and work_order.equipment_id is not null
      and (p_site_id is null or confirmation.site_id = p_site_id)
  ), execution_events as (
    select
      line.site_id,
      line.engineer_id,
      line.preventive_maintenance_id,
      line.equipment_id,
      line.work_order_id,
      min(line.evidence_date) as evidence_date,
      count(*)::integer as confirmation_line_count,
      bool_or(line.final_confirmation) as has_final_confirmation,
      bool_or(line.has_confirmation_text) as has_confirmation_text,
      sum(line.actual_work) as actual_work,
      case
        when count(distinct line.work_unit) filter (where line.work_unit is not null) = 1
          then max(line.work_unit)
        else null
      end as work_unit,
      array_agg(distinct line.source_system order by line.source_system) as source_systems,
      max(line.updated_at) as source_updated_at
    from mapped_lines line
    group by
      line.site_id,
      line.engineer_id,
      line.preventive_maintenance_id,
      line.equipment_id,
      line.work_order_id
  ), aggregated as (
    select
      event.site_id,
      event.engineer_id,
      event.preventive_maintenance_id,
      event.equipment_id,
      count(*)::integer as confirmed_pm_count,
      sum(event.confirmation_line_count)::integer as confirmation_line_count,
      count(*) filter (where event.has_final_confirmation)::integer as final_confirmation_count,
      count(*) filter (where event.has_confirmation_text)::integer as confirmation_text_count,
      least(count(*), 5)::smallint as experience_score,
      min(event.evidence_date) as first_completed_at,
      max(event.evidence_date) as last_completed_at,
      sum(event.actual_work) as total_actual_work,
      case
        when count(distinct event.work_unit) filter (where event.work_unit is not null) = 1
          then max(event.work_unit)
        else null
      end as work_unit,
      case
        when count(*) filter (where event.has_final_confirmation) = count(*)
         and count(*) filter (where event.has_confirmation_text) = count(*) then 'strong'
        when count(*) filter (where event.has_final_confirmation) > 0 then 'standard'
        else 'partial'
      end as evidence_quality,
      case
        when max(event.evidence_date) is null then 'unknown'
        when max(event.evidence_date) >= current_date - interval '6 months' then 'current'
        when max(event.evidence_date) >= current_date - interval '12 months' then 'aging'
        else 'stale'
      end as recency_status,
      case
        when max(event.evidence_date) is null then 0
        when max(event.evidence_date) >= current_date - interval '6 months' then 1
        when max(event.evidence_date) >= current_date - interval '12 months' then 0.85
        when max(event.evidence_date) >= current_date - interval '24 months' then 0.65
        else 0.4
      end::numeric(5,4) as recency_factor,
      array(
        select distinct source_name
        from execution_events source_event
        cross join unnest(source_event.source_systems) source_name
        where source_event.site_id = event.site_id
          and source_event.engineer_id = event.engineer_id
          and source_event.preventive_maintenance_id = event.preventive_maintenance_id
          and source_event.equipment_id = event.equipment_id
        order by source_name
      ) as source_systems,
      max(event.source_updated_at) as source_updated_at
    from execution_events event
    group by
      event.site_id,
      event.engineer_id,
      event.preventive_maintenance_id,
      event.equipment_id
  )
  insert into public.engineer_pm_experience_snapshots (
    site_id,
    engineer_id,
    preventive_maintenance_id,
    equipment_id,
    confirmed_pm_count,
    confirmation_line_count,
    final_confirmation_count,
    confirmation_text_count,
    experience_score,
    first_completed_at,
    last_completed_at,
    total_actual_work,
    work_unit,
    evidence_quality,
    recency_status,
    recency_factor,
    source_systems,
    source_updated_at,
    calculated_at,
    created_at,
    updated_at
  )
  select
    aggregate.site_id,
    aggregate.engineer_id,
    aggregate.preventive_maintenance_id,
    aggregate.equipment_id,
    aggregate.confirmed_pm_count,
    aggregate.confirmation_line_count,
    aggregate.final_confirmation_count,
    aggregate.confirmation_text_count,
    aggregate.experience_score,
    aggregate.first_completed_at,
    aggregate.last_completed_at,
    aggregate.total_actual_work,
    aggregate.work_unit,
    aggregate.evidence_quality,
    aggregate.recency_status,
    aggregate.recency_factor,
    aggregate.source_systems,
    aggregate.source_updated_at,
    now(),
    now(),
    now()
  from aggregated aggregate;

  get diagnostics v_snapshot_count = row_count;

  select count(*)::integer
    into v_mapped_confirmation_count
  from public.work_order_confirmations confirmation
  join public.work_orders work_order
    on work_order.id = confirmation.work_order_id
   and work_order.site_id = confirmation.site_id
  join public.engineer_source_identities identity
    on identity.site_id = confirmation.site_id
   and identity.source_system = 'SAP'
   and identity.identity_type = 'personnel_number'
   and identity.source_identity = upper(btrim(confirmation.personnel_number))
   and identity.mapping_status = 'verified'
  where confirmation.reversal = false
    and confirmation.personnel_number is not null
    and work_order.preventive_maintenance_id is not null
    and (p_site_id is null or confirmation.site_id = p_site_id);

  select count(*)::integer
    into v_unresolved_confirmation_count
  from public.work_order_confirmations confirmation
  join public.work_orders work_order
    on work_order.id = confirmation.work_order_id
   and work_order.site_id = confirmation.site_id
  left join public.engineer_source_identities identity
    on identity.site_id = confirmation.site_id
   and identity.source_system = 'SAP'
   and identity.identity_type = 'personnel_number'
   and identity.source_identity = upper(btrim(confirmation.personnel_number))
   and identity.mapping_status = 'verified'
  where confirmation.reversal = false
    and confirmation.personnel_number is not null
    and work_order.preventive_maintenance_id is not null
    and identity.id is null
    and (p_site_id is null or confirmation.site_id = p_site_id);

  return jsonb_build_object(
    'siteId', p_site_id,
    'snapshotCount', v_snapshot_count,
    'mappedConfirmationCount', v_mapped_confirmation_count,
    'unresolvedConfirmationCount', v_unresolved_confirmation_count,
    'refreshedAt', now()
  );
end;
$$;

revoke all on function private.vorta_refresh_engineer_pm_experience(uuid)
  from public, anon, authenticated;
grant execute on function private.vorta_refresh_engineer_pm_experience(uuid)
  to service_role;

select private.vorta_refresh_engineer_pm_experience(null);
