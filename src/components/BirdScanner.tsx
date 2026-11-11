import { useCallback, useEffect, useRef, useState } from 'react'
import { X, Camera, RefreshCw, Check } from 'lucide-react'
import { identifyBird } from '@/lib/identifyBird'
import type { BirdIdentification } from '@/types'
import './BirdScanner.css'

interface BirdScannerProps {
  /** Só no modo "overlay" (tela cheia): fecha a câmera. */
  onClose?: () => void
  onUse: (result: BirdIdentification, photoDataUrl: string) => void
  /** "overlay" cobre a tela toda; "page" ocupa a área da página e mantém a navegação visível. */
  variant?: 'overlay' | 'page'
  /** Texto do botão que confirma o resultado. */
  useLabel?: string
}

const MAX_FRAME_SIDE = 1024
const AUTO_INTERVAL_MS = 3000
const AUTO_MAX_ATTEMPTS = 8

function confidenceLabel(c: number) {
  if (c >= 0.8) return 'alta'
  if (c >= 0.5) return 'média'
  return 'baixa'
}

export default function BirdScanner({ onClose, onUse, variant = 'overlay', useLabel = 'Usar no registro' }: BirdScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const autoAttemptsRef = useRef(0)

  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [busy, setBusy] = useState(false)
  const [auto, setAuto] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<BirdIdentification | null>(null)
  const [photo, setPhoto] = useState('')

  // Abre a câmera traseira e libera quando o componente sai da tela.
  useEffect(() => {
    let cancelled = false

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('Seu navegador não permite acessar a câmera (é preciso HTTPS ou localhost).')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play().catch(() => undefined)
        }
        setCameraReady(true)
      } catch {
        setCameraError('Não consegui acessar a câmera. Permita o acesso nas configurações do navegador.')
      }
    }

    void start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const captureFrame = useCallback((): { dataUrl: string; base64: string } | null => {
    const video = videoRef.current
    if (!video || !video.videoWidth || !video.videoHeight) return null

    const scale = Math.min(1, MAX_FRAME_SIDE / Math.max(video.videoWidth, video.videoHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.82)
    return { dataUrl, base64: dataUrl.split(',')[1] }
  }, [])

  const identify = useCallback(async () => {
    const frame = captureFrame()
    if (!frame) return

    setBusy(true)
    setError('')
    try {
      const res = await identifyBird(frame.base64)
      setResult(res)
      if (res.bird_found) setPhoto(frame.dataUrl)
    } catch (e) {
      setAuto(false)
      setError(e instanceof Error ? e.message : 'Falha ao identificar.')
    } finally {
      setBusy(false)
    }
  }, [captureFrame])

  const found = !!result?.bird_found

  // Modo automático: tenta de tempos em tempos até achar uma ave (com limite de tentativas).
  useEffect(() => {
    if (!auto || !cameraReady || busy || found) return
    if (autoAttemptsRef.current >= AUTO_MAX_ATTEMPTS) {
      setAuto(false)
      setError('Não consegui identificar nenhuma ave. Aproxime a câmera e toque no botão.')
      return
    }
    const timer = window.setTimeout(() => {
      autoAttemptsRef.current += 1
      void identify()
    }, AUTO_INTERVAL_MS)
    return () => window.clearTimeout(timer)
  }, [auto, cameraReady, busy, found, identify])

  const toggleAuto = () => {
    autoAttemptsRef.current = 0
    setError('')
    setAuto((a) => !a)
  }

  const retry = () => {
    setResult(null)
    setPhoto('')
    setError('')
    autoAttemptsRef.current = 0
  }

  return (
    <div
      className={`scanner ${variant === 'page' ? 'scanner-page' : ''}`}
      role={variant === 'page' ? 'region' : 'dialog'}
      aria-label="Identificar ave pela câmera"
    >
      <video ref={videoRef} className="scanner-video" playsInline muted autoPlay />

      <div className="scanner-top">
        {variant === 'overlay' && onClose && (
          <button className="scanner-close" onClick={onClose} aria-label="Fechar câmera">
            <X size={22} />
          </button>
        )}
        <span className="scanner-title">{variant === 'overlay' ? 'Identificar ave' : ''}</span>
        <label className="scanner-auto">
          <input type="checkbox" checked={auto} onChange={toggleAuto} disabled={!cameraReady || found} />
          <span>Automático</span>
        </label>
      </div>

      {!cameraError && !found && <div className={`scanner-reticle ${busy ? 'scanner-reticle-busy' : ''}`} />}

      {cameraError && (
        <div className="scanner-message">
          <p>{cameraError}</p>
          {onClose && <button className="btn-secondary" onClick={onClose}>Voltar</button>}
        </div>
      )}

      {!cameraError && (
        <div className="scanner-bottom">
          {found && result ? (
            <div className="scanner-result animate-fade-in-up">
              <h3 className="scanner-result-name app-title">{result.common_name}</h3>
              <p className="scanner-result-scientific">{result.scientific_name}</p>
              <div className="scanner-confidence">
                <div className="scanner-confidence-bar">
                  <div style={{ width: `${Math.round(result.confidence * 100)}%` }} />
                </div>
                <span>
                  Confiança {confidenceLabel(result.confidence)} ({Math.round(result.confidence * 100)}%)
                </span>
              </div>
              {result.alternatives.length > 0 && (
                <p className="scanner-result-notes">
                  Também pode ser: {result.alternatives.map((a) => a.common_name).join(', ')}
                </p>
              )}
              {result.notes && <p className="scanner-result-notes">{result.notes}</p>}
              <p className="scanner-disclaimer">Identificação feita por IA — confirme antes de publicar.</p>
              <div className="scanner-result-actions">
                <button className="btn-primary" onClick={() => onUse(result, photo)}>
                  <Check size={18} /> {useLabel}
                </button>
                <button className="btn-secondary" onClick={retry}>
                  <RefreshCw size={16} /> Tentar de novo
                </button>
              </div>
            </div>
          ) : (
            <>
              {error && <p className="scanner-hint scanner-hint-error">{error}</p>}
              {!error && result && !result.bird_found && (
                <p className="scanner-hint">
                  {result.notes || 'Não encontrei uma ave. Aproxime a câmera e melhore a luz.'}
                </p>
              )}
              {!error && !result && (
                <p className="scanner-hint">
                  {busy ? 'Identificando…' : 'Aponte a câmera para a ave e toque no botão.'}
                </p>
              )}
              <button
                className="scanner-shutter"
                onClick={() => void identify()}
                disabled={!cameraReady || busy}
                aria-label="Identificar ave"
              >
                {busy ? <span className="spinner spinner-lg" /> : <Camera size={28} />}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
