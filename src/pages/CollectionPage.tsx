import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Bird, Lock, MapPin, Search, X } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import TopBar from '@/components/TopBar'
import RarityBadge from '@/components/RarityBadge'
import AchievementIcon from '@/components/AchievementIcon'
import { useAuth } from '@/context/AuthContext'
import { achievementProgress, fetchCollection, RARITY_LABEL, type CollectionData } from '@/lib/collection'
import type { BirdSpecies, Rarity } from '@/types'
import './CollectionPage.css'

type Tab = 'especies' | 'conquistas'
type StatusFilter = 'todas' | 'capturadas' | 'faltam'
type RarityFilter = 'todas' | Rarity

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'capturadas', label: 'Capturadas' },
  { value: 'faltam', label: 'Faltam' },
]

const RARITY_OPTIONS: RarityFilter[] = ['todas', 'comum', 'incomum', 'raro', 'lendario']

const normalize = (text: string) =>
  text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const dexLabel = (n: number) => `#${String(n).padStart(3, '0')}`

const formatDate = (iso: string) => format(new Date(iso), "d 'de' MMMM 'de' yyyy", { locale: ptBR })

export function CollectionPage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const targetId = id ?? user?.id ?? ''
  const isOwn = !id || id === user?.id

  const [data, setData] = useState<CollectionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<Tab>('especies')
  const [status, setStatus] = useState<StatusFilter>('todas')
  const [rarity, setRarity] = useState<RarityFilter>('todas')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<BirdSpecies | null>(null)

  const load = useCallback(async () => {
    if (!targetId) return
    setLoading(true)
    setError('')
    try {
      setData(await fetchCollection(targetId))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar a coleção.')
    } finally {
      setLoading(false)
    }
  }, [targetId])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!selected) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelected(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selected])

  const species = data?.species ?? []
  const achievements = data?.achievements ?? []

  const captureBySpecies = useMemo(
    () => new Map((data?.captures ?? []).map((c) => [c.species_id, c] as const)),
    [data],
  )
  const unlockedAt = useMemo(
    () => new Map((data?.unlocked ?? []).map((u) => [u.achievement_code, u.unlocked_at] as const)),
    [data],
  )
  const capturedSpecies = useMemo(
    () => species.filter((s) => captureBySpecies.has(s.id)),
    [species, captureBySpecies],
  )

  const visible = useMemo(() => {
    const q = normalize(query.trim())
    const digits = q.replace(/\D/g, '')
    return species.filter((s) => {
      const captured = captureBySpecies.has(s.id)
      if (status === 'capturadas' && !captured) return false
      if (status === 'faltam' && captured) return false
      if (rarity !== 'todas' && s.rarity !== rarity) return false
      if (!q) return true
      // Espécies ainda não capturadas são um mistério: só dá para achá-las pelo número.
      const byName = captured && normalize(`${s.common_name} ${s.scientific_name}`).includes(q)
      const byNumber = digits !== '' && String(s.dex_number).padStart(3, '0').includes(digits)
      return byName || byNumber
    })
  }, [species, captureBySpecies, status, rarity, query])

  const percent = species.length > 0 ? Math.round((capturedSpecies.length / species.length) * 100) : 0
  const selectedCapture = selected ? captureBySpecies.get(selected.id) : undefined

  const title = isOwn ? 'Minha BirdDex' : data?.ownerName ? `BirdDex de ${data.ownerName}` : 'BirdDex'

  return (
    <>
      <TopBar title={title} showBack={!isOwn} showBell={isOwn} />
      <div className="collection-content">
        {loading ? (
          <div className="loading-container">
            <div className="spinner spinner-lg" />
          </div>
        ) : error ? (
          <div className="empty-state">
            <p className="collection-empty-text">{error}</p>
            <button className="btn-secondary" onClick={() => void load()}>
              Tentar de novo
            </button>
          </div>
        ) : (
          <>
            <section className="dex-summary" aria-label="Progresso da coleção">
              <div className="dex-summary-top">
                <p className="dex-summary-count">
                  {capturedSpecies.length}
                  <span className="dex-summary-total"> / {species.length}</span>
                </p>
                <span className="dex-summary-percent">{percent}%</span>
              </div>
              <p className="dex-summary-label">espécies capturadas</p>
              <div
                className="dex-progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={species.length}
                aria-valuenow={capturedSpecies.length}
              >
                <div style={{ width: `${percent}%` }} />
              </div>
              <p className="dex-summary-sub">
                {unlockedAt.size} de {achievements.length} conquistas desbloqueadas
              </p>
            </section>

            <div className="dex-tabs" role="tablist">
              <button
                role="tab"
                aria-selected={tab === 'especies'}
                className={`dex-tab ${tab === 'especies' ? 'dex-tab-active' : ''}`}
                onClick={() => setTab('especies')}
              >
                Espécies
              </button>
              <button
                role="tab"
                aria-selected={tab === 'conquistas'}
                className={`dex-tab ${tab === 'conquistas' ? 'dex-tab-active' : ''}`}
                onClick={() => setTab('conquistas')}
              >
                Conquistas
              </button>
            </div>

            {tab === 'especies' ? (
              <>
                {isOwn && capturedSpecies.length === 0 && (
                  <div className="dex-hint">
                    <Bird size={28} strokeWidth={1.5} />
                    <div>
                      <strong>Sua BirdDex está vazia.</strong>
                      <p>Aponte a câmera para uma ave e toque em “Capturar” para desbloquear a primeira espécie.</p>
                    </div>
                    <Link to="/identify" className="btn-primary dex-hint-btn">
                      Identificar uma ave
                    </Link>
                  </div>
                )}

                <label className="dex-search">
                  <Search size={16} />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar espécie capturada ou número"
                    aria-label="Buscar na coleção"
                  />
                </label>

                <div className="dex-filters" role="group" aria-label="Filtrar por situação">
                  {STATUS_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      className={`dex-chip ${status === o.value ? 'dex-chip-active' : ''}`}
                      aria-pressed={status === o.value}
                      onClick={() => setStatus(o.value)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
                <div className="dex-filters" role="group" aria-label="Filtrar por raridade">
                  {RARITY_OPTIONS.map((r) => (
                    <button
                      key={r}
                      className={`dex-chip ${rarity === r ? 'dex-chip-active' : ''}`}
                      aria-pressed={rarity === r}
                      onClick={() => setRarity(r)}
                    >
                      {r === 'todas' ? 'Todas raridades' : RARITY_LABEL[r]}
                    </button>
                  ))}
                </div>

                {visible.length === 0 ? (
                  <p className="collection-empty-text">Nenhuma espécie encontrada com esses filtros.</p>
                ) : (
                  <div className="dex-grid">
                    {visible.map((s) => {
                      const capture = captureBySpecies.get(s.id)
                      return (
                        <button
                          key={s.id}
                          className={`dex-card dex-rarity-${s.rarity} ${capture ? 'dex-card-captured' : 'dex-card-locked'}`}
                          onClick={() => setSelected(s)}
                          aria-label={capture ? `${dexLabel(s.dex_number)} ${s.common_name}` : `${dexLabel(s.dex_number)} espécie não capturada`}
                        >
                          <span className="dex-card-number">{dexLabel(s.dex_number)}</span>
                          <span className="dex-card-image">
                            {capture ? (
                              capture.photo_url ? (
                                <img src={capture.photo_url} alt="" loading="lazy" />
                              ) : (
                                <Bird size={30} strokeWidth={1.5} />
                              )
                            ) : (
                              <Lock size={24} strokeWidth={1.6} />
                            )}
                          </span>
                          <span className="dex-card-name">{capture ? s.common_name : '???'}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            ) : (
              <ul className="achievement-list">
                {achievements.map((a) => {
                  const unlocked = unlockedAt.get(a.code)
                  const progress = Math.min(achievementProgress(a, capturedSpecies), a.threshold)
                  return (
                    <li
                      key={a.code}
                      className={`achievement tier-${a.tier} ${unlocked ? 'achievement-unlocked' : 'achievement-locked'}`}
                    >
                      <span className="achievement-icon">
                        {unlocked ? <AchievementIcon name={a.icon} /> : <Lock size={20} />}
                      </span>
                      <div className="achievement-body">
                        <strong className="achievement-title">{a.title}</strong>
                        <p className="achievement-desc">{a.description}</p>
                        {unlocked ? (
                          <small className="achievement-date">Desbloqueada em {formatDate(unlocked)}</small>
                        ) : (
                          <div className="achievement-progress">
                            <div className="dex-progress dex-progress-sm">
                              <div style={{ width: `${(progress / a.threshold) * 100}%` }} />
                            </div>
                            <small>
                              {progress}/{a.threshold}
                            </small>
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </div>

      {selected && (
        <div className="dex-sheet-backdrop" onClick={() => setSelected(null)}>
          <div
            className="dex-sheet animate-fade-in-up"
            role="dialog"
            aria-modal="true"
            aria-label={selectedCapture ? selected.common_name : 'Espécie não capturada'}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="btn-icon dex-sheet-close" onClick={() => setSelected(null)} aria-label="Fechar">
              <X size={18} />
            </button>

            <div className={`dex-sheet-image ${selectedCapture ? '' : 'dex-sheet-image-locked'}`}>
              {selectedCapture ? (
                selectedCapture.photo_url ? (
                  <img src={selectedCapture.photo_url} alt={selected.common_name} />
                ) : (
                  <Bird size={56} strokeWidth={1.4} />
                )
              ) : (
                <Lock size={40} strokeWidth={1.5} />
              )}
            </div>

            <p className="dex-sheet-number">{dexLabel(selected.dex_number)}</p>
            <h3 className="dex-sheet-name app-title">
              {selectedCapture ? selected.common_name : 'Espécie desconhecida'}
            </h3>
            {selectedCapture && <p className="dex-sheet-scientific">{selected.scientific_name}</p>}

            <div className="dex-sheet-meta">
              <RarityBadge rarity={selected.rarity} />
              <span>{selected.grupo}</span>
            </div>

            {selectedCapture ? (
              <div className="dex-sheet-info">
                <p>Capturada em {formatDate(selectedCapture.captured_at)}</p>
                {selectedCapture.location && (
                  <p className="dex-sheet-location">
                    <MapPin size={14} /> {selectedCapture.location}
                  </p>
                )}
              </div>
            ) : (
              <div className="dex-sheet-info">
                <p>
                  Ainda não capturada. Procure uma ave do grupo “{selected.grupo}” e aponte a câmera para tentar
                  desbloqueá-la.
                </p>
                {isOwn && (
                  <Link to="/identify" className="btn-primary dex-sheet-cta" onClick={() => setSelected(null)}>
                    Abrir a câmera
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  )
}

export default CollectionPage
