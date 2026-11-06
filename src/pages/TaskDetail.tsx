import { useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { api } from '../lib/api'
import { errorMessage } from '../lib/errors'
import { availableActions, formatDate, statusLabels } from '../lib/workflow'
import { useQuery } from '../hooks/useQuery'
import type { Status } from '../types/database'
import {
  Badge,
  Breadcrumbs,
  ErrorNotice,
  LoadError,
  Loading,
  Success,
} from '../components/Ui'
import { TaskForm } from '../components/TaskForm'
import { DeleteDialog } from '../components/DeleteDialog'

export function TaskDetail() {
  const { id = '' } = useParams()
  const { profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const manager = profile!.role === 'manager'
  const [modal, setModal] = useState<'edit' | 'delete' | null>(null)
  const [revision, setRevision] = useState(false)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [success, setSuccess] = useState(location.state?.message ?? '')
  const { data, error, reload } = useQuery(async () => {
    const [task, profiles, history] = await Promise.all([
      api.task(id),
      api.profiles(),
      api.history(id),
    ])
    const object = await api.object(task.object_id)
    return { task, object, profiles, history }
  }, `task:${id}`)
  async function transition(status: Status) {
    if (!data) return
    if (status === 'revision' && !comment.trim()) {
      setActionError('Для возврата задачи укажите причину.')
      return
    }
    setBusy(true)
    setActionError('')
    setSuccess('')
    try {
      await api.transition(
        data.task,
        status,
        status === 'revision' ? comment : undefined,
      )
      setRevision(false)
      setComment('')
      setSuccess(`Статус изменён: ${statusLabels[status]}.`)
      reload()
    } catch (error) {
      setActionError(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  if (error)
    return (
      <>
        <Breadcrumbs />
        <LoadError error={error} retry={reload} />
      </>
    )
  if (!data) return <Loading />
  const { task, object, profiles, history } = data
  const name = (id: string) =>
    profiles.find((p) => p.id === id)?.display_name ?? 'Профиль недоступен'
  const actions = availableActions(profile!, task)
  const lastReturn = [...history]
    .reverse()
    .find((h) => h.to_status === 'revision')
  return (
    <>
      <Breadcrumbs object={object} />
      <div className="page-header">
        <div>
          <Badge status={task.status} />
          <h1 className="task-title">{task.title}</h1>
        </div>
        {manager && (
          <div className="actions">
            <button
              className="button secondary"
              onClick={() => setModal('edit')}
              disabled={busy}
            >
              Изменить
            </button>
            <button
              className="text-button danger-text"
              onClick={() => setModal('delete')}
              disabled={busy}
            >
              Удалить задачу
            </button>
          </div>
        )}
      </div>
      <Success>{success}</Success>
      {actionError && (
        <ErrorNotice>
          {actionError}{' '}
          <button
            className="text-button"
            onClick={() => {
              setActionError('')
              reload()
            }}
          >
            Обновить карточку
          </button>
        </ErrorNotice>
      )}
      <div className="task-layout">
        <div>
          <section className="panel task-description">
            <h2>Что нужно сделать</h2>
            <p className="preserve-lines">
              {task.description || 'Описание не добавлено.'}
            </p>
            {task.status === 'revision' && lastReturn?.comment && (
              <div className="return-note">
                <h3>Причина возврата</h3>
                <p className="preserve-lines">{lastReturn.comment}</p>
                <span className="muted">
                  {name(lastReturn.actor_id)} ·{' '}
                  {formatDate(lastReturn.created_at)}
                </span>
              </div>
            )}
            {actions.length > 0 && (
              <div className="workflow-actions">
                <p className="muted">
                  {manager
                    ? 'Проверьте результат перед принятием работы.'
                    : 'Меняйте статус по мере выполнения задачи.'}
                </p>
                <div className="actions">
                  {actions.map((action) => (
                    <button
                      className={`button ${action.secondary ? 'secondary' : ''}`}
                      key={action.target}
                      disabled={busy}
                      onClick={() => {
                        if (action.target === 'revision') {
                          setRevision(true)
                          setActionError('')
                        } else void transition(action.target)
                      }}
                    >
                      {busy ? 'Сохраняем…' : action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {revision && (
              <form
                className="form stack revision-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  void transition('revision')
                }}
              >
                <label>
                  Причина возврата на доработку
                  <textarea
                    autoFocus
                    required
                    rows={3}
                    maxLength={4000}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    disabled={busy}
                  />
                </label>
                <div className="actions">
                  <button className="button" disabled={busy}>
                    {busy ? 'Возвращаем…' : 'Отправить на доработку'}
                  </button>
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => setRevision(false)}
                    disabled={busy}
                  >
                    Отмена
                  </button>
                </div>
              </form>
            )}
          </section>
          <section className="history-section">
            <h2>История статусов</h2>
            {!history.length ? (
              <p className="muted">Записей пока нет.</p>
            ) : (
              <ol className="history-list">
                {history.map((entry) => (
                  <li key={entry.id}>
                    <span
                      className={`history-point status-${entry.to_status}`}
                    />
                    <div>
                      <p className="history-transition">
                        {entry.from_status
                          ? `${statusLabels[entry.from_status]} → ${statusLabels[entry.to_status]}`
                          : 'Задача создана'}
                      </p>
                      <p className="muted history-meta">
                        {name(entry.actor_id)} ·{' '}
                        <time dateTime={entry.created_at}>
                          {formatDate(entry.created_at)}
                        </time>
                      </p>
                      {entry.comment && (
                        <p className="history-comment preserve-lines">
                          {entry.comment}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
        <aside className="panel task-meta" aria-label="Данные задачи">
          <h2>Детали задачи</h2>
          <dl>
            <dt>Объект</dt>
            <dd>{object.name}</dd>
            <dt>Адрес</dt>
            <dd>{object.address}</dd>
            <dt>Исполнитель</dt>
            <dd>{name(task.assignee_id)}</dd>
            <dt>Автор</dt>
            <dd>{name(task.created_by)}</dd>
            <dt>Создана</dt>
            <dd>
              <time dateTime={task.created_at}>
                {formatDate(task.created_at)}
              </time>
            </dd>
          </dl>
        </aside>
      </div>
      {modal === 'edit' && (
        <TaskForm
          task={task}
          objectId={task.object_id}
          profiles={profiles}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            setSuccess('Задача сохранена.')
            reload()
          }}
        />
      )}
      {modal === 'delete' && (
        <DeleteDialog
          title="Удалить задачу?"
          description={`«${task.title}» больше не будет отображаться исполнителю.`}
          remove={() => api.deleteTask(task)}
          onClose={() => setModal(null)}
          onDeleted={() =>
            navigate(`/objects/${task.object_id}`, { replace: true })
          }
        />
      )}
    </>
  )
}
