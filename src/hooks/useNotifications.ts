import { useEffect, useState, useCallback } from 'react'
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

export function useNotifications() {
  const { user } = useAuth()
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)

  const fetchUnreadCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0)
      return
    }

    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('read', false)

    setUnreadCount(count ?? 0)
  }, [user])

  const fetchNotifications = useCallback(async () => {
    if (!user) return

    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select(`
        *,
        actor:profiles!notifications_actor_id_fkey(*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(40)

    setNotifications((data as NotificationItem[]) ?? [])
    setLoading(false)
  }, [user])

  const markAllRead = useCallback(async () => {
    if (!user) return

    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)

    setUnreadCount(0)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [user])

  useEffect(() => {
    fetchUnreadCount()
  }, [fetchUnreadCount])

  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          fetchUnreadCount()
          fetchNotifications()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, fetchUnreadCount, fetchNotifications])

  return { unreadCount, notifications, loading, fetchNotifications, markAllRead, refresh: fetchUnreadCount }
}
