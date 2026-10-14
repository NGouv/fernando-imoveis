-- Initial Supabase schema for property listings and their images.
-- Apply once to a Supabase project with the Storage schema available.

create table public.admin_users (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(btrim(title)) > 0),
  description text not null default '',
  property_type text not null
    check (property_type in ('house', 'apartment', 'land', 'commercial', 'other')),
  purpose text not null
    check (purpose in ('sale', 'rent', 'assignment')),
  price numeric(14, 2) not null check (price >= 0),
  city text not null check (length(btrim(city)) > 0),
  state text not null check (state ~ '^[A-Z]{2}$'),
  neighborhood text,
  built_area numeric(10, 2) check (built_area > 0),
  land_area numeric(10, 2) check (land_area > 0),
  bedrooms smallint check (bedrooms >= 0),
  suites smallint check (suites >= 0),
  bathrooms smallint check (bathrooms >= 0),
  features text[] not null default '{}',
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.property_images (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null
    references public.properties (id) on delete restrict,
  storage_path text not null unique,
  alt_text text not null default '',
  sort_order integer not null default 0 check (sort_order >= 0),
  is_cover boolean not null default false,
  created_at timestamptz not null default now(),
  constraint property_images_storage_path_matches_property
    check (storage_path ~ ('^' || property_id::text || '/[^/]+$'))
);

create index properties_public_list_idx
  on public.properties (status, created_at desc);
create index property_images_property_order_idx
  on public.property_images (property_id, sort_order, created_at);
create unique index property_images_one_cover_per_property_idx
  on public.property_images (property_id)
  where is_cover;

create or replace function public.serialize_property_image_changes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_catalog.pg_advisory_xact_lock(1414677318, 1);
  return null;
end;
$$;

create trigger property_images_serialize_changes
before insert or update or delete on public.property_images
for each statement
execute function public.serialize_property_image_changes();

create or replace function public.set_property_image_cover()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_cover then
    update public.property_images
    set is_cover = false
    where property_id = new.property_id
      and is_cover
      and id is distinct from new.id;
  end if;

  return new;
end;
$$;

create trigger property_images_set_cover
before insert or update on public.property_images
for each row
when (new.is_cover)
execute function public.set_property_image_cover();

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger properties_set_updated_at
before update on public.properties
for each row execute function public.set_updated_at();

-- This function is intentionally read-only: it exposes only the current
-- caller's authorization state and avoids RLS recursion on admin_users.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke all on function public.set_property_image_cover() from public, anon, authenticated;
revoke all on function public.serialize_property_image_changes() from public, anon, authenticated;

alter table public.admin_users enable row level security;
alter table public.properties enable row level security;
alter table public.property_images enable row level security;

-- Authorization is provisioned only by a trusted project operator through
-- the Supabase Dashboard SQL Editor (see ../README.md). App users get no
-- privileges or RLS policies on this table and cannot self-promote.
revoke all on table public.admin_users from public, anon, authenticated;

grant select on table public.properties, public.property_images to anon, authenticated;
grant insert, update, delete on table public.properties, public.property_images to authenticated;

create policy properties_read_published_or_admin
  on public.properties
  for select
  to anon, authenticated
  using (status = 'published' or (select public.is_admin()));

create policy properties_admin_insert
  on public.properties
  for insert
  to authenticated
  with check ((select public.is_admin()));

create policy properties_admin_update
  on public.properties
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy properties_admin_delete
  on public.properties
  for delete
  to authenticated
  using ((select public.is_admin()));

create policy property_images_read_published_or_admin
  on public.property_images
  for select
  to anon, authenticated
  using (
    (select public.is_admin())
    or exists (
      select 1
      from public.properties as p
      where p.id = property_id
        and p.status = 'published'
    )
  );

create policy property_images_admin_insert
  on public.property_images
  for insert
  to authenticated
  with check ((select public.is_admin()));

create policy property_images_admin_update
  on public.property_images
  for update
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy property_images_admin_delete
  on public.property_images
  for delete
  to authenticated
  using ((select public.is_admin()));

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'property-images',
  'property-images',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
set name = excluded.name,
    public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy property_images_storage_read_published_or_admin
  on storage.objects
  for select
  to anon, authenticated
  using (
    bucket_id = 'property-images'
    and (
      (select public.is_admin())
      or exists (
        select 1
        from public.properties as p
        where p.id::text = (storage.foldername(name))[1]
          and p.status = 'published'
      )
    )
  );

create policy property_images_storage_admin_insert
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'property-images'
    and (select public.is_admin())
    and cardinality(storage.foldername(name)) = 1
    and exists (
      select 1
      from public.properties as p
      where p.id::text = (storage.foldername(name))[1]
    )
  );

create policy property_images_storage_admin_update
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'property-images'
    and (select public.is_admin())
    and cardinality(storage.foldername(name)) = 1
    and exists (
      select 1
      from public.properties as p
      where p.id::text = (storage.foldername(name))[1]
    )
  )
  with check (
    bucket_id = 'property-images'
    and (select public.is_admin())
    and cardinality(storage.foldername(name)) = 1
    and exists (
      select 1
      from public.properties as p
      where p.id::text = (storage.foldername(name))[1]
    )
  );

  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'property-images'
    and (select public.is_admin())
    and cardinality(storage.foldername(name)) = 1
    and (storage.foldername(name))[1] ~
      '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

-- Storage objects cannot be removed by a Postgres foreign-key cascade.
-- The application must first remove their paths with the Storage API as an
-- authorized admin, then delete property_images rows, then delete the
-- property. The RESTRICT foreign key prevents deleting a property while its
-- image metadata is still present. The delete policy also allows an admin to
-- clean up an orphaned object after its property row has already been removed.
