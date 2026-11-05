-- Run in SQL Editor after manually creating the three confirmed Auth users.
-- Passwords belong to Supabase Auth and are never stored in this script.
begin;
do $$
declare
  manager_id uuid; executor1_id uuid; executor2_id uuid;
  north_id uuid; office_id uuid; storage_id uuid; task_id uuid;
begin
  select id into manager_id from auth.users where email = 'manager@crm.example';
  select id into executor1_id from auth.users where email = 'executor1@crm.example';
  select id into executor2_id from auth.users where email = 'executor2@crm.example';
  if manager_id is null or executor1_id is null or executor2_id is null then
    raise exception 'Create manager@crm.example, executor1@crm.example and executor2@crm.example in Authentication first.';
  end if;
  if exists(select 1 from public.objects where name = 'ЖК Северный' and deleted_at is null) then
    raise exception 'Demo objects already exist. Seed was not repeated.';
  end if;
  insert into public.profiles(id, role, display_name) values
    (manager_id, 'manager', 'Алексей Соколов'),
    (executor1_id, 'executor', 'Иван Петров'),
    (executor2_id, 'executor', 'Дмитрий Орлов')
  on conflict (id) do nothing;
  if not exists(select 1 from public.profiles where id=manager_id and role='manager')
    or not exists(select 1 from public.profiles where id=executor1_id and role='executor')
    or not exists(select 1 from public.profiles where id=executor2_id and role='executor') then
    raise exception 'Existing profile roles do not match demo accounts.';
  end if;
  perform set_config('request.jwt.claim.sub', manager_id::text, true);
  north_id := public.save_object(null, 'ЖК Северный', 'Минск, ул. Строителей, 12');
  office_id := public.save_object(null, 'Офисный центр', 'Минск, пр. Центральный, 8');
  storage_id := public.save_object(null, 'Складской комплекс', 'Минск, ул. Промышленная, 24');

  perform public.save_task(null, north_id, 'Проверить монтаж электропроводки',
    'Проверить крепления кабеля и маркировку линий в электрощите первого этажа. Сверить результат с рабочей схемой.', executor1_id);
  task_id := public.save_task(null, north_id, 'Согласовать поставку материалов',
    'Сверить спецификацию с поставщиком и подтвердить количество кабельных лотков для второго этажа.', executor2_id);
  perform set_config('request.jwt.claim.sub', executor2_id::text, true);
  perform public.transition_task(task_id, 'in_progress', (select updated_at from public.tasks where id=task_id));

  perform set_config('request.jwt.claim.sub', manager_id::text, true);
  task_id := public.save_task(null, office_id, 'Проверить перегородки на втором этаже',
    'Проверить привязки перегородок к осям и размеры дверных проёмов. Сообщить о расхождениях до начала отделки.', executor1_id);
  perform set_config('request.jwt.claim.sub', executor1_id::text, true);
  perform public.transition_task(task_id, 'in_progress', (select updated_at from public.tasks where id=task_id));
  perform public.transition_task(task_id, 'review', (select updated_at from public.tasks where id=task_id));

  perform set_config('request.jwt.claim.sub', manager_id::text, true);
  task_id := public.save_task(null, office_id, 'Проверить подготовку стен к окраске',
    'Проверить качество шлифовки и грунтования стен в переговорной. Особое внимание уделить участкам у окон.', executor2_id);
  perform set_config('request.jwt.claim.sub', executor2_id::text, true);
  perform public.transition_task(task_id, 'in_progress', (select updated_at from public.tasks where id=task_id));
  perform public.transition_task(task_id, 'review', (select updated_at from public.tasks where id=task_id));
  perform set_config('request.jwt.claim.sub', manager_id::text, true);
  perform public.transition_task(task_id, 'revision', (select updated_at from public.tasks where id=task_id),
    'У окна остались неровности. Повторно отшлифовать участок и проверить при боковом освещении.');

  task_id := public.save_task(null, storage_id, 'Проверить вентиляцию складской зоны',
    'Проверить крепления воздуховодов, доступ к сервисным люкам и наличие маркировки оборудования.', executor1_id);
  perform set_config('request.jwt.claim.sub', executor1_id::text, true);
  perform public.transition_task(task_id, 'in_progress', (select updated_at from public.tasks where id=task_id));
  perform public.transition_task(task_id, 'review', (select updated_at from public.tasks where id=task_id));
  perform set_config('request.jwt.claim.sub', manager_id::text, true);
  perform public.transition_task(task_id, 'accepted', (select updated_at from public.tasks where id=task_id));
end;
$$;
commit;
