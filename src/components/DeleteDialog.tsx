import { useState } from 'react'
import { errorMessage } from '../lib/errors'
import { Dialog, ErrorNotice } from './Ui'

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
  async function confirm() {
    setBusy(true)
    setError('')
    try {
      await remove()
      onDeleted()
    } catch (error) {
      setError(errorMessage(error))
      setBusy(false)
    }
  }
  return (
    <Dialog title={title} onClose={onClose} busy={busy}>
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
            onClick={onClose}
            disabled={busy}
          >
            Отмена
          </button>
          <button className="button danger" onClick={confirm} disabled={busy}>
            {busy ? 'Удаляем…' : 'Удалить'}
          </button>
        </div>
      </div>
    </Dialog>
  )
}
