begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create type public.app_role as enum ('manager', 'executor');
create type public.task_status as enum ('new', 'in_progress', 'review', 'accepted', 'revision');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  role public.app_role not null,
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  created_at timestamptz not null default now()
);
create table public.objects (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 160),
  address text not null check (length(btrim(address)) between 1 and 500),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  object_id uuid not null references public.objects(id) on delete restrict,
  title text not null check (length(btrim(title)) between 1 and 200),
  description text not null default '' check (length(description) <= 10000),
  assignee_id uuid not null references public.profiles(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  status public.task_status not null default 'new',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default clock_timestamp(),
  deleted_at timestamptz
);
create table public.task_status_history (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete restrict,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  from_status public.task_status,
  to_status public.task_status not null,
  comment text check (length(comment) <= 4000),
  created_at timestamptz not null default clock_timestamp(),
  check (
    (from_status is null and to_status = 'new') or
    (from_status is not null and (from_status, to_status) in (
      ('new', 'in_progress'), ('in_progress', 'review'),
      ('review', 'accepted'), ('review', 'revision'), ('revision', 'in_progress')
    ))
  ),
  check (to_status <> 'revision' or nullif(btrim(comment), '') is not null)
);

create index objects_active_idx on public.objects(created_at desc) where deleted_at is null;
create index tasks_object_idx on public.tasks(object_id) where deleted_at is null;
create index tasks_assignee_idx on public.tasks(assignee_id, created_at desc) where deleted_at is null;
create index tasks_author_idx on public.tasks(created_by);
create index history_task_idx on public.task_status_history(task_id, created_at);
create index history_actor_idx on public.task_status_history(actor_id);

create function private.is_manager() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'manager'
  );
$$;

create function private.require_manager() returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null or not private.is_manager() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
end;
$$;

alter table public.profiles enable row level security;
alter table public.objects enable row level security;
alter table public.tasks enable row level security;
alter table public.task_status_history enable row level security;

create policy tasks_read on public.tasks for select to authenticated
using (deleted_at is null and (
  (select private.is_manager()) or assignee_id = (select auth.uid())
));
create policy objects_read on public.objects for select to authenticated
using (deleted_at is null and (
  (select private.is_manager()) or exists (
    select 1 from public.tasks t
    where t.object_id = objects.id and t.assignee_id = (select auth.uid()) and t.deleted_at is null
  )
));
create policy history_read on public.task_status_history for select to authenticated
using (exists (select 1 from public.tasks t where t.id = task_status_history.task_id));
create policy profiles_read on public.profiles for select to authenticated
using (
  id = (select auth.uid()) or (select private.is_manager()) or exists (
    select 1 from public.tasks t
    where t.assignee_id = (select auth.uid()) and t.deleted_at is null and (
      t.created_by = profiles.id or exists (
        select 1 from public.task_status_history h
        where h.task_id = t.id and h.actor_id = profiles.id
      )
    )
  )
);

create function public.save_object(p_id uuid, p_name text, p_address text)
returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_id uuid;
begin
  perform private.require_manager();
  if p_id is null then
    insert into public.objects(name, address) values (btrim(p_name), btrim(p_address)) returning id into v_id;
  else
    update public.objects set name = btrim(p_name), address = btrim(p_address)
    where id = p_id and deleted_at is null returning id into v_id;
    if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  end if;
  return v_id;
end;
$$;

