import type { Profile, Status, Task } from '../types/database'

export const statusLabels: Record<Status, string> = {
  new: 'Новая', in_progress: 'В работе', review: 'На проверке',
  accepted: 'Принята', revision: 'На доработке',
}
export const roleLabels = { manager: 'Постановщик', executor: 'Исполнитель' }
export type TaskAction = { target: Status; label: string; secondary?: boolean }
export function availableActions(profile: Pick<Profile, 'id' | 'role'>, task: Pick<Task, 'status' | 'assignee_id'>): TaskAction[] {
  if (profile.role === 'manager') return task.status === 'review'
    ? [{ target: 'accepted', label: 'Принять работу' }, { target: 'revision', label: 'Вернуть на доработку', secondary: true }] : []
  if (task.assignee_id !== profile.id) return []
  if (task.status === 'new') return [{ target: 'in_progress', label: 'Взять в работу' }]
  if (task.status === 'revision') return [{ target: 'in_progress', label: 'Взять на доработку' }]
  if (task.status === 'in_progress') return [{ target: 'review', label: 'Отправить на проверку' }]
  return []
}
export function formatDate(value: string) {
  return new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}
