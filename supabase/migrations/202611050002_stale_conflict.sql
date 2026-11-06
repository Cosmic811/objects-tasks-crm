-- Stale application versions are HTTP conflicts, not database serialization failures.
begin;

create or replace function public.save_task(
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
      raise exception 'STALE_TASK' using errcode = 'PT409';
    end if;
    update public.tasks set title = btrim(p_title), description = coalesce(p_description, ''),
      assignee_id = p_assignee_id, updated_at = clock_timestamp()
    where id = p_id returning id into v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.transition_task(
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
    raise exception 'STALE_TASK' using errcode = 'PT409';
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

create or replace function public.delete_task(p_task_id uuid, p_expected_updated_at timestamptz)
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
    raise exception 'STALE_TASK' using errcode = 'PT409';
  end if;
  update public.tasks set deleted_at = clock_timestamp(), updated_at = clock_timestamp() where id = p_task_id;
end;
$$;

commit;
