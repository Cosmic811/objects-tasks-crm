import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { createClient } from '@supabase/supabase-js'

const env = process.env
const required = ['SUPABASE_URL','SUPABASE_PUBLISHABLE_KEY','TEST_MANAGER_EMAIL','TEST_MANAGER_PASSWORD',
  'TEST_EXECUTOR1_EMAIL','TEST_EXECUTOR1_PASSWORD','TEST_EXECUTOR2_EMAIL','TEST_EXECUTOR2_PASSWORD']
if (required.some(name => !env[name])) {
  console.error('Fill .env.test.local with confirmed test accounts. No API tests were run.')
  process.exit(1)
}
const options = { auth: { persistSession:false, autoRefreshToken:false, detectSessionInUrl:false } }
const clients = Array.from({length:4}, () => createClient(env.SUPABASE_URL,env.SUPABASE_PUBLISHABLE_KEY,options))
const [manager, e1, e2, anon] = clients
const report = { checkedAt: new Date().toISOString(), environment:'Supabase Cloud Auth + Data API', results:[] }
const objectIds = []
const taskIds = []
let failed = false
const must = result => { if (result.error) throw new Error('Unexpected API failure: '+result.error.code); return result.data }
const rpc = async (client, name, args) => must(await client.rpc(name,args))
async function check(name, expected, run) {
  try {
    const actual = await run()
    report.results.push({name,expected,actual,status:'PASS'})
    console.log('PASS '+name)
  } catch(error) {
    failed = true
    const actual = error instanceof assert.AssertionError ? 'Assertion failed' : error.message
    report.results.push({name,expected,actual,status:'FAIL'})
    console.error('FAIL '+name+': '+actual)
  }
}
function rejected(result) {
  assert.ok(result.error, 'Request unexpectedly succeeded')
  assert.ok(['42501','22023','P0002','40001','23514','PGRST202','PGRST301','PGRST116'].includes(result.error.code), 'Unexpected failure type')
  return result.error.code
}
async function task(client, id) { return must(await client.from('tasks').select('*').eq('id',id).single()) }
async function move(client, id, to, comment=null, expected) {
  const current = expected ?? (await task(client,id)).updated_at
  return client.rpc('transition_task',{p_task_id:id,p_to_status:to,p_expected_updated_at:current,p_comment:comment})
}
try {
  const ids = []
  for (const [index,prefix] of ['MANAGER','EXECUTOR1','EXECUTOR2'].entries()) {
    const result = await clients[index].auth.signInWithPassword({email:env['TEST_'+prefix+'_EMAIL'],password:env['TEST_'+prefix+'_PASSWORD']})
    if (result.error) throw new Error('Test account login failed: '+prefix+' ('+result.error.code+')')
    ids.push(result.data.user.id)
  }
  const [,e1id,e2id] = ids
  const stamp = new Date().toISOString()
  for (const name of ['Проверка доступа, участок А','Проверка доступа, участок Б']) {
    objectIds.push(await rpc(manager,'save_object',{p_id:null,p_name:name+' '+stamp,p_address:'Тестовые данные для проверки RLS'}))
  }
  for (const [index,assignee] of [e1id,e2id].entries()) {
    taskIds.push(await rpc(manager,'save_task',{p_id:null,p_object_id:objectIds[index],p_title:'Проверить монтаж, тест безопасности',p_description:'Изолированная тестовая запись',p_assignee_id:assignee}))
  }
  const [t1,t2] = taskIds
  await check('01 Чужая задача недоступна исполнителю','0 rows',async()=>{
    const data=must(await e1.from('tasks').select('*').eq('id',t2)); assert.equal(data.length,0); return '0 rows'
  })
  await check('02 Изменение чужой задачи запрещено','42501',async()=>rejected(await e1.from('tasks').update({title:'Подмена'}).eq('id',t2)))
  await check('03 Чужой объект недоступен','0 rows',async()=>{
    const data=must(await e1.from('objects').select('*').eq('id',objectIds[1])); assert.equal(data.length,0); return '0 rows'
  })
  await check('04 Создание объекта исполнителем запрещено','42501',async()=>rejected(await e1.rpc('save_object',{p_id:null,p_name:'Подмена',p_address:'Подмена'})))
  await check('05 Самоназначение на чужую задачу запрещено','42501',async()=>rejected(await e1.from('tasks').update({assignee_id:e1id}).eq('id',t2)))
  await check('06 Повышение собственной роли запрещено','42501',async()=>rejected(await e1.from('profiles').update({role:'manager'}).eq('id',e1id)))
  await check('07 Прямой status PATCH запрещён','42501',async()=>rejected(await e1.from('tasks').update({status:'accepted'}).eq('id',t1)))
  await check('08 Запрещённый RPC-переход отклоняется','22023',async()=>rejected(await move(e1,t1,'accepted')))
  must(await move(e1,t1,'in_progress')); must(await move(e1,t1,'review'))
  await check('09 Возврат без причины отклоняется','COMMENT_REQUIRED',async()=>{
    const r=await move(manager,t1,'revision','   '); rejected(r); assert.ok(r.error.message.includes('COMMENT_REQUIRED')); return 'COMMENT_REQUIRED'
  })
  await check('10 Изменение и удаление истории запрещено','42501 / 42501',async()=>{
    const a=rejected(await e1.from('task_status_history').update({comment:'Подмена'}).eq('task_id',t1))
    const b=rejected(await e1.from('task_status_history').delete().eq('task_id',t1)); return a+' / '+b
  })
  await check('11 Поддельная запись истории запрещена','42501',async()=>rejected(await e1.from('task_status_history').insert({task_id:t1,actor_id:ids[0],to_status:'new'})))
  await check('12 Неавторизованный запрос не получает данные','42501',async()=>{
    for(const table of ['tasks','objects','profiles','task_status_history']) rejected(await anon.from(table).select('*').limit(1))
    return '42501'
  })
  await check('13 Полный цикл с доработкой и проверкой аудита','7 records, correct actors and comment',async()=>{
    must(await move(manager,t1,'revision','Исправить крепление кабеля'))
    must(await move(e1,t1,'in_progress')); must(await move(e1,t1,'review')); must(await move(manager,t1,'accepted'))
    const history=must(await e1.from('task_status_history').select('*').eq('task_id',t1).order('created_at'))
    assert.deepEqual(history.map(h=>h.to_status),['new','in_progress','review','revision','in_progress','review','accepted'])
    assert.deepEqual(history.map(h=>h.actor_id),[ids[0],e1id,e1id,ids[0],e1id,e1id,ids[0]])
    assert.equal(history[3].comment,'Исправить крепление кабеля')
    assert.ok(history.every(h=>Number.isFinite(Date.parse(h.created_at))))
    return '7 records, correct actors and comment'
  })
  await check('14 Чужая история недоступна','0 rows',async()=>{
    const data=must(await e1.from('task_status_history').select('*').eq('task_id',t2)); assert.equal(data.length,0); return '0 rows'
  })
  await check('15 Конкурентные переходы не дублируют аудит','1 success, 1 STALE_TASK',async()=>{
    const current=await task(e2,t2)
    const results=await Promise.all([move(e2,t2,'in_progress',null,current.updated_at),move(e2,t2,'in_progress',null,current.updated_at)])
    assert.equal(results.filter(r=>!r.error).length,1)
    assert.equal(results.filter(r=>r.error?.message.includes('STALE_TASK')).length,1)
    return '1 success, 1 STALE_TASK'
  })
  await check('16 Объект с активной задачей защищён от удаления','OBJECT_HAS_ACTIVE_TASKS',async()=>{
    const r=await manager.rpc('delete_object',{p_object_id:objectIds[1]}); rejected(r)
    assert.ok(r.error.message.includes('OBJECT_HAS_ACTIVE_TASKS')); return 'OBJECT_HAS_ACTIVE_TASKS'
  })
  await check('17 Открытая регистрация отключена','disable_signup=true',async()=>{
    const response=await fetch(env.SUPABASE_URL+'/auth/v1/settings',{headers:{apikey:env.SUPABASE_PUBLISHABLE_KEY}})
    assert.equal(response.status,200); const settings=await response.json(); assert.equal(settings.disable_signup,true); return 'disable_signup=true'
  })
} catch(error) {
  failed=true
  // Supabase Auth responses and credentials must never be printed.
  console.error(error.message)
  report.setupError=error.message
} finally {
  for(const id of taskIds) {
    try { const current=await task(manager,id); await rpc(manager,'delete_task',{p_task_id:id,p_expected_updated_at:current.updated_at}) }
    catch { failed=true; report.cleanupFailed=true }
  }
  for(const id of objectIds) {
    try { await rpc(manager,'delete_object',{p_object_id:id}) } catch { failed=true; report.cleanupFailed=true }
  }
  await Promise.all(clients.map(c=>c.auth.signOut({scope:'local'})))
  report.passed=report.results.filter(r=>r.status==='PASS').length
  report.failed=report.results.filter(r=>r.status==='FAIL').length
  report.status=failed?'FAIL':'PASS'
  await mkdir('docs/qa',{recursive:true})
  await writeFile('docs/qa/supabase-api.json',JSON.stringify(report,null,2)+'\n')
}
process.exitCode=failed?1:0
