import { createBrowserClient } from '@supabase/ssr'

// Create Supabase client for browser
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

// Export a singleton instance for convenience
export const supabase = createClient()

// Types for auth
export interface User {
  id: string
  email: string
  name: string
  role: string
  tutor_id?: string
  user_metadata?: Record<string, unknown>
}

export interface Session {
  access_token: string
  refresh_token: string
  expires_at: number
  expires_in: number
}

export interface AuthState {
  user: User | null
  session: Session | null
  isLoading: boolean
  isAuthenticated: boolean
}




