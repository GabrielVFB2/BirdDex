import { ChangeEvent, FormEvent, useEffect, useState } from 'react'
import { Camera, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import Avatar from '@/components/Avatar'
import type { Profile } from '@/types'
import './EditProfileModal.css'

interface EditProfileModalProps {
  open: boolean
  onClose: () => void
  profile: Profile
}

export default function EditProfileModal({ open, onClose, profile }: EditProfileModalProps) {
  const { user, refreshProfile } = useAuth()
  const [displayName, setDisplayName] = useState(profile.display_name || '')
  const [bio, setBio] = useState(profile.bio || '')
  const [location, setLocation] = useState(profile.location || '')
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url || '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setDisplayName(profile.display_name || '')
      setBio(profile.bio || '')
      setLocation(profile.location || '')
      setAvatarUrl(profile.avatar_url || '')
      setError('')
    }
  }, [open, profile])

  if (!open) return null

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !user) return

    if (file.size > 2 * 1024 * 1024) {
      setError('A imagem precisa ter no máximo 2 MB.')
      return
    }

    setUploading(true)
    setError('')

    const ext = file.name.split('.').pop()?.toLowerCase() || 'png'
    const path = `${user.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { upsert: true, contentType: file.type })

    if (uploadError) {
      setError('Não foi possível salvar a imagem. Tente novamente.')
      setUploading(false)
      return
    }

    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    setAvatarUrl(data.publicUrl)
    setUploading(false)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || saving) return

    setSaving(true)
    setError('')

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        display_name: displayName.trim() || profile.username,
        bio: bio.trim(),
        location: location.trim(),
        avatar_url: avatarUrl,
      })
      .eq('id', user.id)

    if (updateError) {
      setError('Não foi possível salvar. Tente novamente.')
      setSaving(false)
      return
    }

    await refreshProfile()
    setSaving(false)
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card edit-profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title app-title">Editar perfil</h2>
          <button className="btn-icon" onClick={onClose} aria-label="Fechar">
            <X size={20} />
          </button>
        </div>

        <form className="edit-profile-form" onSubmit={handleSubmit}>
          <label className="edit-avatar-picker">
            <Avatar profile={{ ...profile, avatar_url: avatarUrl }} size={84} className="avatar-lg" />
            <span className="edit-avatar-button"><Camera size={18} /> Trocar foto</span>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleAvatarChange} disabled={uploading || saving} hidden />
          </label>

          <div className="form-group">
            <label className="form-label" htmlFor="display-name">Nome de exibição</label>
            <input
              id="display-name"
              className="form-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={40}
              disabled={saving}
              placeholder="Como quer ser chamado"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="bio">Bio</label>
            <textarea
              id="bio"
              className="form-textarea"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              maxLength={160}
              disabled={saving}
              placeholder="Conte um pouco sobre você"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="location">Localização</label>
            <input
              id="location"
              className="form-input"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              maxLength={60}
              disabled={saving}
              placeholder="Cidade, estado"
            />
          </div>

          {error && <div className="error-msg">{error}</div>}

          <button type="submit" className="btn-primary" disabled={saving || uploading}>
            {saving ? 'Salvando...' : 'Pronto!'}
          </button>
        </form>
      </div>
    </div>
  )
}
