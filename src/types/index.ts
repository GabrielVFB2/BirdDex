export interface Profile {
  id: string
  username: string
  display_name: string
  bio: string
  location: string
  avatar_url: string
  created_at: string
}

export interface Post {
  id: string
  user_id: string
  image_url: string
  caption: string
  location: string
  species_name: string
  species_scientific: string
  created_at: string
  profiles?: Profile
}

export interface Comment {
  id: string
  post_id: string
  user_id: string
  content: string
  created_at: string
  profiles?: Profile
}

export interface Like {
  id: string
  post_id: string
  user_id: string
  created_at: string
}

export interface Follow {
  id: string
  follower_id: string
  following_id: string
  created_at: string
}

export interface PostWithDetails extends Post {
  like_count?: number
  comment_count?: number
  liked_by_me?: boolean
  bookmarked_by_me?: boolean
}

export interface BirdAlternative {
  common_name: string
  scientific_name: string
}

export interface BirdIdentification {
  bird_found: boolean
  common_name: string
  scientific_name: string
  confidence: number
  alternatives: BirdAlternative[]
  notes: string
}

// ---- Coleção (BirdDex) e conquistas ----

export type Rarity = 'comum' | 'incomum' | 'raro' | 'lendario'

export interface BirdSpecies {
  id: string
  dex_number: number
  common_name: string
  scientific_name: string
  grupo: string
  rarity: Rarity
}

export interface UserCapture {
  id: string
  user_id: string
  species_id: string
  photo_url: string
  location: string
  captured_at: string
}

export type AchievementTier = 'bronze' | 'prata' | 'ouro'
export type AchievementMetric = 'total' | 'rarity' | 'grupo' | 'species'

export interface Achievement {
  code: string
  title: string
  description: string
  icon: string
  tier: AchievementTier
  metric: AchievementMetric
  filter_value: string
  threshold: number
  sort_order: number
}

export interface UserAchievement {
  user_id: string
  achievement_code: string
  unlocked_at: string
}

export type CaptureStatus = 'captured' | 'already_captured' | 'not_in_catalog'

export interface CaptureResult {
  status: CaptureStatus
  species?: BirdSpecies
  new_achievements: Achievement[]
  captured_count?: number
  dex_total?: number
}
