import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import TopBar from '@/components/TopBar'
import BirdScanner from '@/components/BirdScanner'
import CaptureCelebration from '@/components/CaptureCelebration'
import { useAuth } from '@/context/AuthContext'
import { usePostDraft } from '@/context/PostDraftContext'
import { captureWithPhoto } from '@/lib/collection'
import type { BirdIdentification, CaptureResult } from '@/types'
import './IdentifyPage.css'

export default function IdentifyPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { updateDraft } = usePostDraft()

  const [celebration, setCelebration] = useState<{ result: CaptureResult; photo: string } | null>(null)
  // Trocar a chave reinicia o scanner (câmera e resultado) depois da captura.
  const [scannerKey, setScannerKey] = useState(0)

  // Leva o resultado para o fluxo de registro, já com foto e espécie preenchidas.
  const handleUse = (result: BirdIdentification, photoDataUrl: string) => {
    updateDraft({
      ...(photoDataUrl ? { imageDataUrl: photoDataUrl } : {}),
      speciesName: result.common_name,
      speciesScientific: result.scientific_name,
    })
    navigate('/new')
  }

  // Adiciona a ave à coleção. Erros sobem para o scanner mostrar ao usuário.
  const handleCapture = async (result: BirdIdentification, photoDataUrl: string) => {
    if (!user) throw new Error('Faça login para capturar aves.')

    const outcome = await captureWithPhoto({
      userId: user.id,
      identification: result,
      photoDataUrl,
    })

    if (outcome.status === 'not_in_catalog') {
      throw new Error(
        'Essa espécie ainda não está no catálogo da BirdDex. Você pode registrá-la como publicação.',
      )
    }

    setCelebration({ result: outcome, photo: photoDataUrl })
  }

  const closeCelebration = () => {
    setCelebration(null)
    setScannerKey((k) => k + 1)
  }

  return (
    <div className="identify-page">
      <TopBar title="Identificar ave" showBell={false} />
      <BirdScanner
        key={scannerKey}
        variant="page"
        useLabel="Registrar esta ave"
        onUse={handleUse}
        onCapture={handleCapture}
      />
      {celebration && (
        <CaptureCelebration
          result={celebration.result}
          photoUrl={celebration.photo}
          onClose={closeCelebration}
        />
      )}
    </div>
  )
}