create function public.save_task(
  p_id uuid, p_object_id uuid, p_title text, p_description text,
  p_assignee_id uuid, p_expected_updated_at timestamptz default null
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare v_task public.tasks; v_id uuid;
begin
  perform private.require_manager();
  -- All mutations lock the parent before the task, including removal and transitions.
  perform 1 from public.objects where id = p_object_id and deleted_at is null for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  perform 1 from public.profiles where id = p_assignee_id and role = 'executor' for share;
  if not found then raise exception 'INVALID_ASSIGNEE' using errcode = '22023'; end if;
  if p_id is null then
    insert into public.tasks(object_id, title, description, assignee_id, created_by)
    values (p_object_id, btrim(p_title), coalesce(p_description, ''), p_assignee_id, auth.uid())
    returning id into v_id;
    insert into public.task_status_history(task_id, actor_id, from_status, to_status)
    values (v_id, auth.uid(), null, 'new');
  else
    select * into v_task from public.tasks where id = p_id and deleted_at is null for update;
    if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
    if v_task.object_id <> p_object_id then
      raise exception 'OBJECT_IMMUTABLE' using errcode = '22023';
    end if;
    if p_expected_updated_at is null or v_task.updated_at <> p_expected_updated_at then
      raise exception 'STALE_TASK' using errcode = '40001';
    end if;
    update public.tasks set title = btrim(p_title), description = coalesce(p_description, ''),
      assignee_id = p_assignee_id, updated_at = clock_timestamp()
    where id = p_id returning id into v_id;
  end if;
  return v_id;
end;
$$;

create function public.transition_task(
  p_task_id uuid, p_to_status public.task_status,
  p_expected_updated_at timestamptz, p_comment text default null
) returns uuid language plpgsql security definer set search_path = ''
as $$
declare
  v_task public.tasks; v_role public.app_role; v_object_id uuid;
  v_comment text := nullif(btrim(p_comment), '');
begin
  if auth.uid() is null then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select role into v_role from public.profiles where id = auth.uid();
  select object_id into v_object_id from public.tasks where id = p_task_id and deleted_at is null;
  perform 1 from public.objects where id = v_object_id and deleted_at is null for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  select * into v_task from public.tasks where id = p_task_id and deleted_at is null for update;
  if not found or v_role is null or
    (v_role <> 'manager' and v_task.assignee_id <> auth.uid()) then
    raise exception 'NOT_FOUND' using errcode = 'P0002';
  end if;
  if p_expected_updated_at is null or v_task.updated_at <> p_expected_updated_at then
    raise exception 'STALE_TASK' using errcode = '40001';
  end if;
  if p_to_status is null or not (
    (v_role = 'executor' and v_task.assignee_id = auth.uid() and (
      (v_task.status = 'new' and p_to_status = 'in_progress') or
      (v_task.status = 'in_progress' and p_to_status = 'review') or
      (v_task.status = 'revision' and p_to_status = 'in_progress')
    )) or
    (v_role = 'manager' and v_task.status = 'review' and p_to_status in ('accepted', 'revision'))
  ) then raise exception 'INVALID_TRANSITION' using errcode = '22023'; end if;
  if p_to_status = 'revision' and v_comment is null then
    raise exception 'COMMENT_REQUIRED' using errcode = '22023';
  end if;
  update public.tasks set status = p_to_status, updated_at = clock_timestamp() where id = p_task_id;
  insert into public.task_status_history(task_id, actor_id, from_status, to_status, comment)
  values (p_task_id, auth.uid(), v_task.status, p_to_status, v_comment);
  return p_task_id;
end;
$$;

create function public.delete_task(p_task_id uuid, p_expected_updated_at timestamptz)
returns void language plpgsql security definer set search_path = ''
as $$
declare v_task public.tasks; v_object_id uuid;
begin
  perform private.require_manager();
  select object_id into v_object_id from public.tasks where id = p_task_id and deleted_at is null;
  perform 1 from public.objects where id = v_object_id and deleted_at is null for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  select * into v_task from public.tasks where id = p_task_id and deleted_at is null for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if p_expected_updated_at is null or v_task.updated_at <> p_expected_updated_at then
    raise exception 'STALE_TASK' using errcode = '40001';
  end if;
  update public.tasks set deleted_at = clock_timestamp(), updated_at = clock_timestamp() where id = p_task_id;
end;
$$;

create function public.delete_object(p_object_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_manager();
  perform 1 from public.objects where id = p_object_id and deleted_at is null for update;
  if not found then raise exception 'NOT_FOUND' using errcode = 'P0002'; end if;
  if exists (select 1 from public.tasks where object_id = p_object_id and deleted_at is null and status <> 'accepted') then
    raise exception 'OBJECT_HAS_ACTIVE_TASKS' using errcode = '23514';
  end if;
  update public.tasks set deleted_at = clock_timestamp(), updated_at = clock_timestamp()
  where object_id = p_object_id and deleted_at is null;
  update public.objects set deleted_at = clock_timestamp() where id = p_object_id;
end;
$$;

-- API roles can read through RLS. All writes go through the checked RPCs above.
revoke all on public.profiles, public.objects, public.tasks, public.task_status_history from public, anon, authenticated;
grant select on public.profiles, public.objects, public.tasks, public.task_status_history to authenticated;
revoke all on function private.is_manager(), private.require_manager() from public, anon, authenticated;
grant execute on function private.is_manager() to authenticated;
revoke all on function public.save_object(uuid, text, text),
  public.save_task(uuid, uuid, text, text, uuid, timestamptz),
  public.transition_task(uuid, public.task_status, timestamptz, text),
  public.delete_task(uuid, timestamptz), public.delete_object(uuid)
from public, anon, authenticated;
grant execute on function public.save_object(uuid, text, text),
  public.save_task(uuid, uuid, text, text, uuid, timestamptz),
  public.transition_task(uuid, public.task_status, timestamptz, text),
  public.delete_task(uuid, timestamptz), public.delete_object(uuid) to authenticated;

commit;
