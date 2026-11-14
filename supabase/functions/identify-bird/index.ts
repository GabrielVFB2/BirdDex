// Edge Function: identifica a espécie de uma ave a partir de uma foto.
// Usa a API do Google Gemini (nível gratuito). A chave fica só aqui no servidor, como secret:
//   GEMINI_API_KEY  (obrigatório)  -> gerada em https://aistudio.google.com
//   GEMINI_MODEL    (opcional)     -> padrão: gemini-3.8-flash
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-3.8-flash'
const MAX_BASE64_LENGTH = 7_000_000 // ~5 MB de imagem
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const PROMPT = `Você é um ornitólogo especialista em aves, com foco na avifauna do Brasil.
Analise a imagem e identifique a espécie da ave que aparece nela.

Responda SOMENTE com um objeto JSON neste formato:
{
  "bird_found": boolean,
  "common_name": string,
  "scientific_name": string,
  "confidence": number,
  "alternatives": [{ "common_name": string, "scientific_name": string }],
  "notes": string
}

Regras:
- "bird_found" é false se não houver ave visível ou se ela estiver pequena/desfocada demais para identificar. Nesse caso use strings vazias, confidence 0, alternatives [] e explique em "notes" (em português) o que melhorar (chegar mais perto, mais luz, etc.).
- "common_name" em português do Brasil (ex.: "Sabiá-laranjeira"); "scientific_name" em binômio (ex.: "Turdus rufiventris").
- "confidence" vai de 0 a 1 e deve refletir a incerteza real. Se várias espécies parecidas forem plausíveis, baixe a confiança e liste as outras em "alternatives" (até 3).
- Nunca invente uma espécie só para responder: se não der para ter certeza, diga isso em "notes".
- "notes": no máximo duas frases curtas em português, citando o que na imagem sustenta a identificação (plumagem, bico, etc.).`

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  })
}

function extractJson(text: string): unknown {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end <= start) throw new Error('Resposta sem JSON')
  return JSON.parse(text.slice(start, end + 1))
}

function str(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS })
  if (req.method !== 'POST') return json({ error: 'Método não permitido.' }, 405)

  // Só usuários logados no app podem usar.
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Faça login para identificar aves.' }, 401)

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError || !userData.user) return json({ error: 'Sessão inválida.' }, 401)

  const apiKey = Deno.env.get('GEMINI_API_KEY')
  if (!apiKey) return json({ error: 'Identificação indisponível: chave da API não configurada.' }, 500)

  let image = ''
  let mediaType = 'image/jpeg'
  try {
    const body = await req.json()
    image = str(body.image)
    mediaType = str(body.media_type) || 'image/jpeg'
  } catch {
    return json({ error: 'Corpo da requisição inválido.' }, 400)
  }

  if (!image || image.length > MAX_BASE64_LENGTH) return json({ error: 'Imagem ausente ou grande demais.' }, 400)
  if (!ALLOWED_TYPES.includes(mediaType)) return json({ error: 'Formato de imagem não suportado.' }, 400)

  try {
    const apiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(MODEL)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [
                { inline_data: { mime_type: mediaType, data: image } },
                { text: PROMPT },
              ],
            },
          ],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.2,
            // folga para modelos que "pensam" antes de responder
            maxOutputTokens: 2048,
          },
        }),
      },
    )

    if (apiRes.status === 429) {
      return json({ error: 'Muitas identificações em pouco tempo (limite gratuito). Aguarde um minuto e tente de novo.' }, 429)
    }
    if (!apiRes.ok) {
      console.error('Gemini API error', apiRes.status, await apiRes.text())
      return json({ error: 'O serviço de identificação falhou. Tente novamente.' }, 502)
    }

    const payload = await apiRes.json()
    const parts: { text?: string }[] = payload.candidates?.[0]?.content?.parts ?? []
    const text = parts.map((p) => p.text ?? '').join('')
    if (!text) {
      console.error('Gemini sem texto', JSON.stringify(payload.promptFeedback ?? payload.candidates?.[0]?.finishReason ?? {}))
      return json({ error: 'Não consegui analisar essa imagem. Tente outra foto.' }, 502)
    }

    const raw = extractJson(text) as Record<string, unknown>
    const found = raw.bird_found === true
    const confidence = Math.min(1, Math.max(0, Number(raw.confidence) || 0))
    const alternatives = (Array.isArray(raw.alternatives) ? raw.alternatives : [])
      .slice(0, 3)
      .map((a) => ({
        common_name: str((a as Record<string, unknown>).common_name),
        scientific_name: str((a as Record<string, unknown>).scientific_name),
      }))
      .filter((a) => a.common_name)

    return json({
      bird_found: found && !!str(raw.common_name),
      common_name: str(raw.common_name),
      scientific_name: str(raw.scientific_name),
      confidence,
      alternatives,
      notes: str(raw.notes),
    })
  } catch (err) {
    console.error('identify-bird failure', err)
    return json({ error: 'Não foi possível interpretar a identificação. Tente outra foto.' }, 502)
  }
})
