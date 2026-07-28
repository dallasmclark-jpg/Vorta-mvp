-- VOR-009: controlled shift handover workflow layered over read-only SAP evidence.

create table if not exists public.shift_handover_actions (
  id uuid primary key default gen_random_uuid(),
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  work_order_id uuid not null references public.work_orders(id) on delete cascade,
  window_start timestamptz not null,
  window_end timestamptz not null,
  outgoing_note text not null,
  next_action text not null,
  owner_name text not null,
  due_at timestamptz not null,
  status text not null default 'ready'
    check (status in ('ready', 'acknowledged', 'carried_forward', 'closed')),
  version integer not null default 1 check (version > 0),
  acknowledged_by uuid references public.profiles(id),
  acknowledged_at timestamptz,
  carry_forward_from uuid references public.shift_handover_actions(id),
  carried_forward_to uuid references public.shift_handover_actions(id),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_by uuid not null references public.profiles(id),
  updated_at timestamptz not null default now(),
  constraint shift_handover_window_valid check (window_end > window_start),
  constraint shift_handover_text_lengths check (
    char_length(outgoing_note) between 1 and 1200
    and char_length(next_action) between 1 and 800
    and char_length(owner_name) between 1 and 160
  ),
  unique (site_id, work_order_id, window_start, window_end)
);

create table if not exists public.shift_handover_action_events (
  id uuid primary key default gen_random_uuid(),
  action_id uuid not null references public.shift_handover_actions(id) on delete cascade,
  organisation_id uuid not null references public.organisations(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  event_type text not null
    check (event_type in ('created', 'updated', 'acknowledged', 'carried_forward', 'closed')),
  action_version integer not null check (action_version > 0),
  event_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists shift_handover_actions_site_window_idx
  on public.shift_handover_actions (site_id, window_start desc, window_end desc);
create index if not exists shift_handover_actions_work_order_idx
  on public.shift_handover_actions (work_order_id, updated_at desc);
create index if not exists shift_handover_action_events_action_idx
  on public.shift_handover_action_events (action_id, created_at desc);

alter table public.shift_handover_actions enable row level security;
alter table public.shift_handover_action_events enable row level security;

revoke all on public.shift_handover_actions from anon, authenticated;
revoke all on public.shift_handover_action_events from anon, authenticated;
grant select on public.shift_handover_actions to authenticated;
grant select on public.shift_handover_action_events to authenticated;

drop policy if exists shift_handover_actions_site_read on public.shift_handover_actions;
create policy shift_handover_actions_site_read
on public.shift_handover_actions
for select
to authenticated
using (private.vorta_rls_has_site_access(site_id, false));

drop policy if exists shift_handover_action_events_site_read on public.shift_handover_action_events;
create policy shift_handover_action_events_site_read
on public.shift_handover_action_events
for select
to authenticated
using (private.vorta_rls_has_site_access(site_id, false));

create or replace function private.vorta_shift_handover_can_manage(p_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, private
as $$
  select auth.uid() is not null
    and private.vorta_rls_has_site_access(p_site_id, false)
    and exists (
      select 1
      from public.user_site_access access_row
      where access_row.user_id = auth.uid()
        and access_row.site_id = p_site_id
        and access_row.active
        and lower(replace(coalesce(access_row.app_role, ''), '-', '_')) in (
          'vorta_admin',
          'site_admin',
          'maintenance_manager',
          'reliability_engineer'
        )
    );
$$;

revoke all on function private.vorta_shift_handover_can_manage(uuid) from public;

create or replace function private.vorta_shift_handover_action_json(p_action public.shift_handover_actions)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'id', p_action.id,
    'organisationId', p_action.organisation_id,
    'siteId', p_action.site_id,
    'workOrderId', p_action.work_order_id,
    'windowStart', p_action.window_start,
    'windowEnd', p_action.window_end,
    'outgoingNote', p_action.outgoing_note,
    'nextAction', p_action.next_action,
    'ownerName', p_action.owner_name,
    'dueAt', p_action.due_at,
    'status', p_action.status,
    'version', p_action.version,
    'acknowledgedBy', p_action.acknowledged_by,
    'acknowledgedAt', p_action.acknowledged_at,
    'carryForwardFrom', p_action.carry_forward_from,
    'carriedForwardTo', p_action.carried_forward_to,
    'createdBy', p_action.created_by,
    'createdAt', p_action.created_at,
    'updatedBy', p_action.updated_by,
    'updatedAt', p_action.updated_at,
    'events', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', event_row.id,
          'eventType', event_row.event_type,
          'actionVersion', event_row.action_version,
          'actorId', event_row.actor_id,
          'payload', event_row.event_payload,
          'createdAt', event_row.created_at
        ) order by event_row.created_at desc
      )
      from public.shift_handover_action_events event_row
      where event_row.action_id = p_action.id
    ), '[]'::jsonb)
  );
