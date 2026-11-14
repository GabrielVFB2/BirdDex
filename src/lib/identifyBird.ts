import { supabase } from '@/lib/supabase'
import type { BirdIdentification } from '@/types'

const IDENTIFICATION_TIMEOUT_MS = 55_000

function isAbortError(value: unknown): boolean {
  return typeof value === 'object' && value !== null && 'name' in value && value.name === 'AbortError'
}

/** Envia um frame (JPEG em base64, sem o prefixo "data:") e recebe a espécie identificada. */
export async function identifyBird(imageBase64: string): Promise<BirdIdentification> {
  const { data, error } = await supabase.functions.invoke('identify-bird', {
    body: { image: imageBase64, media_type: 'image/jpeg' },
    timeout: IDENTIFICATION_TIMEOUT_MS,
  })

  if (error) {
    const context =
      typeof error === 'object' && error !== null && 'context' in error ? error.context : undefined
    if (isAbortError(context)) {
      throw new Error('A identificação demorou demais. Verifique a conexão e tente novamente.')
    }

    let message = 'Não foi possível identificar a ave. Tente novamente.'
    const response = context as Response | undefined
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
