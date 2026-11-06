import { useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../lib/api'
import { errorMessage } from '../lib/errors'
import type { Building } from '../types/database'
import { Dialog, ErrorNotice } from './Ui'

export function ObjectForm({
  object,
  onClose,
  onSaved,
}: {
  object?: Building
  onClose: () => void
  onSaved: (id: string) => void
}) {
  const [name, setName] = useState(object?.name ?? '')
  const [address, setAddress] = useState(object?.address ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!name.trim() || !address.trim()) {
      setError('Укажите название и адрес объекта.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const id = await api.saveObject(object?.id ?? null, name, address)
      onSaved(id)
    } catch (error) {
      setError(errorMessage(error))
      setBusy(false)
    }
  }
  return (
    <Dialog
      title={object ? 'Изменить объект' : 'Новый объект'}
      onClose={onClose}
      busy={busy}
    >
      <form className="form stack" onSubmit={submit}>
        {error && <ErrorNotice>{error}</ErrorNotice>}
        <label>
          Название объекта
          <input
            autoFocus
            required
            maxLength={160}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
          />
        </label>
        <label>
          Адрес
          <input
            required
            maxLength={500}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={busy}
          />
        </label>
        <div className="actions">
          <button className="button" disabled={busy}>
            {busy ? 'Сохраняем…' : 'Сохранить объект'}
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
