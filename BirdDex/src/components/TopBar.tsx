import { Link, useNavigate } from 'react-router-dom'
import { Bell, Bird } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useNotifications } from '@/hooks/useNotifications'
import Avatar from './Avatar'
import './TopBar.css'

interface TopBarProps {
  title?: string
  showLogo?: boolean
  showBack?: boolean
  showBell?: boolean
}

export default function TopBar({ title, showLogo = false, showBack = false, showBell = true }: TopBarProps) {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { unreadCount } = useNotifications()

  return (
    <header className={`topbar ${showLogo ? 'topbar-logo' : ''}`}>
      {showLogo ? (
        <Link to="/" className="topbar-brand">
          <Bird size={25} strokeWidth={1.6} />
          <h1 className="topbar-brand-name app-title">BirdDex</h1>
        </Link>
      ) : (
        <>
          {showBack && (
            <button className="btn-icon topbar-back" onClick={() => navigate(-1)} aria-label="Voltar">‹</button>
          )}
          <h2 className="topbar-title">{title}</h2>
        </>
      )}
      <div className="topbar-actions">
        {showBell && (
          <Link to="/notifications" className="btn-icon topbar-bell" aria-label="Notificações">
            <Bell size={18} strokeWidth={1.7} />
            {unreadCount > 0 && <span className="topbar-bell-count">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </Link>
        )}
        {showLogo && profile && (
          <Link to={`/profile/${profile.id}`} aria-label="Abrir perfil">
            <Avatar profile={profile} size={32} />
          </Link>
        )}
      </div>
    </header>
  )
}
