import { client } from './supabase'
import { readAllPages } from './requests'
import type {
  Building,
  History,
  Profile,
  Status,
  Task,
} from '../types/database'

async function rows<T>(
  request: PromiseLike<{ data: T | null; error: unknown }>,
): Promise<T> {
  const { data, error } = await request
  if (error) throw error
  if (data === null) throw new Error('NOT_FOUND')
  return data
}

export const api = {
  objects: () =>
    readAllPages<Building>((from, to) =>
      client()
        .from('objects')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false }).order('id').range(from, to),
    ),
  object: (id: string) =>
    rows<Building>(client().from('objects').select('*').eq('id', id).single()),
  tasks: (objectId?: string) => {
    let request = client()
      .from('tasks')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false }).order('id')
    if (objectId) request = request.eq('object_id', objectId)
    return readAllPages<Task>((from, to) => request.range(from, to))
  },
  task: (id: string) =>
    rows<Task>(client().from('tasks').select('*').eq('id', id).single()),
  profiles: () =>
    readAllPages<Profile>((from, to) =>
      client().from('profiles').select('*', { count: 'exact' }).order('display_name').order('id').range(from, to),
    ),
  history: (taskId: string) =>
    readAllPages<History>((from, to) =>
      client()
        .from('task_status_history')
        .select('*', { count: 'exact' })
        .eq('task_id', taskId)
        .order('created_at').order('id').range(from, to),
    ),
  saveObject: (id: string | null, name: string, address: string) =>
    rows(
      client().rpc('save_object', {
        p_id: id,
        p_name: name,
        p_address: address,
      }),
    ),
  saveTask: (
    task: Task | null,
    objectId: string,
    title: string,
    description: string,
    assigneeId: string,
  ) =>
    rows(
      client().rpc('save_task', {
        p_id: task?.id ?? null,
        p_object_id: objectId,
        p_title: title,
        p_description: description,
        p_assignee_id: assigneeId,
        p_expected_updated_at: task?.updated_at ?? null,
      }),
    ),
  transition: (task: Task, status: Status, comment?: string) =>
    rows(
      client().rpc('transition_task', {
        p_task_id: task.id,
        p_to_status: status,
        p_expected_updated_at: task.updated_at,
        p_comment: comment ?? null,
      }),
    ),
  deleteObject: async (id: string) => {
    const { error } = await client().rpc('delete_object', { p_object_id: id })
    if (error) throw error
  },
  deleteTask: async (task: Task) => {
    const { error } = await client().rpc('delete_task', {
      p_task_id: task.id,
      p_expected_updated_at: task.updated_at,
    })
    if (error) throw error
  },
}
