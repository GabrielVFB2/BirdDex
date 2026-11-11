import { Heart, MessageCircle, UserPlus, Mail, Bird } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import TopBar from '@/components/TopBar'
import Avatar from '@/components/Avatar'
import { useNotifications } from '@/hooks/useNotifications'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import './NotificationsPage.css'

export default function NotificationsPage() {
  const { notifications, loading, error, markAllRead, fetchNotifications } = useNotifications()

  // Guarda quais notificações eram novas quando a página abriu, para continuarem
  // destacadas mesmo depois de marcadas como lidas.
  const [freshIds, setFreshIds] = useState<Set<string>>(() => new Set())

  // Atualiza a lista ao abrir a página.
  useEffect(() => {
    void fetchNotifications()
  }, [fetchNotifications])

  useEffect(() => {
    if (loading) return
    const unread = notifications.filter((n) => !n.read)
    if (unread.length === 0) return

    setFreshIds((prev) => new Set([...prev, ...unread.map((n) => n.id)]))
    void markAllRead()
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
      <TopBar title="Notificações" showBack showBell={false} />
      <div className="notifications-content">
        {loading ? (
          <div className="loading-container"><div className="spinner spinner-lg" /></div>
        ) : error && notifications.length === 0 ? (
          <div className="empty-state">
            <h3 className="notifications-empty-title">Algo deu errado</h3>
            <p className="notifications-empty-text">{error}</p>
            <button className="btn-secondary" onClick={() => void fetchNotifications()}>
              Tentar de novo
            </button>
          </div>
        ) : notifications.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Bird size={48} strokeWidth={1.5} /></div>
            <h3 className="notifications-empty-title">Tudo em dia</h3>
            <p className="notifications-empty-text">
              Quando alguém curtir, comentar, seguir ou enviar mensagem, o aviso aparece aqui.
            </p>
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
              const isFresh = !notification.read || freshIds.has(notification.id)

              return (
                <Link key={notification.id} to={link} className={`notification-item ${isFresh ? 'notification-unread' : ''}`}>
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
