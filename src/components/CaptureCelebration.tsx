import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Bird, Sparkles } from 'lucide-react'
import AchievementIcon from '@/components/AchievementIcon'
import RarityBadge from '@/components/RarityBadge'
import type { CaptureResult } from '@/types'
import './CaptureCelebration.css'

interface CaptureCelebrationProps {
  result: CaptureResult
  /** Foto da captura (data URL ou endereço), quando houver. */
  photoUrl?: string
  onClose: () => void
}

export default function CaptureCelebration({ result, photoUrl, onClose }: CaptureCelebrationProps) {
  const { species } = result

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!species) return null

  const isNew = result.status === 'captured'
  const dexLabel = `#${String(species.dex_number).padStart(3, '0')}`

  return (
    <div className="celebration-backdrop" onClick={onClose}>
      <div
        className="celebration animate-scale-in"
        role="dialog"
        aria-modal="true"
        aria-label={isNew ? 'Nova espécie capturada' : 'Espécie já capturada'}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="celebration-kicker">
          {isNew ? (
            <>
              <Sparkles size={16} /> Nova espécie capturada!
            </>
          ) : (
            'Já está na sua BirdDex'
          )}
        </p>

        <div className="celebration-photo">
          {photoUrl ? (
            <img src={photoUrl} alt={species.common_name} />
          ) : (
            <Bird size={56} strokeWidth={1.4} />
          )}
          <span className="celebration-number">{dexLabel}</span>
        </div>

        <h2 className="celebration-name app-title">{species.common_name}</h2>
        <p className="celebration-scientific">{species.scientific_name}</p>
        <div className="celebration-meta">
          <RarityBadge rarity={species.rarity} />
          <span className="celebration-group">{species.grupo}</span>
        </div>

        {result.captured_count !== undefined && result.dex_total !== undefined && (
          <p className="celebration-progress">
            {result.captured_count} de {result.dex_total} espécies na sua coleção
          </p>
        )}

        {result.new_achievements.length > 0 && (
          <div className="celebration-achievements">
            <p className="celebration-achievements-title">
              {result.new_achievements.length === 1 ? 'Conquista desbloqueada' : 'Conquistas desbloqueadas'}
            </p>
            {result.new_achievements.map((a) => (
              <div key={a.code} className={`celebration-achievement tier-${a.tier}`}>
                <span className="celebration-achievement-icon">
                  <AchievementIcon name={a.icon} />
                </span>
                <span className="celebration-achievement-text">
                  <strong>{a.title}</strong>
                  <small>{a.description}</small>
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="celebration-actions">
          <Link to="/colecao" className="btn-primary" onClick={onClose}>
            Ver minha BirdDex
          </Link>
          <button className="btn-secondary" onClick={onClose}>
            Continuar
          </button>
        </div>
      </div>
    </div>
  )
}
