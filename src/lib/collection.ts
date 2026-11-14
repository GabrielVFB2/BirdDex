import { supabase } from '@/lib/supabase'
import type {
  Achievement,
  BirdIdentification,
  BirdSpecies,
  CaptureResult,
  Rarity,
  UserAchievement,
  UserCapture,
} from '@/types'

export const RARITY_LABEL: Record<Rarity, string> = {
  comum: 'Comum',
  incomum: 'Incomum',
  raro: 'Raro',
  lendario: 'Lendário',
}

export interface CollectionData {
  species: BirdSpecies[]
  captures: UserCapture[]
  achievements: Achievement[]
  unlocked: UserAchievement[]
  ownerName: string
}

/** Carrega o catálogo inteiro e o que o usuário já capturou/desbloqueou. */
export async function fetchCollection(userId: string): Promise<CollectionData> {
  const [speciesRes, capturesRes, achievementsRes, unlockedRes, profileRes] = await Promise.all([
    supabase
      .from('bird_species')
      .select('id, dex_number, common_name, scientific_name, grupo, rarity')
      .order('dex_number', { ascending: true }),
    supabase.from('user_captures').select('*').eq('user_id', userId),
    supabase.from('achievements').select('*').order('sort_order', { ascending: true }),
    supabase.from('user_achievements').select('*').eq('user_id', userId),
    supabase.from('profiles').select('display_name, username').eq('id', userId).maybeSingle(),
  ])

  const failed = [speciesRes, capturesRes, achievementsRes, unlockedRes].find((r) => r.error)
  if (failed?.error) {
    console.error('Erro ao carregar a coleção:', failed.error.message)
    const message = failed.error.code === 'PGRST205'
      ? 'O banco ainda não está configurado. Execute as migrações em supabase/migrations no SQL Editor do Supabase.'
      : 'Não foi possível carregar a coleção.'
    throw new Error(message)
  }

  const profile = profileRes.data as { display_name?: string; username?: string } | null

  return {
    species: (speciesRes.data ?? []) as BirdSpecies[],
    captures: (capturesRes.data ?? []) as UserCapture[],
    achievements: (achievementsRes.data ?? []) as Achievement[],
    unlocked: (unlockedRes.data ?? []) as UserAchievement[],
    ownerName: profile?.display_name || profile?.username || '',
  }
}

/** Quantas espécies capturadas contam para a conquista (mesma regra usada no banco). */
export function achievementProgress(achievement: Achievement, captured: BirdSpecies[]): number {
  switch (achievement.metric) {
    case 'total':
      return captured.length
    case 'rarity':
      return captured.filter((s) => s.rarity === achievement.filter_value).length
    case 'grupo':
      return captured.filter((s) => s.grupo === achievement.filter_value).length
    case 'species':
      return captured.filter((s) => s.scientific_name === achievement.filter_value).length
    default:
      return 0
  }
}

interface CaptureInput {
  scientificName: string
  commonName: string
  photoUrl?: string
  location?: string
}

/** Captura uma espécie (e libera conquistas) pelo banco. */
export async function captureBird(input: CaptureInput): Promise<CaptureResult> {
  const { data, error } = await supabase.rpc('capture_bird', {
    p_scientific_name: input.scientificName,
    p_common_name: input.commonName,
    p_photo_url: input.photoUrl ?? '',
    p_location: input.location ?? '',
  })

  if (error || !data) {
    console.error('Erro ao capturar:', error?.message)
    throw new Error('Não foi possível registrar a captura. Tente novamente.')
  }

  const result = data as Partial<CaptureResult>
  return {
    status: result.status ?? 'not_in_catalog',
    species: result.species,
    new_achievements: result.new_achievements ?? [],
    captured_count: result.captured_count,
    dex_total: result.dex_total,
  }
}

/**
 * Captura a partir da câmera: envia a foto, registra a captura e,
 * se a espécie não for nova, apaga a foto enviada (evita arquivos órfãos).
 */
export async function captureWithPhoto(opts: {
  userId: string
  identification: BirdIdentification
  photoDataUrl: string
}): Promise<CaptureResult> {
  let path = ''
  let photoUrl = ''

  if (opts.photoDataUrl) {
    path = `${opts.userId}/captures/${crypto.randomUUID()}.jpg`
    const { error: uploadError } = await supabase.storage
      .from('posts')
      .upload(path, dataUrlToBlob(opts.photoDataUrl), { contentType: 'image/jpeg' })

    if (uploadError) {
      throw new Error('Não foi possível enviar a foto. Tente novamente.')
    }
    photoUrl = supabase.storage.from('posts').getPublicUrl(path).data.publicUrl
  }

  const discardPhoto = () => {
    if (path) void supabase.storage.from('posts').remove([path])
  }

  try {
    const result = await captureBird({
      scientificName: opts.identification.scientific_name,
      commonName: opts.identification.common_name,
      photoUrl,
    })
    if (result.status !== 'captured') discardPhoto()
    return result
  } catch (err) {
    discardPhoto()
    throw err
  }
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, base64] = dataUrl.split(',')
  const mime = meta.match(/:(.*?);/)?.[1] || 'image/jpeg'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}
