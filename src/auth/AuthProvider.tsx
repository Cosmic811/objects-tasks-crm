import { useCallback, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { client, supabase } from '../lib/supabase'
import { errorMessage } from '../lib/errors'
import type { Profile } from '../types/database'
import { AuthContext } from './context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [initial, setInitial] = useState(true)
  const [profileState, setProfile] = useState<{
    userId: string
    profile: Profile | null
    error: string
  }>({ userId: '', profile: null, error: '' })
  const [error, setError] = useState('')
  const [retryCount, setRetry] = useState(0)
  const userId = session?.user.id ?? ''
  useEffect(() => {
    if (!supabase) {
      setInitial(false)
      return
    }
    let active = true
    let observed = false
    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      observed = true
      if (active) {
        if (!nextSession) setProfile({ userId: '', profile: null, error: '' })
        setSession(nextSession)
        setInitial(false)
      }
    })
    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!active || observed) return
        if (error)
          setError('Не удалось восстановить сессию. Попробуйте войти снова.')
        setSession(data.session)
        setInitial(false)
      })
      .catch(() => {
        if (active) {
          setError('Не удалось восстановить сессию.')
          setInitial(false)
        }
      })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])
  useEffect(() => {
    if (!userId) return
    let active = true
    Promise.resolve(
      client().from('profiles').select('*').eq('id', userId).maybeSingle(),
    )
      .then(({ data, error }) => {
        if (active)
          setProfile({
            userId,
            profile: data,
            error: error
              ? errorMessage(error)
              : data
                ? ''
                : 'Профиль не настроен. Попросите руководителя назначить вам роль.',
          })
      })
      .catch((error) => {
        if (active)
          setProfile({ userId, profile: null, error: errorMessage(error) })
      })
    return () => {
      active = false
    }
  }, [userId, retryCount])
  const retry = useCallback(() => {
    setProfile({ userId: '', profile: null, error: '' })
    setRetry((v) => v + 1)
  }, [])
  const signOut = useCallback(async () => {
    const { error } = await client().auth.signOut()
    if (error) throw error
    setSession(null)
    setProfile({ userId: '', profile: null, error: '' })
  }, [])
  return (
    <AuthContext.Provider
      value={{
        session,
        profile: profileState.userId === userId ? profileState.profile : null,
        loading: initial || Boolean(userId && profileState.userId !== userId),
        error: userId ? profileState.error : error,
        retry,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}
