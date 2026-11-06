import { useRef, useState } from 'react'
import { mutationErrorMessage } from '../lib/errors'
import { Dialog, ErrorNotice, Icon } from './Ui'

export function DeleteDialog({
  title,
  description,
  remove,
  onClose,
  onDeleted,
}: {
  title: string
  description: string
  remove: () => Promise<void>
  onClose: () => void
  onDeleted: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)
  async function confirm() {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      await remove()
      onDeleted()
    } catch (error) {
      setError(mutationErrorMessage(error))
      setBusy(false)
    } finally {
      pending.current = false
    }
  }
  return (
    <Dialog title={title} onClose={onClose} busy={busy} className="delete-dialog">
      <div className="stack">
        <p>{description}</p>
        <p className="muted">
          Запись будет скрыта из рабочих списков. История останется в базе.
        </p>
        {error && <ErrorNotice>{error}</ErrorNotice>}
        <div className="actions">
          <button
            autoFocus
            className="button secondary"
            data-dialog-cancel
            disabled={busy}
          >
            Отмена
          </button>
          <button className="button danger" onClick={confirm} disabled={busy}>
            <Icon name="trash" size={17} />
            {busy ? 'Удаляем…' : 'Удалить'}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
