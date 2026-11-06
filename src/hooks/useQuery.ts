import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../lib/errors'

export function useQuery<T>(loader: () => Promise<T>, key: string) {
  const [result, setResult] = useState<{
    key: string
    version?: number
    data?: T
    error?: string
  }>({ key: '' })
  const [version, setVersion] = useState(0)
  const load = useRef(loader)
  load.current = loader
  useEffect(() => {
    let active = true
    load
      .current()
      .then((data) => {
        if (active) setResult({ key, version, data })
      })
      .catch((error) => {
        if (active) setResult({ key, version, error: errorMessage(error) })
      })
    return () => {
      active = false
    }
  }, [key, version])
  const reload = useCallback(() => {
    setVersion((v) => v + 1)
  }, [])
  return {
    data: result.key === key ? result.data : undefined,
    error: result.key === key ? result.error : undefined,
    refreshing: result.key === key && result.version !== version,
    reload,
  }
}
