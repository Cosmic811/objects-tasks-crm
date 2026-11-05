import { after, afterEach, before, beforeEach, test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'

const db = new PGlite()
const manager = '10000000-0000-4000-8000-000000000001'
const manager2 = '10000000-0000-4000-8000-000000000002'
const executor1 = '20000000-0000-4000-8000-000000000001'
const executor2 = '20000000-0000-4000-8000-000000000002'
const unprovisioned = '30000000-0000-4000-8000-000000000001'
let object1, object2, task1, task2

// Only auth.uid() and auth.users are stand-ins. Policies, roles, grants and RPCs
// run in a real embedded PostgreSQL engine, not a JavaScript permission model.
before(async () => {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users(id uuid primary key, email text);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    grant usage on schema public, auth to anon, authenticated;
    grant execute on function auth.uid() to anon, authenticated;
  `)
  await db.exec(await readFile(new URL('../supabase/migrations/202611050001_crm.sql', import.meta.url), 'utf8'))
})
after(() => db.close())
beforeEach(async () => {
  await db.exec('begin; reset role;')
  for (const [id, role, name] of [
    [manager, 'manager', 'Алексей Соколов'], [manager2, 'manager', 'Мария Волкова'],
    [executor1, 'executor', 'Иван Петров'], [executor2, 'executor', 'Дмитрий Орлов'],
  ]) {
    await db.query('insert into auth.users(id) values ($1)', [id])
    await db.query('insert into public.profiles(id,role,display_name) values ($1,$2,$3)', [id, role, name])
  }
  await db.query('insert into auth.users(id) values ($1)', [unprovisioned])
  object1 = (await as(manager, "select public.save_object(null, 'ЖК Северный', 'ул. Строителей, 12') id")).rows[0].id
  object2 = (await as(manager, "select public.save_object(null, 'Офисный центр', 'пр. Центральный, 8') id")).rows[0].id
  task1 = (await as(manager, "select public.save_task(null,$1,'Проверить электропроводку','Проверить щиты и линии',$2) id", [object1, executor1])).rows[0].id
  task2 = (await as(manager2, "select public.save_task(null,$1,'Согласовать поставку материалов','Проверить спецификацию',$2) id", [object2, executor2])).rows[0].id
})
afterEach(async () => { await db.exec('rollback; reset role;') })

async function as(actor, sql, args = []) {
  await db.exec('reset role;')
  await db.query("select set_config('request.jwt.claim.sub',$1,true)", [actor ?? ''])
  await db.exec(`set local role ${actor ? 'authenticated' : 'anon'}; savepoint operation;`)
  try {
    const result = await db.query(sql, args)
    await db.exec('release savepoint operation')
    return result
  } catch (error) {
    await db.exec('rollback to savepoint operation; release savepoint operation;')
    throw error
  }
}
async function version(id, user = executor1) {
  return (await as(user, 'select updated_at::text as version from public.tasks where id=$1', [id])).rows[0]?.version
}
async function move(id, user, to, comment = null, expected) {
  return as(user, 'select public.transition_task($1,$2,$3,$4)', [id, to, expected ?? await version(id, user), comment])
}
async function denied(promise, pattern = /permission denied|FORBIDDEN|NOT_FOUND|INVALID_TRANSITION/i) {
  await assert.rejects(promise, pattern)
}
async function prepareReview() { await move(task1, executor1, 'in_progress'); await move(task1, executor1, 'review') }

test('manager reads every object and task; multiple managers are supported', async () => {
  assert.equal((await as(manager2, 'select * from public.objects')).rows.length, 2)
  assert.equal((await as(manager2, 'select * from public.tasks')).rows.length, 2)
})
test('executor cannot read another executor task, even by UUID', async () => {
  assert.equal((await as(executor1, 'select * from public.tasks where id=$1', [task2])).rows.length, 0)
  assert.deepEqual((await as(executor1, 'select id from public.tasks')).rows.map(r => r.id), [task1])
})
test('executor can read only objects containing own active assignments', async () => {
  assert.deepEqual((await as(executor1, 'select id from public.objects')).rows.map(r => r.id), [object1])
})
test('executor cannot directly update own or foreign task', async () => {
  await denied(as(executor1, "update public.tasks set title='Подмена' where id=$1", [task2]))
  await denied(as(executor1, "update public.tasks set title='Подмена' where id=$1", [task1]))
})
test('executor cannot create an object directly or through RPC', async () => {
  await denied(as(executor1, "insert into public.objects(name,address) values ('Чужой','Адрес')"))
  await denied(as(executor1, "select public.save_object(null,'Чужой','Адрес')"))
})
test('executor cannot edit/delete objects or create/delete tasks through RPC', async () => {
  await denied(as(executor1, "select public.save_object($1,'Подмена','Адрес')", [object1]))
  await denied(as(executor1, 'select public.delete_object($1)', [object1]))
  await denied(as(executor1, "select public.save_task(null,$1,'Подмена','',$2)", [object1, executor1]))
  await denied(as(executor1, 'select public.delete_task($1,$2)', [task1, await version(task1)]))
})
test('executor cannot reassign a foreign task', async () => {
  await denied(as(executor1, 'update public.tasks set assignee_id=$1 where id=$2', [executor1, task2]))
})
test('executor cannot promote self or insert a forged manager profile', async () => {
  await denied(as(executor1, "update public.profiles set role='manager' where id=$1", [executor1]))
  await denied(as(unprovisioned, "insert into public.profiles(id,role,display_name) values ($1,'manager','Подмена')", [unprovisioned]))
})
test('direct status patch is forbidden for both roles', async () => {
  await denied(as(executor1, "update public.tasks set status='accepted' where id=$1", [task1]))
  await denied(as(manager, "update public.tasks set status='accepted' where id=$1", [task1]))
})
test('executor cannot call a forbidden transition or mutate foreign tasks via RPC', async () => {
  await denied(move(task1, executor1, 'accepted'))
  await denied(as(executor1, "select public.transition_task($1,'in_progress',now(),null)", [task2]))
})
test('manager cannot start a task on behalf of executor', async () => { await denied(move(task1, manager, 'in_progress')) })
test('return to revision requires a nonblank comment; failed transition is atomic', async () => {
  await prepareReview()
  for (const comment of [null, '', '   ']) await denied(move(task1, manager, 'revision', comment), /COMMENT_REQUIRED/)
  assert.equal((await as(manager, 'select status from public.tasks where id=$1', [task1])).rows[0].status, 'review')
  assert.equal((await as(manager, 'select * from public.task_status_history where task_id=$1', [task1])).rows.length, 3)
})
test('neither role can edit, delete or forge history', async () => {
  for (const user of [executor1, manager]) {
    await denied(as(user, "update public.task_status_history set comment='Подмена' where task_id=$1", [task1]))
    await denied(as(user, 'delete from public.task_status_history where task_id=$1', [task1]))
    await denied(as(user, "insert into public.task_status_history(task_id,actor_id,to_status) values ($1,$2,'new')", [task1, manager]))
  }
})
test('foreign task history is invisible', async () => {
  assert.equal((await as(executor1, 'select * from public.task_status_history where task_id=$1', [task2])).rows.length, 0)
})
test('anonymous client has no table or RPC access', async () => {
  for (const table of ['objects', 'tasks', 'profiles', 'task_status_history']) await denied(as(null, `select * from public.${table}`))
  await denied(as(null, "select public.save_object(null,'Объект','Адрес')"))
})
test('user without profile is denied protected data and manager functions', async () => {
  assert.equal((await as(unprovisioned, 'select * from public.tasks')).rows.length, 0)
  await denied(as(unprovisioned, "select public.save_object(null,'Объект','Адрес')"))
})
test('complete revision cycle records real actors, comment, timestamps and all statuses', async () => {
  await prepareReview()
  await move(task1, manager2, 'revision', 'Закрепить кабель в щите')
  await move(task1, executor1, 'in_progress')
  await move(task1, executor1, 'review')
  await move(task1, manager, 'accepted')
  const history = (await as(executor1, 'select * from public.task_status_history where task_id=$1 order by created_at', [task1])).rows
  assert.deepEqual(history.map(h => h.to_status), ['new', 'in_progress', 'review', 'revision', 'in_progress', 'review', 'accepted'])
  assert.deepEqual(history.map(h => h.actor_id), [manager, executor1, executor1, manager2, executor1, executor1, manager])
  assert.equal(history[3].comment, 'Закрепить кабель в щите')
  assert.ok(history.every(h => Number.isFinite(new Date(h.created_at).getTime())))
  assert.equal(history[0].from_status, null)
  assert.ok(history.slice(1).every((h,i) => h.from_status === history[i].to_status))
})
test('manager can edit title and assignee without overwriting workflow', async () => {
  const updated = await version(task1, manager)
  await as(manager, "select public.save_task($1,$2,'Проверить монтаж','Подробное описание',$3,$4)", [task1, object1, executor2, updated])
  assert.equal((await as(executor1, 'select * from public.tasks where id=$1', [task1])).rows.length, 0)
  const task = (await as(executor2, 'select * from public.tasks where id=$1', [task1])).rows[0]
  assert.equal(task.status, 'new')
  assert.equal(task.created_by, manager)
  assert.equal(task.title, 'Проверить монтаж')
})
test('stale edit, stale transition and stale delete are rejected', async () => {
  const updated = await version(task1)
  await move(task1, executor1, 'in_progress')
  await denied(move(task1, executor1, 'review', null, updated), /STALE_TASK/)
  await denied(as(manager, "select public.save_task($1,$2,'Проверить','',$3,$4)", [task1, object1, executor1, updated]), /STALE_TASK/)
  await denied(as(manager, 'select public.delete_task($1,$2)', [task1, updated]), /STALE_TASK/)
})
test('manager cannot assign a task to another manager', async () => {
  await denied(as(manager, "select public.save_task(null,$1,'Проверить монтаж','',$2)", [object1, manager2]), /INVALID_ASSIGNEE/)
})
test('soft deletion hides task from both roles and preserves audit rows', async () => {
  await as(manager, 'select public.delete_task($1,$2)', [task1, await version(task1)])
  assert.equal((await as(manager, 'select * from public.tasks where id=$1', [task1])).rows.length, 0)
  assert.equal((await as(executor1, 'select * from public.objects where id=$1', [object1])).rows.length, 0)
  await db.exec('reset role')
  assert.equal((await db.query('select * from public.task_status_history where task_id=$1', [task1])).rows.length, 1)
  assert.ok((await db.query('select deleted_at from public.tasks where id=$1', [task1])).rows[0].deleted_at)
})
test('object with active tasks cannot be deleted', async () => { await denied(as(manager, 'select public.delete_object($1)', [object1]), /OBJECT_HAS_ACTIVE_TASKS/) })
test('object deletion cascades soft deletion only and preserves history', async () => {
  await prepareReview(); await move(task1, manager, 'accepted')
  await as(manager, 'select public.delete_object($1)', [object1])
  assert.equal((await as(manager, 'select * from public.tasks where id=$1', [task1])).rows.length, 0)
  await db.exec('reset role')
  assert.equal((await db.query('select * from public.task_status_history where task_id=$1', [task1])).rows.length, 4)
})
test('RPCs cannot create tasks on deleted objects', async () => {
  const empty = (await as(manager, "select public.save_object(null,'Склад','Промышленная, 3') id")).rows[0].id
  await as(manager, 'select public.delete_object($1)', [empty])
  await denied(as(manager, "select public.save_task(null,$1,'Проверить вентиляцию','',$2)", [empty, executor1]))
})
test('blank fields and excessive comments roll back status and history', async () => {
  await denied(as(manager, "select public.save_object(null,'   ','Адрес')"), /check constraint/)
  await prepareReview()
  await denied(move(task1, manager, 'revision', 'x'.repeat(4001)), /check constraint/)
  assert.equal((await as(manager, 'select status from public.tasks where id=$1', [task1])).rows[0].status, 'review')
})
test('all security definer functions pin search_path and deny anonymous execution', async () => {
  await db.exec('reset role')
  const functions = (await db.query("select n.nspname,p.proname,p.proconfig,p.oid from pg_proc p join pg_namespace n on p.pronamespace=n.oid where n.nspname in ('private','public') and p.prosecdef")).rows
  assert.equal(functions.length, 7)
  for (const fn of functions) {
    assert.ok(fn.proconfig.some(c => c.startsWith('search_path=')))
    assert.equal((await db.query("select has_function_privilege('anon',$1::oid,'execute') allowed", [fn.oid])).rows[0].allowed, false)
  }
})

const statuses = ['new', 'in_progress', 'review', 'accepted', 'revision']
const allowed = {
  manager: ['review:accepted', 'review:revision'],
  executor: ['new:in_progress', 'in_progress:review', 'revision:in_progress'],
}
for (const role of ['manager', 'executor']) {
  for (const from of statuses) for (const to of statuses) {
    test(`transition matrix: ${role} ${from} -> ${to}`, async () => {
      await db.exec('reset role')
      await db.query('update public.tasks set status=$1 where id=$2', [from, task1])
      const actor = role === 'manager' ? manager : executor1
      const request = move(task1, actor, to, to === 'revision' ? 'Исправить замечания' : null)
      if (allowed[role].includes(from+':'+to)) {
        await request
        assert.equal((await as(actor, 'select status from public.tasks where id=$1', [task1])).rows[0].status, to)
      } else await denied(request, /INVALID_TRANSITION/)
    })
  }
}