$$;

revoke all on function private.vorta_shift_handover_action_json(public.shift_handover_actions) from public;

create or replace function public.vorta_get_shift_handover_actions(
  p_site_id uuid,
  p_window_start timestamptz,
  p_window_end timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, private
as $$
begin
  if p_site_id is null or p_window_start is null or p_window_end is null or p_window_end <= p_window_start then
    raise exception 'A valid site and handover window are required.' using errcode = '22023';
  end if;
  if not private.vorta_rls_has_site_access(p_site_id, false) then
    raise exception 'Shift handover access denied.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(private.vorta_shift_handover_action_json(action_row) order by action_row.updated_at desc)
    from public.shift_handover_actions action_row
    where action_row.site_id = p_site_id
      and action_row.window_start = p_window_start
      and action_row.window_end = p_window_end
  ), '[]'::jsonb);
end;
$$;

create or replace function public.vorta_save_shift_handover_action(
  p_site_id uuid,
  p_work_order_id uuid,
  p_window_start timestamptz,
  p_window_end timestamptz,
  p_outgoing_note text,
  p_next_action text,
  p_owner_name text,
  p_due_at timestamptz,
  p_expected_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid := auth.uid();
  v_organisation_id uuid;
  v_existing public.shift_handover_actions;
  v_saved public.shift_handover_actions;
  v_event_type text;
begin
  if not private.vorta_shift_handover_can_manage(p_site_id) then
    raise exception 'Maintenance Manager handover access required.' using errcode = '42501';
  end if;
  if p_window_start is null or p_window_end is null or p_window_end <= p_window_start then
    raise exception 'A valid handover window is required.' using errcode = '22023';
  end if;
  if nullif(btrim(p_outgoing_note), '') is null
     or nullif(btrim(p_next_action), '') is null
     or nullif(btrim(p_owner_name), '') is null
     or p_due_at is null then
    raise exception 'Note, next action, owner and due time are required.' using errcode = '22023';
  end if;
  if char_length(p_outgoing_note) > 1200 or char_length(p_next_action) > 800 or char_length(p_owner_name) > 160 then
    raise exception 'Handover text exceeds the allowed length.' using errcode = '22023';
  end if;

  select site.organisation_id
  into v_organisation_id
  from public.sites site
  where site.id = p_site_id;
  if v_organisation_id is null then
    raise exception 'Active site could not be verified.' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.work_orders work_order
    where work_order.id = p_work_order_id
      and work_order.site_id = p_site_id
  ) then
    raise exception 'Work order is outside the active site.' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.work_orders work_order
    where work_order.id = p_work_order_id
      and work_order.site_id = p_site_id
      and (
        work_order.technical_completion_at is not null
        or work_order.business_completion_at is not null
        or upper(coalesce(work_order.status, '')) in ('COMPLETED', 'CLOSED', 'TECO', 'CLSD')
        or coalesce(work_order.system_status_codes, array[]::text[]) && array['TECO', 'CLSD']::text[]
      )
  ) then
    raise exception 'Completed SAP work orders cannot be reopened through handover.' using errcode = '55000';
  end if;

  select * into v_existing
  from public.shift_handover_actions action_row
  where action_row.site_id = p_site_id
    and action_row.work_order_id = p_work_order_id
    and action_row.window_start = p_window_start
    and action_row.window_end = p_window_end
  for update;

  if v_existing.id is null then
    if coalesce(p_expected_version, 0) <> 0 then
      raise exception 'Handover changed before this save. Refresh and retry.' using errcode = '40001';
    end if;

    insert into public.shift_handover_actions (
      organisation_id, site_id, work_order_id, window_start, window_end,
      outgoing_note, next_action, owner_name, due_at,
      status, version, created_by, updated_by
    ) values (
      v_organisation_id, p_site_id, p_work_order_id, p_window_start, p_window_end,
      btrim(p_outgoing_note), btrim(p_next_action), btrim(p_owner_name), p_due_at,
      'ready', 1, v_actor, v_actor
    ) returning * into v_saved;
    v_event_type := 'created';
  else
    if v_existing.version <> p_expected_version then
      raise exception 'Handover changed before this save. Refresh and retry.' using errcode = '40001';
    end if;
    if v_existing.status <> 'ready' then
      raise exception 'Acknowledged or carried-forward handovers are read-only.' using errcode = '55000';
    end if;

    update public.shift_handover_actions
    set outgoing_note = btrim(p_outgoing_note),
        next_action = btrim(p_next_action),
        owner_name = btrim(p_owner_name),
        due_at = p_due_at,
        version = version + 1,
        updated_by = v_actor,
        updated_at = now()
    where id = v_existing.id
    returning * into v_saved;
    v_event_type := 'updated';
  end if;

  insert into public.shift_handover_action_events (
    action_id, organisation_id, site_id, actor_id, event_type, action_version, event_payload
  ) values (
    v_saved.id, v_saved.organisation_id, v_saved.site_id, v_actor,
    v_event_type, v_saved.version,
    jsonb_build_object('ownerName', v_saved.owner_name, 'dueAt', v_saved.due_at)
  );

  return private.vorta_shift_handover_action_json(v_saved);
