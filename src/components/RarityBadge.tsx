import { RARITY_LABEL } from '@/lib/collection'
import type { Rarity } from '@/types'
import './RarityBadge.css'

export default function RarityBadge({ rarity }: { rarity: Rarity }) {
  return <span className={`rarity-badge rarity-${rarity}`}>{RARITY_LABEL[rarity]}</span>
}
