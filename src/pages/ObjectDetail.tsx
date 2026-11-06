import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { api } from '../lib/api'
import { useQuery } from '../hooks/useQuery'
import {
  Breadcrumbs,
  Icon,
  LoadError,
  Loading,
  Success,
  TaskTable,
} from '../components/Ui'
import { ObjectForm } from '../components/ObjectForm'
import { TaskForm } from '../components/TaskForm'
import { DeleteDialog } from '../components/DeleteDialog'

export function ObjectDetail() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const manager = profile!.role === 'manager'
  const [modal, setModal] = useState<'edit' | 'delete' | 'task' | null>(null)
  const [success, setSuccess] = useState('')
  const { data, error, reload, refreshing } = useQuery(async () => {
    const [object, tasks, profiles] = await Promise.all([
      api.object(id),
      api.tasks(id),
      api.profiles(),
    ])
    return { object, tasks, profiles }
  }, `object:${id}`)
  if (error)
    return (
      <>
        <Breadcrumbs />
        <LoadError error={error} retry={reload} />
      </>
    )
  if (!data) return <Loading />
  return (
    <>
      <Breadcrumbs />
      <div className="page-header">
        <div>
          <h1>{data.object.name}</h1>
          <p className="muted address-line"><Icon name="pin" size={17} />{data.object.address}</p>
        </div>
        {manager && (
          <div className="actions">
            <button
              className="button secondary"
              onClick={() => setModal('edit')}
              disabled={refreshing}
            >
              Изменить
            </button>
            <button
              className="icon-button danger-text"
              aria-label="Удалить объект"
              title="Удалить объект"
              onClick={() => setModal('delete')}
              disabled={refreshing}
            >
              <Icon name="trash" size={18} />
            </button>
          </div>
        )}
      </div>
      <Success>{success}</Success>
      <div className="section-header">
        <div>
          <h2>
            Задачи объекта <span className="count">{data.tasks.length}</span>
          </h2>
          <p className="muted">
            {manager
              ? 'Назначайте ответственных и проверяйте выполненную работу.'
              : 'Здесь показаны только ваши задачи.'}
          </p>
        </div>
        {manager && (
          <button className="button" onClick={() => setModal('task')} disabled={refreshing}>
            <Icon name="plus" />
            Создать задачу
          </button>
        )}
      </div>
      <div aria-busy={refreshing}><TaskTable tasks={data.tasks} profiles={data.profiles} viewer={profile!} /></div>
      {modal === 'edit' && (
        <ObjectForm
          object={data.object}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null)
            setSuccess('Объект сохранён.')
            reload()
          }}
        />
      )}
      {modal === 'task' && (
        <TaskForm
          objectId={id}
          profiles={data.profiles}
          onClose={() => setModal(null)}
          onSaved={(taskId) =>
            navigate(`/tasks/${taskId}`, {
              state: { message: 'Задача создана и назначена исполнителю.' },
            })
          }
        />
      )}
      {modal === 'delete' && (
        <DeleteDialog
          title="Удалить объект?"
          description={`«${data.object.name}» и его завершённые задачи будут скрыты. Объект с незавершёнными задачами удалить нельзя.`}
          remove={() => api.deleteObject(id)}
          onClose={() => setModal(null)}
          onDeleted={() =>
            navigate('/', {
              replace: true,
              state: { message: 'Объект удалён.' },
            })
          }
        />
      )}
    </>
  )
}
