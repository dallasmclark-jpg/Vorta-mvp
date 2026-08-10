begin;

create table if not exists public.vorta_entity_images (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites(id) on delete cascade,
  entity_type text not null check (entity_type in ('equipment', 'spare')),
  equipment_id uuid references public.equipment_assets(id) on delete cascade,
  component_id uuid references public.equipment_components(id) on delete cascade,
  storage_bucket text not null default 'vorta-media' check (storage_bucket = 'vorta-media'),
  storage_path text not null unique,
  source_type text not null default 'site_photo' check (
    source_type in ('site_photo', 'oem_cached', 'manufacturer', 'supplier')
  ),
  source_url text,
  attribution text,
  alt_text text,
  is_primary boolean not null default true,
  uploaded_by uuid default auth.uid(),
  original_filename text,
  content_type text check (
    content_type is null or content_type in ('image/jpeg', 'image/png', 'image/webp')
  ),
  file_size_bytes bigint check (
    file_size_bytes is null or (file_size_bytes > 0 and file_size_bytes <= 5242880)
  ),
  created_at timestamptz not null default now(),
  constraint vorta_entity_images_entity_target check (
    (entity_type = 'equipment' and equipment_id is not null and component_id is null)
    or
    (entity_type = 'spare' and component_id is not null and equipment_id is null)
  )
);

create index if not exists vorta_entity_images_equipment_lookup_idx
  on public.vorta_entity_images (site_id, equipment_id, is_primary desc, created_at desc)
  where entity_type = 'equipment';

create index if not exists vorta_entity_images_spare_lookup_idx
  on public.vorta_entity_images (site_id, component_id, is_primary desc, created_at desc)
  where entity_type = 'spare';

alter table public.vorta_entity_images enable row level security;

revoke all on public.vorta_entity_images from anon, authenticated;
grant select, insert on public.vorta_entity_images to authenticated;

create policy "vorta_entity_images_site_read"
  on public.vorta_entity_images
  for select
  to authenticated
  using (private.vorta_rls_has_site_access(site_id, false));

create policy "vorta_entity_images_site_insert"
  on public.vorta_entity_images
  for insert
  to authenticated
  with check (
    private.vorta_rls_has_site_access(vorta_entity_images.site_id, false)
    and private.vorta_rls_current_role() in ('maintenance_manager', 'site_admin', 'vorta_admin')
    and vorta_entity_images.source_type = 'site_photo'
    and vorta_entity_images.uploaded_by = auth.uid()
    and vorta_entity_images.storage_bucket = 'vorta-media'
    and split_part(vorta_entity_images.storage_path, '/', 1) = vorta_entity_images.site_id::text
    and split_part(vorta_entity_images.storage_path, '/', 2) = vorta_entity_images.entity_type
    and (
      (
        vorta_entity_images.entity_type = 'equipment'
        and split_part(vorta_entity_images.storage_path, '/', 3) = vorta_entity_images.equipment_id::text
        and exists (
          select 1
          from public.equipment_assets ea
          where ea.id = vorta_entity_images.equipment_id
            and ea.site_id = vorta_entity_images.site_id
        )
      )
      or
      (
        vorta_entity_images.entity_type = 'spare'
        and split_part(vorta_entity_images.storage_path, '/', 3) = vorta_entity_images.component_id::text
        and exists (
          select 1
          from public.equipment_components ec
          where ec.id = vorta_entity_images.component_id
            and ec.site_id = vorta_entity_images.site_id
        )
      )
    )
  );

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'vorta-media',
  'vorta-media',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "vorta_media_site_read" on storage.objects;
drop policy if exists "vorta_media_site_insert" on storage.objects;
drop policy if exists "vorta_media_owner_delete" on storage.objects;

create policy "vorta_media_site_read"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'vorta-media'
    and case
      when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then private.vorta_rls_has_site_access(split_part(name, '/', 1)::uuid, false)
      else false
    end
  );

create policy "vorta_media_site_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'vorta-media'
    and private.vorta_rls_current_role() in ('maintenance_manager', 'site_admin', 'vorta_admin')
    and case
      when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then private.vorta_rls_has_site_access(split_part(name, '/', 1)::uuid, false)
      else false
    end
    and split_part(name, '/', 2) in ('equipment', 'spare')
    and case
      when split_part(name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and split_part(name, '/', 2) = 'equipment'
        then exists (
          select 1
          from public.equipment_assets ea
          where ea.id = split_part(objects.name, '/', 3)::uuid
            and ea.site_id = split_part(objects.name, '/', 1)::uuid
        )
      when split_part(name, '/', 3) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        and split_part(name, '/', 2) = 'spare'
        then exists (
          select 1
          from public.equipment_components ec
          where ec.id = split_part(objects.name, '/', 3)::uuid
            and ec.site_id = split_part(objects.name, '/', 1)::uuid
        )
      else false
    end
  );

create policy "vorta_media_owner_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'vorta-media'
    and owner_id = auth.uid()::text
    and private.vorta_rls_current_role() in ('maintenance_manager', 'site_admin', 'vorta_admin')
    and case
      when split_part(name, '/', 1) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
        then private.vorta_rls_has_site_access(split_part(name, '/', 1)::uuid, false)
      else false
    end
  );

commit;
