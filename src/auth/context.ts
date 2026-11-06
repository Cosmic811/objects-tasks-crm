import { createContext, useContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { Profile } from '../types/database'

export type Auth = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  error: string
  retry: () => void
  signOut: () => Promise<void>
}
export const AuthContext = createContext<Auth | null>(null)
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('AuthProvider missing')
  return context
}