end;
$$;

create or replace function public.vorta_acknowledge_shift_handover_action(
  p_action_id uuid,
  p_expected_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid := auth.uid();
  v_action public.shift_handover_actions;
begin
  select * into v_action
  from public.shift_handover_actions action_row
  where action_row.id = p_action_id
  for update;

  if v_action.id is null or not private.vorta_shift_handover_can_manage(v_action.site_id) then
    raise exception 'Handover action could not be accessed.' using errcode = '42501';
  end if;
  if v_action.version <> p_expected_version then
    raise exception 'Handover changed before acknowledgement. Refresh and retry.' using errcode = '40001';
  end if;
  if v_action.status <> 'ready' then
    raise exception 'Only a ready handover can be acknowledged.' using errcode = '55000';
  end if;

  update public.shift_handover_actions
  set status = 'acknowledged',
      acknowledged_by = v_actor,
      acknowledged_at = now(),
      version = version + 1,
      updated_by = v_actor,
      updated_at = now()
  where id = v_action.id
  returning * into v_action;

  insert into public.shift_handover_action_events (
    action_id, organisation_id, site_id, actor_id, event_type, action_version
  ) values (
    v_action.id, v_action.organisation_id, v_action.site_id, v_actor, 'acknowledged', v_action.version
  );

  return private.vorta_shift_handover_action_json(v_action);
end;
$$;

create or replace function public.vorta_carry_forward_shift_handover_action(
  p_action_id uuid,
  p_expected_version integer,
  p_next_window_start timestamptz,
  p_next_window_end timestamptz,
  p_due_at timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, private
as $$
declare
  v_actor uuid := auth.uid();
  v_current public.shift_handover_actions;
  v_next public.shift_handover_actions;
begin
  select * into v_current
  from public.shift_handover_actions action_row
  where action_row.id = p_action_id
  for update;

  if v_current.id is null or not private.vorta_shift_handover_can_manage(v_current.site_id) then
    raise exception 'Handover action could not be accessed.' using errcode = '42501';
  end if;
  if v_current.version <> p_expected_version then
    raise exception 'Handover changed before carry-forward. Refresh and retry.' using errcode = '40001';
  end if;
  if v_current.status not in ('ready', 'acknowledged') then
    raise exception 'This handover can no longer be carried forward.' using errcode = '55000';
  end if;
  if p_next_window_start is null or p_next_window_end is null
     or p_next_window_end <= p_next_window_start
     or p_next_window_start < v_current.window_end then
    raise exception 'The next handover window is invalid.' using errcode = '22023';
  end if;
  if p_due_at is null then
    raise exception 'A due time is required for carried-forward work.' using errcode = '22023';
  end if;
  if exists (
    select 1
    from public.shift_handover_actions action_row
    where action_row.site_id = v_current.site_id
      and action_row.work_order_id = v_current.work_order_id
      and action_row.window_start = p_next_window_start
      and action_row.window_end = p_next_window_end
  ) then
    raise exception 'This work order is already present in the next handover window.' using errcode = '23505';
  end if;

  insert into public.shift_handover_actions (
    organisation_id, site_id, work_order_id, window_start, window_end,
    outgoing_note, next_action, owner_name, due_at,
    status, version, carry_forward_from, created_by, updated_by
  ) values (
    v_current.organisation_id, v_current.site_id, v_current.work_order_id,
    p_next_window_start, p_next_window_end,
    v_current.outgoing_note, v_current.next_action, v_current.owner_name, p_due_at,
    'ready', 1, v_current.id, v_actor, v_actor
  ) returning * into v_next;

  update public.shift_handover_actions
  set status = 'carried_forward',
      carried_forward_to = v_next.id,
      version = version + 1,
      updated_by = v_actor,
      updated_at = now()
  where id = v_current.id
  returning * into v_current;

  insert into public.shift_handover_action_events (
    action_id, organisation_id, site_id, actor_id, event_type, action_version, event_payload
  ) values
    (
      v_current.id, v_current.organisation_id, v_current.site_id, v_actor,
      'carried_forward', v_current.version,
      jsonb_build_object('carriedForwardTo', v_next.id, 'nextWindowStart', p_next_window_start)
    ),
    (
      v_next.id, v_next.organisation_id, v_next.site_id, v_actor,
      'created', v_next.version,
      jsonb_build_object('carryForwardFrom', v_current.id)
    );

  return jsonb_build_object(
    'current', private.vorta_shift_handover_action_json(v_current),
    'carriedForward', private.vorta_shift_handover_action_json(v_next)
  );
end;
$$;

revoke all on function public.vorta_get_shift_handover_actions(uuid, timestamptz, timestamptz) from public;
revoke all on function public.vorta_save_shift_handover_action(uuid, uuid, timestamptz, timestamptz, text, text, text, timestamptz, integer) from public;
revoke all on function public.vorta_acknowledge_shift_handover_action(uuid, integer) from public;
revoke all on function public.vorta_carry_forward_shift_handover_action(uuid, integer, timestamptz, timestamptz, timestamptz) from public;

grant execute on function public.vorta_get_shift_handover_actions(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.vorta_save_shift_handover_action(uuid, uuid, timestamptz, timestamptz, text, text, text, timestamptz, integer) to authenticated;
grant execute on function public.vorta_acknowledge_shift_handover_action(uuid, integer) to authenticated;
grant execute on function public.vorta_carry_forward_shift_handover_action(uuid, integer, timestamptz, timestamptz, timestamptz) to authenticated;
