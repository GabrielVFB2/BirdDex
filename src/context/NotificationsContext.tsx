import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import type { Profile } from '@/types'

export interface NotificationItem {
  id: string
  user_id: string
  actor_id: string
  type: 'like' | 'comment' | 'follow' | 'message'
  post_id: string | null
  read: boolean
  created_at: string
  actor?: Profile
}

interface NotificationsContextValue {
  unreadCount: number
  notifications: NotificationItem[]
  loading: boolean
  error: string
  fetchNotifications: () => Promise<void>
  markAllRead: () => Promise<void>
  refresh: () => Promise<void>
}

const POLL_INTERVAL_MS = 45_000

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined)

/**
 * Uma única instância para o app todo: o sino (TopBar) e a página de notificações
 * compartilham o mesmo estado e a mesma conexão em tempo real. Antes, cada um criava
 * a sua própria e as duas disputavam o mesmo canal do Supabase.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const userId = user?.id ?? null

  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Descarta respostas antigas (troca de usuário ou duas buscas em sequência).
  const requestId = useRef(0)

  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([])
      setUnreadCount(0)
      setError('')
      setLoading(false)
      return
    }

    const current = ++requestId.current

    const [listRes, countRes] = await Promise.all([
      supabase
        .from('notifications')
        .select(`
          *,
          actor:profiles!notifications_actor_id_fkey(*)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(40),
      supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('read', false),
    ])

    if (current !== requestId.current) return

    if (listRes.error) {
      console.error('Error loading notifications:', listRes.error.message)
      setError('Não foi possível carregar as notificações.')
      setLoading(false)
      return
    }

    setNotifications((listRes.data as NotificationItem[]) ?? [])
    setUnreadCount(countRes.count ?? 0)
    setError('')
    setLoading(false)
  }, [userId])

  const markAllRead = useCallback(async () => {
    if (!userId) return

    const { error: updateError } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)

    if (updateError) {
      console.error('Error marking notifications as read:', updateError.message)
      return
    }

    setUnreadCount(0)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [userId])

  // Carga inicial (e ao trocar de usuário).
  useEffect(() => {
    setLoading(true)
    void fetchNotifications()
  }, [fetchNotifications])

  // Tempo real + plano B: o canal só dispara se a tabela estiver na publicação
  // "supabase_realtime" (ver migração), então também atualizamos periodicamente
  // e ao voltar para a aba.
  useEffect(() => {
    if (!userId) return

    // Nome único por inscrição: evita reaproveitar um canal já inscrito
    // (o que lança erro no StrictMode e em remontagens rápidas).
    const channel = supabase
      .channel(`notifications-${userId}-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        () => {
          void fetchNotifications()
        },
      )
      .subscribe()

    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void fetchNotifications()
    }, POLL_INTERVAL_MS)

    const onVisible = () => {
      if (document.visibilityState === 'visible') void fetchNotifications()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      void supabase.removeChannel(channel)
    }
  }, [userId, fetchNotifications])

  const value = useMemo<NotificationsContextValue>(
    () => ({
      unreadCount,
      notifications,
      loading,
      error,
      fetchNotifications,
      markAllRead,
      refresh: fetchNotifications,
    }),
    [unreadCount, notifications, loading, error, fetchNotifications, markAllRead],
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useNotifications() {
  const context = useContext(NotificationsContext)
  if (!context) throw new Error('useNotifications must be used within NotificationsProvider')
  return context
}
