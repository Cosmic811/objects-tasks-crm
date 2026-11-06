const messages: Record<string, string> = {
  FORBIDDEN: 'Это действие недоступно для вашей роли.',
  NOT_FOUND: 'Запись не найдена или у вас нет к ней доступа.',
  INVALID_TRANSITION:
    'Нельзя перевести задачу в выбранный статус. Обновите карточку.',
  COMMENT_REQUIRED: 'Для возврата задачи укажите причину.',
  INVALID_ASSIGNEE: 'Выберите сотрудника с ролью исполнителя.',
  OBJECT_HAS_ACTIVE_TASKS:
    'У объекта есть незавершённые задачи. Сначала завершите или удалите их.',
  OBJECT_IMMUTABLE: 'Перенос задачи на другой объект не поддерживается.',
  STALE_TASK: 'Задача уже изменилась. Обновите карточку и повторите действие.',
}

export function errorMessage(error: unknown): string {
  const source = error && typeof error === 'object' ? error : {}
  const details = {
    message: 'message' in source && typeof source.message === 'string' ? source.message : '',
    code: 'code' in source && typeof source.code === 'string' ? source.code : '',
    status: 'status' in source && typeof source.status === 'number' ? source.status : 0,
  }
  const known = Object.keys(messages).find((key) =>
    details.message.includes(key),
  )
  if (known) return messages[known]
  if (details.code === '42501') return messages.FORBIDDEN
  if (details.code === '23514' || details.code === '23502')
    return 'Проверьте заполнение и допустимую длину полей.'
  if (details.code === 'PGRST116') return messages.NOT_FOUND
  if (details.status === 401 || details.code === 'PGRST301')
    return 'Сессия истекла. Войдите в аккаунт снова.'
  if (details.status === 429)
    return 'Слишком много запросов. Подождите немного и повторите действие.'
  return 'Не удалось выполнить действие. Проверьте соединение и попробуйте ещё раз.'
}

export function mutationErrorMessage(error: unknown): string {
  const message = errorMessage(error)
  return message.startsWith('Не удалось выполнить')
    ? 'Не удалось подтвердить результат операции. Перед повторной попыткой обновите список или карточку, чтобы проверить, сохранились ли изменения.'
    : message
}
