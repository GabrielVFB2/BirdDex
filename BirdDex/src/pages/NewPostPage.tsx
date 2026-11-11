import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bird, Camera, X } from 'lucide-react'
import { usePostDraft } from '@/context/PostDraftContext'
import { useAuth } from '@/context/AuthContext'
import TopBar from '@/components/TopBar'
import './NewPostPage.css'

const MAX_CAPTION = 500

export default function NewPostPage() {
  const navigate = useNavigate()
  const { draft, updateDraft } = usePostDraft()
  const { profile } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      setError('A foto deve ter no máximo 5 MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      updateDraft({ imageDataUrl: reader.result as string })
      setError('')
    }
    reader.readAsDataURL(file)
  }

  const handleRemovePhoto = () => {
    updateDraft({ imageDataUrl: null })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleCaptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value.slice(0, MAX_CAPTION)
    updateDraft({ caption: value })
  }

  const handleReview = () => {
    if (!draft.imageDataUrl && !draft.caption.trim()) {
      setError('Adicione uma foto e uma legenda para continuar.')
      return
    }
    if (!draft.caption.trim()) {
      setError('Conte o que você observou.')
      return
    }
    navigate('/new/review')
  }

  const handleCancel = () => {
    updateDraft({
      imageDataUrl: null,
      caption: '',
      location: '',
      speciesName: '',
      speciesScientific: '',
    })
    navigate('/')
  }

  return (
    <>
      <TopBar title="Nova publicação" showBack showBell={false} />
      <div className="new-post-content">
        <div className="new-post-steps">
          <span className="new-post-step new-post-step-active">1. Criar</span>
          <span className="new-post-step new-post-step-next">2. Revisar</span>
          <span className="new-post-step new-post-step-next">3. Publicar</span>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <div className="new-post-section">
          <label className="new-post-label">Foto da ave *</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="new-post-file-input"
          />
          {draft.imageDataUrl ? (
            <div className="new-post-photo-preview">
              <img src={draft.imageDataUrl} alt="Prévia da foto" className="new-post-photo-img" />
              <div className="new-post-photo-actions">
                <button className="new-post-photo-action" onClick={() => fileInputRef.current?.click()}>
                  Trocar foto
                </button>
                <button className="new-post-photo-action new-post-photo-remove" onClick={handleRemovePhoto}>
                  Remover
                </button>
              </div>
            </div>
          ) : (
            <button className="new-post-photo-upload" onClick={() => fileInputRef.current?.click()}>
              <Camera size={32} strokeWidth={1.5} />
              <span>Adicionar foto da ave</span>
            </button>
          )}
        </div>

        <div className="new-post-section">
          <label className="new-post-label">O que você observou? *</label>
          <textarea
            className="form-textarea new-post-caption"
            value={draft.caption}
            onChange={handleCaptionChange}
            placeholder="Ex: Um bem-te-vi na pausa do café. Quem mais ouviu esse canto hoje?"
            maxLength={MAX_CAPTION}
          />
          <span className="new-post-char-count">{draft.caption.length} / {MAX_CAPTION} caracteres</span>
        </div>

        <div className="new-post-section">
          <label className="new-post-label">Espécie (opcional)</label>
          <input
            type="text"
            className="form-input"
            value={draft.speciesName}
            onChange={(e) => updateDraft({ speciesName: e.target.value })}
            placeholder="Nome comum, ex: Sabiá-laranjeira"
          />
        </div>

        <div className="new-post-section">
          <label className="new-post-label">Nome científico (opcional)</label>
          <input
            type="text"
            className="form-input"
            value={draft.speciesScientific}
            onChange={(e) => updateDraft({ speciesScientific: e.target.value })}
            placeholder="Ex: Turdus rufiventris"
          />
        </div>

        <div className="new-post-section">
          <label className="new-post-label">Localização (opcional)</label>
          <input
            type="text"
            className="form-input"
            value={draft.location}
            onChange={(e) => updateDraft({ location: e.target.value })}
            placeholder="Ex: São Paulo, SP"
          />
        </div>

        <p className="new-post-note">
          Visível para toda a comunidade.<br />
          * Campos obrigatórios.
        </p>
      </div>

      <div className="new-post-actions">
        <button className="btn-primary" onClick={handleReview}>
          Revisar publicação →
        </button>
        <button className="btn-secondary" onClick={handleCancel}>
          Cancelar
        </button>
      </div>
    </>
  )
}
