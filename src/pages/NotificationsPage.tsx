import { Heart, MessageCircle, UserPlus, Mail, Bird } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import TopBar from '@/components/TopBar'
import Avatar from '@/components/Avatar'
import { useNotifications } from '@/hooks/useNotifications'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import './NotificationsPage.css'

export default function NotificationsPage() {
  const { notifications, loading, markAllRead, fetchNotifications } = useNotifications()
  const didFetch = useRef(false)
  const didMark = useRef(false)

  useEffect(() => {
    if (didFetch.current) return
    didFetch.current = true
    fetchNotifications()
  }, [fetchNotifications])

  useEffect(() => {
    if (loading || didMark.current) return
    if (notifications.length > 0 && notifications.some((n) => !n.read)) {
      didMark.current = true
      markAllRead()
    }
  }, [notifications, loading, markAllRead])

  const iconFor = (type: string) => {
    switch (type) {
      case 'like':
        return <Heart size={18} fill="currentColor" />
      case 'comment':
        return <MessageCircle size={18} />
      case 'follow':
        return <UserPlus size={18} />
      case 'message':
        return <Mail size={18} />
      default:
        return <Bird size={18} />
    }
  }

  const labelFor = (type: string, name: string) => {
    switch (type) {
      case 'like':
        return `${name} curtiu sua publicação`
      case 'comment':
        return `${name} comentou na sua publicação`
      case 'follow':
        return `${name} começou a seguir você`
      case 'message':
        return `${name} enviou uma mensagem`
      default:
        return `${name} interagiu com você`
    }
  }

  return (
    <>
      <TopBar title="Notificações" showBell={false} />
      <div className="notifications-content">
        {loading ? (
          <div className="loading-container"><div className="spinner spinner-lg" /></div>
        ) : notifications.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Bird size={48} strokeWidth={1.5} /></div>
            <h3 className="notifications-empty-title">Tudo em dia</h3>
            <p className="notifications-empty-text">Você não tem novas notificações. Suas preferências foram carregadas.</p>
          </div>
        ) : (
          <div className="notifications-list animate-fade-in">
            {notifications.map((notification) => {
              const actor = notification.actor
              const name = actor?.display_name || 'Observador'
              const link =
                notification.type === 'follow'
                  ? `/profile/${notification.actor_id}`
                  : notification.type === 'message'
                    ? `/conversations?with=${notification.actor_id}`
                    : notification.post_id
                      ? `/post/${notification.post_id}`
                      : `/profile/${notification.actor_id}`

              return (
                <Link key={notification.id} to={link} className={`notification-item ${notification.read ? '' : 'notification-unread'}`}>
                  <div className={`notification-icon notification-icon-${notification.type}`}>
                    {iconFor(notification.type)}
                  </div>
                  <div className="notification-body">
                    <Avatar profile={actor} size={36} />
                    <div className="notification-text">
                      <p>{labelFor(notification.type, name)}</p>
                      <time>{formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: ptBR })}</time>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
