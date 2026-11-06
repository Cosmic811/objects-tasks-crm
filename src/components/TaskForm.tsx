import { useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../lib/api'
import { errorMessage } from '../lib/errors'
import type { Profile, Task } from '../types/database'
import { Dialog, ErrorNotice } from './Ui'

export function TaskForm({
  task,
  objectId,
  profiles,
  onClose,
  onSaved,
}: {
  task?: Task
  objectId: string
  profiles: Profile[]
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const [title, setTitle] = useState(task?.title ?? '')
  const [description, setDescription] = useState(task?.description ?? '')
  const [assignee, setAssignee] = useState(task?.assignee_id ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const employees = profiles.filter((p) => p.role === 'executor')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!title.trim() || !assignee) {
      setError('Укажите название и исполнителя.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const id = await api.saveTask(
        task ?? null,
        objectId,
        title,
        description,
        assignee,
      )
      onSaved(id)
    } catch (error) {
      setError(errorMessage(error))
      setBusy(false)
    }
  }
  return (
    <Dialog
      title={task ? 'Изменить задачу' : 'Новая задача'}
      onClose={onClose}
      busy={busy}
    >
      <form className="form stack" onSubmit={submit}>
        {error && <ErrorNotice>{error}</ErrorNotice>}
        <label>
          Название задачи
          <input
            autoFocus
            required
            maxLength={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          Описание
          <textarea
            rows={5}
            maxLength={10000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          Исполнитель
          <select
            required
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            disabled={busy}
          >
            <option value="">Выберите сотрудника</option>
            {employees.map((p) => (
              <option key={p.id} value={p.id}>
                {p.display_name}
              </option>
            ))}
          </select>
        </label>
        {!employees.length && (
          <p className="muted">
            Нет сотрудников с ролью исполнителя. Добавьте профили пользователей
            в Supabase.
          </p>
        )}
        <p className="muted">
          {task
            ? 'Текущий статус сохранится. Меняйте его отдельными действиями в карточке.'
            : 'Задача будет создана со статусом «Новая».'}
        </p>
        <div className="actions">
          <button className="button" disabled={busy || !employees.length}>
            {busy ? 'Сохраняем…' : 'Сохранить задачу'}
          </button>
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
            disabled={busy}
          >
            Отмена
          </button>
        </div>
      </form>
    </Dialog>
  )
}
