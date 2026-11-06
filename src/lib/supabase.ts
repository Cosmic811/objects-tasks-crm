import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const url = import.meta.env.VITE_SUPABASE_URL?.trim()
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim()
const isPublicKey =
  key?.startsWith('sb_publishable_') ||
  (key?.startsWith('eyJ') &&
    (() => {
      try {
        return JSON.parse(atob(key.split('.')[1])).role === 'anon'
      } catch {
        return false
      }
    })())

export const configured = Boolean(
  url &&
  /^https?:\/\//.test(url) &&
  !url.includes('your-project') &&
  isPublicKey &&
  key !== 'your-publishable-key',
)
export const supabase = configured
  ? createClient<Database>(url!, key!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null

export function client() {
  if (!supabase) throw new Error('NOT_CONFIGURED')
  return supabase
}
