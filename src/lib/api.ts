import { client } from './supabase'
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
    rows<Building[]>(
      client()
        .from('objects')
        .select('*')
        .order('created_at', { ascending: false }),
    ),
  object: (id: string) =>
    rows<Building>(client().from('objects').select('*').eq('id', id).single()),
  tasks: (objectId?: string) => {
    let request = client()
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false })
    if (objectId) request = request.eq('object_id', objectId)
    return rows<Task[]>(request)
  },
  task: (id: string) =>
    rows<Task>(client().from('tasks').select('*').eq('id', id).single()),
  profiles: () =>
    rows<Profile[]>(
      client().from('profiles').select('*').order('display_name'),
    ),
  history: (taskId: string) =>
    rows<History[]>(
      client()
        .from('task_status_history')
        .select('*')
        .eq('task_id', taskId)
        .order('created_at'),
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
