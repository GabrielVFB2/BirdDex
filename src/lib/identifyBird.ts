import { supabase } from '@/lib/supabase'
import type { BirdIdentification } from '@/types'

/** Envia um frame (JPEG em base64, sem o prefixo "data:") e recebe a espécie identificada. */
export async function identifyBird(imageBase64: string): Promise<BirdIdentification> {
  const { data, error } = await supabase.functions.invoke('identify-bird', {
    body: { image: imageBase64, media_type: 'image/jpeg' },
  })

  if (error) {
    let message = 'Não foi possível identificar a ave. Tente novamente.'
    const response = (error as { context?: Response }).context
    if (response && typeof response.json === 'function') {
      try {
        const body = await response.json()
        if (body?.error) message = body.error
      } catch {
        // mantém a mensagem padrão
      }
    }
    throw new Error(message)
  }

  return data as BirdIdentification
}
