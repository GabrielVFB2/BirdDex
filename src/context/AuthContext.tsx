import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile } from '@/types'

interface AuthContextValue {
  session: Session | null
  user: User | null
  profile: Profile | null
  loading: boolean
  signUp: (email: string, password: string, username: string, displayName: string) => Promise<{ error: string | null }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (error) {
      console.error('Error loading profile:', error.message)
      return
    }

    if (!data) {
      const { data: userData } = await supabase.auth.getUser()
      const u = userData.user
      const email = u?.email ?? ''
      const fullName = (u?.user_metadata?.full_name as string) || (u?.user_metadata?.name as string) || ''
      const avatarUrl = (u?.user_metadata?.avatar_url as string) || (u?.user_metadata?.picture as string) || ''
      const baseName = fullName || email.split('@')[0] || 'Observador'
      const cleanBase = baseName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'observador'
      let username = `${cleanBase}_${Math.random().toString(36).slice(2, 8)}`
      let attempts = 0

      while (attempts < 3) {
        const { error: insertError } = await supabase.from('profiles').insert({
          id: userId,
          username,
          display_name: baseName,
          avatar_url: avatarUrl,
        })

        if (!insertError) break
        if (insertError.code !== '23505') {
          console.error('Error creating profile:', insertError.message)
          return
        }
        username = `${cleanBase}_${Math.random().toString(36).slice(2, 10)}`
        attempts++
      }

      const { data: newProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle()
      setProfile(newProfile as Profile | null)
      return
    }

    setProfile(data as Profile | null)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        loadProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        loadProfile(session.user.id)
      } else {
        setProfile(null)
      }
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [])

  const refreshProfile = async () => {
    if (session?.user) {
      await loadProfile(session.user.id)
    }
  }

  const signUp = async (email: string, password: string, username: string, displayName: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) return { error: error.message }
    if (!data.user) return { error: 'Falha ao criar conta.' }

    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: data.user.id,
        username,
        display_name: displayName,
      })

    if (profileError) {
      return { error: profileError.message }
    }

    return { error: null }
  }

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return { error: null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, profile, loading, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
