'use client'

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { supabase, User, Session, AuthState } from './supabase'
import { api } from './api'

interface AuthContextType extends AuthState {
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string }>
  signUp: (data: SignUpData) => Promise<{ success: boolean; error?: string }>
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
  updateProfile: (data: ProfileUpdateData) => Promise<{ success: boolean; error?: string }>
}

interface SignUpData {
  email: string
  password: string
  name: string
  teaching_style?: string
  education_system?: string
}

interface ProfileUpdateData {
  name?: string
  teaching_style?: string
  education_system?: string
  bio?: string
  onboarding_completed?: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Routes that don't require authentication
const PUBLIC_ROUTES = ['/auth/login', '/auth/signup', '/auth/forgot-password', '/auth/reset-password']

export function AuthProvider({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    isLoading: true,
    isAuthenticated: false,
  })
  
  const router = useRouter()
  const pathname = usePathname()

  // Check if current route is public
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname?.startsWith(route))

  // Initialize auth state from stored session
  const initializeAuth = useCallback(async () => {
    try {
      // Try to get session from Supabase
      const { data: { session }, error } = await supabase.auth.getSession()
      
      if (error || !session) {
        setAuthState({
          user: null,
          session: null,
          isLoading: false,
          isAuthenticated: false,
        })
        return
      }

      // Get user metadata
      const userMetadata = session.user.user_metadata || {}
      
      // Try to get tutor_id
      let tutorId = userMetadata.tutor_id
      if (!tutorId && session.user.email) {
        try {
          const { data } = await supabase
            .from('tutors')
            .select('id')
            .eq('email', session.user.email)
            .single()
          if (data) tutorId = data.id
        } catch {
          // Ignore - tutor record might not exist yet
        }
      }

      const user: User = {
        id: session.user.id,
        email: session.user.email || '',
        name: userMetadata.name || session.user.email?.split('@')[0] || 'User',
        role: userMetadata.role || 'tutor',
        tutor_id: tutorId,
      }

      setAuthState({
        user,
        session: {
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at || 0,
          expires_in: session.expires_in || 0,
        },
        isLoading: false,
        isAuthenticated: true,
      })

      // Set the token for API calls
      api.defaults.headers.common['Authorization'] = `Bearer ${session.access_token}`

    } catch (error) {
      console.error('Auth initialization error:', error)
      setAuthState({
        user: null,
        session: null,
        isLoading: false,
        isAuthenticated: false,
      })
    }
  }, [])

  // Initialize on mount
  useEffect(() => {
    initializeAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const userMetadata = session.user.user_metadata || {}
        
        let tutorId = userMetadata.tutor_id
        if (!tutorId && session.user.email) {
          try {
            const { data } = await supabase
              .from('tutors')
              .select('id')
              .eq('email', session.user.email)
              .single()
            if (data) tutorId = data.id
          } catch {
            // Ignore
          }
        }

        const user: User = {
          id: session.user.id,
          email: session.user.email || '',
          name: userMetadata.name || session.user.email?.split('@')[0] || 'User',
          role: userMetadata.role || 'tutor',
          tutor_id: tutorId,
        }

        setAuthState({
          user,
          session: {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at || 0,
            expires_in: session.expires_in || 0,
          },
          isLoading: false,
          isAuthenticated: true,
        })

        api.defaults.headers.common['Authorization'] = `Bearer ${session.access_token}`

      } else if (event === 'SIGNED_OUT') {
        setAuthState({
          user: null,
          session: null,
          isLoading: false,
          isAuthenticated: false,
        })
        delete api.defaults.headers.common['Authorization']
      } else if (event === 'TOKEN_REFRESHED' && session) {
        setAuthState(prev => ({
          ...prev,
          session: {
            access_token: session.access_token,
            refresh_token: session.refresh_token,
            expires_at: session.expires_at || 0,
            expires_in: session.expires_in || 0,
          },
        }))
        api.defaults.headers.common['Authorization'] = `Bearer ${session.access_token}`
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [initializeAuth])

  // Redirect logic
  useEffect(() => {
    if (authState.isLoading) return

    if (!authState.isAuthenticated && !isPublicRoute && pathname !== '/') {
      // Not authenticated and trying to access protected route
      router.push('/auth/login')
    } else if (authState.isAuthenticated && isPublicRoute) {
      // Authenticated and on auth page - redirect to dashboard
      router.push('/dashboard')
    }
  }, [authState.isAuthenticated, authState.isLoading, isPublicRoute, pathname, router])

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        return { success: false, error: error.message }
      }

      if (!data.session) {
        return { success: false, error: 'No session returned' }
      }

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message || 'Sign in failed' }
    }
  }

  const signUp = async (data: SignUpData) => {
    try {
      // First, sign up with Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          data: {
            name: data.name,
            role: 'tutor',
          },
        },
      })

      if (authError) {
        return { success: false, error: authError.message }
      }

      if (!authData.user) {
        return { success: false, error: 'Failed to create user' }
      }

      // Create tutor record
      const { error: tutorError } = await supabase.from('tutors').insert({
        id: authData.user.id,
        name: data.name,
        email: data.email,
        teaching_style: data.teaching_style || 'Adaptive and personalized',
        education_system: data.education_system || 'General',
      })

      if (tutorError) {
        console.error('Tutor creation error:', tutorError)
        // Continue anyway - the tutor record can be created later
      }

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message || 'Sign up failed' }
    }
  }

  const signOut = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/auth/login')
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  const refreshSession = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.refreshSession()
      if (error) throw error
      if (session) {
        api.defaults.headers.common['Authorization'] = `Bearer ${session.access_token}`
      }
    } catch (error) {
      console.error('Session refresh error:', error)
    }
  }

  const updateProfile = async (data: ProfileUpdateData) => {
    try {
      // Update Supabase Auth metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          name: data.name,
          teaching_style: data.teaching_style,
          education_system: data.education_system,
          bio: data.bio,
          onboarding_completed: data.onboarding_completed,
        },
      })

      if (authError) {
        return { success: false, error: authError.message }
      }

      // Also update the tutors table if the user has a tutor record
      if (authState.user?.id) {
        const updateData: Record<string, unknown> = {}
        if (data.name !== undefined) updateData.name = data.name
        if (data.teaching_style !== undefined) updateData.teaching_style = data.teaching_style
        if (data.education_system !== undefined) updateData.education_system = data.education_system

        if (Object.keys(updateData).length > 0) {
          await supabase
            .from('tutors')
            .update(updateData)
            .eq('id', authState.user.id)
        }
      }

      // Update local state
      setAuthState((prev) => ({
        ...prev,
        user: prev.user
          ? {
              ...prev.user,
              name: data.name || prev.user.name,
              user_metadata: {
                ...prev.user.user_metadata,
                ...data,
              },
            }
          : null,
      }))

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message || 'Failed to update profile' }
    }
  }

  return (
    <AuthContext.Provider
      value={{
        ...authState,
        signIn,
        signUp,
        signOut,
        refreshSession,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Higher-order component for protected pages
export function withAuth<P extends object>(Component: React.ComponentType<P>) {
  return function ProtectedComponent(props: P) {
    const { isAuthenticated, isLoading } = useAuth()
    const router = useRouter()

    useEffect(() => {
      if (!isLoading && !isAuthenticated) {
        router.push('/auth/login')
      }
    }, [isLoading, isAuthenticated, router])

    if (isLoading) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-red-500"></div>
        </div>
      )
    }

    if (!isAuthenticated) {
      return null
    }

    return <Component {...props} />
  }
}




