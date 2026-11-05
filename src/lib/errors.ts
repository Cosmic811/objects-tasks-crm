const messages: Record<string, string> = {
  FORBIDDEN: 'Это действие недоступно для вашей роли.',
  NOT_FOUND: 'Запись не найдена или у вас нет к ней доступа.',
  INVALID_TRANSITION: 'Нельзя перевести задачу в выбранный статус. Обновите карточку.',
  COMMENT_REQUIRED: 'Для возврата задачи укажите причину.',
  INVALID_ASSIGNEE: 'Выберите сотрудника с ролью исполнителя.',
  OBJECT_HAS_ACTIVE_TASKS: 'У объекта есть незавершённые задачи. Сначала завершите или удалите их.',
  OBJECT_IMMUTABLE: 'Перенос задачи на другой объект не поддерживается.',
  STALE_TASK: 'Задача уже изменилась. Обновите карточку и повторите действие.',
}

export function errorMessage(error: unknown): string {
  const details = error && typeof error === 'object' ? error as { message?: string; code?: string; status?: number } : {}
  // Never log session tokens, request headers, passwords, or complete Supabase responses.
  console.error('CRM operation failed', { code: details.code ?? 'NETWORK_ERROR' })
  const known = Object.keys(messages).find(key => details.message?.includes(key))
  if (known) return messages[known]
  if (details.code === '42501') return messages.FORBIDDEN
  if (details.code === '23514' || details.code === '23502') return 'Проверьте заполнение и допустимую длину полей.'
  if (details.code === 'PGRST116') return messages.NOT_FOUND
  if (details.status === 401 || details.code === 'PGRST301') return 'Сессия истекла. Войдите в аккаунт снова.'
  return 'Не удалось выполнить действие. Проверьте соединение и попробуйте ещё раз.'
}
