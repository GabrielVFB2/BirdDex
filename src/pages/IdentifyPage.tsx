import { useNavigate } from 'react-router-dom'
import TopBar from '@/components/TopBar'
import BirdScanner from '@/components/BirdScanner'
import { usePostDraft } from '@/context/PostDraftContext'
import type { BirdIdentification } from '@/types'
import './IdentifyPage.css'

export default function IdentifyPage() {
  const navigate = useNavigate()
  const { updateDraft } = usePostDraft()

  // Leva o resultado para o fluxo de registro, já com foto e espécie preenchidas.
  const handleUse = (result: BirdIdentification, photoDataUrl: string) => {
    updateDraft({
      ...(photoDataUrl ? { imageDataUrl: photoDataUrl } : {}),
      speciesName: result.common_name,
      speciesScientific: result.scientific_name,
    })
    navigate('/new')
  }

  return (
    <div className="identify-page">
      <TopBar title="Identificar ave" showBell={false} />
      <BirdScanner variant="page" useLabel="Registrar esta ave" onUse={handleUse} />
    </div>
  )
}
