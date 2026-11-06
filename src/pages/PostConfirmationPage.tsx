import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Check, Bird } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import TopBar from '@/components/TopBar'
import './PostConfirmationPage.css'

interface PublishedPost {
  id: string
  caption: string
  location: string
  speciesName: string
  imageUrl: string
}

export default function PostConfirmationPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { profile } = useAuth()
  const publishedPost = (location.state as { publishedPost?: PublishedPost } | null)?.publishedPost

  if (!publishedPost) {
    navigate('/')
    return null
  }

  return (
    <>
      <TopBar title="Publicação enviada" showLogo showBell={false} />
      <div className="confirmation-content">
        <div className="new-post-steps">
          <span className="new-post-step new-post-step-done">
            <Check size={13} /> Criar
          </span>
          <span className="new-post-step new-post-step-done">
            <Check size={13} /> Revisar
          </span>
          <span className="new-post-step new-post-step-done">
            <Check size={13} /> Publicar
          </span>
        </div>

        <div className="confirmation-message animate-scale-in">
          <div className="confirmation-icon">
            <Check size={36} strokeWidth={3} />
          </div>
          <h1 className="confirmation-title app-title">Seu registro está no ar!</h1>
          <p className="confirmation-text">
            {publishedPost.speciesName
              ? `O ${publishedPost.speciesName} já pode ser visto por toda a comunidade.`
              : 'Sua publicação já pode ser vista por toda a comunidade.'}
          </p>
        </div>

        <div className="confirmation-summary">
          {publishedPost.imageUrl ? (
            <img src={publishedPost.imageUrl} alt="Foto publicada" className="confirmation-summary-img" />
          ) : (
            <div className="confirmation-summary-placeholder">
              <Bird size={32} strokeWidth={1.5} />
            </div>
          )}
          <p className="confirmation-summary-caption">{publishedPost.caption}</p>
          <p className="confirmation-summary-meta">
            {profile?.display_name || 'Você'}
            {publishedPost.location ? ` · ${publishedPost.location}` : ''} · Agora
          </p>
        </div>
      </div>

      <div className="confirmation-actions">
        <Link to={`/post/${publishedPost.id}`} className="btn-primary">
          Ver publicação →
        </Link>
        <Link to="/" className="btn-secondary">
          Voltar ao feed
        </Link>
      </div>
    </>
  )
}
