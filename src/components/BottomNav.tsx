import { NavLink, useLocation } from 'react-router-dom'
import { Chrome as Home, Compass, ScanSearch, Plus, BookMarked, User } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import './BottomNav.css'

export function BottomNav() {
  const { profile } = useAuth()
  const location = useLocation()

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  const navItems = [
    { to: '/', label: 'Início', icon: Home, active: isActive('/') },
    { to: '/explore', label: 'Explorar', icon: Compass, active: isActive('/explore') },
    { to: '/identify', label: 'Identificar', icon: ScanSearch, active: isActive('/identify') },
    { to: '/new', label: 'Registrar', icon: Plus, active: isActive('/new'), accent: true },
    { to: '/colecao', label: 'Coleção', icon: BookMarked, active: isActive('/colecao') },
    { to: profile ? `/profile/${profile.id}` : '/signin', label: 'Perfil', icon: User, active: location.pathname.includes('/profile') },
  ]

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => {
        const Icon = item.icon
        return (
          <NavLink key={item.to} to={item.to} className={`nav-item ${item.active ? 'nav-item-active' : ''} ${item.accent ? 'nav-item-accent' : ''}`}>
            <div className={`nav-icon-wrapper ${item.accent ? 'nav-icon-accent' : ''}`}>
              <Icon size={22} strokeWidth={item.active ? 2.5 : 2} />
            </div>
            <span className="nav-label">{item.label}</span>
          </NavLink>
        )
      })}
    </nav>
  )
}
export default BottomNav;