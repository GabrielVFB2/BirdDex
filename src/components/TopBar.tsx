import { Link, useNavigate } from 'react-router-dom'
import { Bell, Bird } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
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

  if (showLogo) {
    return (
      <header className="topbar topbar-logo">
        <div className="topbar-brand">
          <div className="topbar-logo-icon">
            <Bird size={24} />
          </div>
          <h1 className="topbar-brand-name app-title">Pio</h1>
        </div>
        <div className="topbar-actions">
          {showBell && (
            <button className="btn-icon topbar-bell" aria-label="Notificações">
              <Bell size={20} />
              <span className="topbar-bell-dot" />
            </button>
          )}
          {profile && (
            <Link to={`/profile/${profile.id}`}>
              <div className="topbar-user-avatar" />
            </Link>
          )}
        </div>
      </header>
    )
  }

  return (
    <header className="topbar">
      {showBack && (
        <button className="btn-icon topbar-back" onClick={() => navigate(-1)} aria-label="Voltar">
          <span className="topbar-back-arrow">‹</span>
        </button>
      )}
      <h2 className="topbar-title">{title}</h2>
      {showBell && (
        <button className="btn-icon topbar-bell" aria-label="Notificações">
          <Bell size={20} />
        </button>
      )}
    </header>
  )
}
