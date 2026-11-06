import { useId, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../lib/api'
import { mutationErrorMessage } from '../lib/errors'
import type { Profile, Task } from '../types/database'
import { Dialog, ErrorNotice, Icon } from './Ui'

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
  const pending = useRef(false)
  const titleRef = useRef<HTMLInputElement>(null)
  const assigneeRef = useRef<HTMLSelectElement>(null)
  const errorId = useId()
  const employees = profiles.filter((p) => p.role === 'executor')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (pending.current) return
    if (!title.trim() || !assignee) {
      setError('Укажите название и исполнителя.')
      if (!title.trim()) titleRef.current?.focus()
      else assigneeRef.current?.focus()
      return
    }
    pending.current = true
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
      setError(mutationErrorMessage(error))
      setBusy(false)
    } finally {
      pending.current = false
    }
  }
  return (
    <Dialog
      title={task ? 'Изменить задачу' : 'Новая задача'}
      description="Опишите работу и назначьте ответственного."
      onClose={onClose}
      busy={busy}
    >
      <form className="form stack" onSubmit={submit} aria-busy={busy}>
        {error && <ErrorNotice id={errorId}>{error}</ErrorNotice>}
        <label>
          Название задачи
          <input
            ref={titleRef}
            name="task-title"
            aria-invalid={Boolean(error && !title.trim()) || undefined}
            aria-describedby={error ? errorId : undefined}
            autoFocus
            required
            maxLength={200}
            placeholder="Что нужно сделать?"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          Описание
          <textarea
            name="task-description"
            rows={5}
            maxLength={10000}
            placeholder="Что проверить, подготовить или согласовать"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          Исполнитель
          <select
            ref={assigneeRef}
            name="task-assignee"
            aria-invalid={Boolean(error && !assignee) || undefined}
            aria-describedby={error ? errorId : undefined}
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
            <Icon name="right" size={17} />
          </button>
          <button
            type="button"
            className="button secondary"
            data-dialog-cancel
            disabled={busy}
          >
            Отмена
          </button>
        </div>
      </form>
    </Dialog>
  )
}
