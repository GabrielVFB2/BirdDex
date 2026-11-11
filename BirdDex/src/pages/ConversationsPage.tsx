import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, MessageCircle, Send } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import TopBar from '@/components/TopBar'
import Avatar from '@/components/Avatar'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { Profile } from '@/types'
import { createNotification } from '@/lib/notifications'
import './ConversationsPage.css'

interface Message {
  id: string
  sender_id: string
  recipient_id: string
  content: string
  created_at: string
  sender?: Profile
  recipient?: Profile
}

interface ConversationPreview {
  profile: Profile
  message: Message
}

export default function ConversationsPage() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const selectedProfileId = searchParams.get('with')
  const [messages, setMessages] = useState<Message[]>([])
  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null)
  const [messageText, setMessageText] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const fetchMessages = useCallback(async () => {
    if (!user) return

    setLoading(true)
    const { data, error: fetchError } = await supabase
      .from('messages')
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey(*),
        recipient:profiles!messages_recipient_id_fkey(*)
      `)
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('created_at', { ascending: true })

    if (fetchError) {
      setError('Não conseguimos carregar suas conversas. Verifique sua rede.')
    } else {
      setMessages((data as Message[]) ?? [])
      setError('')
    }
    setLoading(false)
  }, [user])

  const fetchSelectedProfile = useCallback(async () => {
    if (!selectedProfileId || !user || selectedProfileId === user.id) {
      setSelectedProfile(null)
      return
    }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', selectedProfileId)
      .maybeSingle()

    setSelectedProfile((data as Profile | null) ?? null)
  }, [selectedProfileId, user])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  useEffect(() => {
    fetchSelectedProfile()
  }, [fetchSelectedProfile])

  const conversations = useMemo(() => {
    if (!user) return []

    const byProfile = new Map<string, ConversationPreview>()
    for (const message of messages) {
      const profile = message.sender_id === user.id ? message.recipient : message.sender
      if (profile) byProfile.set(profile.id, { profile, message })
    }

    return Array.from(byProfile.values()).sort(
      (a, b) => new Date(b.message.created_at).getTime() - new Date(a.message.created_at).getTime(),
    )
  }, [messages, user])

  const selectedMessages = useMemo(() => {
    if (!user || !selectedProfileId) return []
    return messages.filter(
      (message) =>
        (message.sender_id === user.id && message.recipient_id === selectedProfileId) ||
        (message.sender_id === selectedProfileId && message.recipient_id === user.id),
    )
  }, [messages, selectedProfileId, user])

  const handleSend = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !selectedProfileId || !messageText.trim() || sending) return

    setSending(true)
    const content = messageText.trim()
    const { data, error: insertError } = await supabase
      .from('messages')
      .insert({ recipient_id: selectedProfileId, content })
      .select(`
        *,
        sender:profiles!messages_sender_id_fkey(*),
        recipient:profiles!messages_recipient_id_fkey(*)
      `)
      .maybeSingle()

    if (insertError || !data) {
      setError('Não conseguimos enviar. Verifique sua rede e tente novamente.')
    } else {
      setMessages((current) => [...current, data as Message])
      setMessageText('')
      setError('')
      createNotification({ type: 'message', actorId: user.id, userId: selectedProfileId })
    }
    setSending(false)
  }

  const openConversation = (profileId: string) => {
    setSearchParams({ with: profileId })
  }

  return (
    <>
      <TopBar title="Conversas" showBell />
      <div className="conversations-content">
        {error && <div className="error-msg">{error}</div>}

        {selectedProfile ? (
          <section className="conversation-panel animate-fade-in">
            <button className="conversation-back" onClick={() => setSearchParams({})}>
              <ArrowLeft size={18} />
              Todas as conversas
            </button>
            <div className="conversation-heading">
              <Avatar profile={selectedProfile} size={42} />
              <div>
                <h2>{selectedProfile.display_name}</h2>
                <p>@{selectedProfile.username}</p>
              </div>
            </div>

            <div className="conversation-messages">
              {selectedMessages.length === 0 ? (
                <div className="conversation-empty">
                  <MessageCircle size={28} />
                  <p>Comece uma conversa com {selectedProfile.display_name}.</p>
                </div>
              ) : (
                selectedMessages.map((message) => (
                  <div key={message.id} className={`message-bubble ${message.sender_id === user?.id ? 'message-own' : ''}`}>
                    <p>{message.content}</p>
                    <span>{formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: ptBR })}</span>
                  </div>
                ))
              )}
            </div>

            <form className="message-form" onSubmit={handleSend}>
              <input
                className="form-input"
                placeholder="Escreva uma mensagem..."
                value={messageText}
                onChange={(event) => setMessageText(event.target.value)}
                disabled={sending}
                maxLength={2000}
              />
              <button className="message-send" type="submit" disabled={!messageText.trim() || sending} aria-label="Enviar mensagem">
                <Send size={18} />
              </button>
            </form>
          </section>
        ) : (
          <section className="conversation-list animate-fade-in">
            <div className="conversation-list-header">
              <div>
                <p className="conversation-kicker">COMUNIDADE BIRDDex</p>
                <h2>Suas conversas</h2>
              </div>
              <MessageCircle size={24} />
            </div>
            {loading ? (
              <div className="loading-container"><div className="spinner" /></div>
            ) : conversations.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><MessageCircle size={48} strokeWidth={1.5} /></div>
                <h3 className="conversations-empty-title">Nenhuma conversa ainda</h3>
                <p className="conversations-empty-text">Visite um perfil e toque em “Enviar mensagem” para começar.</p>
              </div>
            ) : (
              <div className="conversation-items">
                {conversations.map(({ profile, message }) => (
                  <button key={profile.id} className="conversation-item" onClick={() => openConversation(profile.id)}>
                    <Avatar profile={profile} size={46} />
                    <span className="conversation-item-body">
                      <strong>{profile.display_name}</strong>
                      <span>{message.content}</span>
                    </span>
                    <time>{formatDistanceToNow(new Date(message.created_at), { addSuffix: true, locale: ptBR })}</time>
                  </button>
                ))}
              </div>
            )}
          </section>
        )}

        {selectedProfileId && !selectedProfile && !loading && (
          <div className="empty-state">
            <p>Perfil não encontrado.</p>
            <Link to="/conversations" className="btn-secondary">Voltar para conversas</Link>
          </div>
        )}
      </div>
    </>
  )
}
