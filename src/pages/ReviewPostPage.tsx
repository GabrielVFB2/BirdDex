import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bird, Check, Heart, MessageCircle, Bookmark } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { usePostDraft } from '@/context/PostDraftContext'
import TopBar from '@/components/TopBar'
import Avatar from '@/components/Avatar'
import { captureBird } from '@/lib/collection'
import type { CaptureResult } from '@/types'
import './ReviewPostPage.css'

export default function ReviewPostPage() {
  const navigate = useNavigate()
  const { draft, resetDraft } = usePostDraft()
  const { profile, user } = useAuth()
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState('')

  if (!draft.caption.trim() && !draft.imageDataUrl) {
    navigate('/new')
    return null
  }

  const handlePublish = async () => {
    setPublishing(true)
    setError('')

    let imageUrl = ''

    if (draft.imageDataUrl) {
      const fileName = `${user!.id}/${crypto.randomUUID()}.jpg`
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('posts')
        .upload(fileName, dataUrlToBlob(draft.imageDataUrl), {
          contentType: 'image/jpeg',
        })

      if (uploadError) {
        setError('Não foi possível enviar a foto. Tente novamente.')
        setPublishing(false)
        return
      }

      const { data: urlData } = supabase.storage
        .from('posts')
        .getPublicUrl(uploadData.path)

      imageUrl = urlData.publicUrl
    }

    const { data: postData, error: insertError } = await supabase
      .from('posts')
      .insert({
        image_url: imageUrl,
        caption: draft.caption.trim(),
        location: draft.location.trim(),
        species_name: draft.speciesName.trim(),
        species_scientific: draft.speciesScientific.trim(),
      })
      .select('id')
      .single()

    if (insertError) {
      setError('Não foi possível publicar. Tente novamente.')
      setPublishing(false)
      return
    }

    // Publicar uma ave com a espécie preenchida também a captura para a BirdDex.
    // É um bônus: se falhar, a publicação continua valendo.
    let capture: CaptureResult | null = null
    if (draft.speciesName.trim() || draft.speciesScientific.trim()) {
      try {
        capture = await captureBird({
          scientificName: draft.speciesScientific.trim(),
          commonName: draft.speciesName.trim(),
          photoUrl: imageUrl,
          location: draft.location.trim(),
        })
      } catch {
        capture = null
      }
    }

    const publishedPost = {
      id: postData.id,
      caption: draft.caption,
      location: draft.location,
      speciesName: draft.speciesName,
      imageUrl,
    }

    resetDraft()
    navigate('/new/confirmation', { state: { publishedPost, capture } })
  }

  const handleEdit = () => {
    navigate('/new')
  }

  return (
    <>
      <TopBar title="Revisar publicação" showBack showBell={false} />
      <div className="review-content">
        <div className="new-post-steps">
          <span className="new-post-step new-post-step-done">
            <Check size={13} /> Criar
          </span>
          <span className="new-post-step new-post-step-active">2. Revisar</span>
          <span className="new-post-step new-post-step-next">3. Publicar</span>
        </div>

        <div className="review-intro">
          <h2 className="review-intro-title app-title">Está tudo certo?</h2>
          <p className="review-intro-text">
            Veja como seu registro vai aparecer no feed da comunidade.
          </p>
        </div>

        {error && <div className="error-msg">{error}</div>}

        <div className="review-preview-card">
          <p className="review-preview-badge">PRÉVIA · AINDA NÃO PUBLICADA</p>

          <div className="post-header">
            <div className="post-author">
              <Avatar profile={profile} size={38} />
              <div className="post-author-info">
                <span className="post-author-name">
                  {profile?.display_name || 'Você'} · Você
                </span>
                <span className="post-author-meta">
                  {draft.location ? `${draft.location} · ` : ''}Agora
                </span>
              </div>
            </div>
          </div>

          {draft.imageDataUrl ? (
            <img src={draft.imageDataUrl} alt="Prévia" className="post-image" />
          ) : (
            <div className="post-image-placeholder">
              <Bird size={48} strokeWidth={1.5} />
              <span>{draft.speciesName ? `[ Foto de ${draft.speciesName} ]` : '[ Sem foto ]'}</span>
            </div>
          )}

          {draft.speciesName && (
            <div className="post-species">
              <div>
                <h3 className="post-species-name app-title">{draft.speciesName}</h3>
                {draft.speciesScientific && (
                  <p className="post-species-scientific">{draft.speciesScientific}</p>
                )}
              </div>
            </div>
          )}

          <div className="post-actions">
            <div className="post-action">
              <Heart size={22} />
              <span>0</span>
            </div>
            <div className="post-action">
              <MessageCircle size={22} />
              <span>0</span>
            </div>
            <div className="post-action post-action-right">
              <Bookmark size={22} />
            </div>
          </div>

          {draft.caption && (
            <p className="post-caption">
              <span className="post-caption-author">
                {profile?.username ? `@${profile.username}` : ''}
              </span>
              {' '}
              {draft.caption}
            </p>
          )}
        </div>

        <p className="review-visibility">
          Visibilidade: toda a comunidade<br />
          {draft.location && `Localização: ${draft.location}`}
        </p>
      </div>

      <div className="new-post-actions">
        <button className="btn-primary" onClick={handlePublish} disabled={publishing}>
          {publishing ? 'Publicando...' : 'Publicar'}
        </button>
        <button className="btn-secondary" onClick={handleEdit} disabled={publishing}>
          Editar publicação
        </button>
      </div>
    </>
  )
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(',')
  const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg'
  const binary = atob(base64)
  const arr = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i)
  }
  return new Blob([arr], { type: mime })
}
