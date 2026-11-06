import { MessageCircle } from 'lucide-react'
import TopBar from '@/components/TopBar'
import './ConversationsPage.css'

export default function ConversationsPage() {
  return (
    <>
      <TopBar title="Conversas" showBell />
      <div className="conversations-content">
        <div className="empty-state">
          <div className="empty-state-icon">
            <MessageCircle size={48} strokeWidth={1.5} />
          </div>
          <h3 className="conversations-empty-title">Nenhuma conversa ainda</h3>
          <p className="conversations-empty-text">
            Em breve você poderá trocar mensagens com outros observadores de aves.
          </p>
        </div>
      </div>
    </>
  )
}
