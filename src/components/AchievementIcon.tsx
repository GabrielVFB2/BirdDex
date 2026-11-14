import {
  Award, Binoculars, Bird, Crown, Eye, Feather, Flame, Gem, Hammer,
  Medal, Moon, Music, Shield, Sparkles, Star, Target, Trophy, Waves,
  type LucideIcon,
} from 'lucide-react'

// O banco guarda só o nome do ícone; aqui ele vira o componente. Nome desconhecido cai em Trophy.
const ICONS: Record<string, LucideIcon> = {
  Award, Binoculars, Bird, Crown, Eye, Feather, Flame, Gem, Hammer,
  Medal, Moon, Music, Shield, Sparkles, Star, Target, Trophy, Waves,
}

export default function AchievementIcon({ name, size = 22 }: { name: string; size?: number }) {
  const Icon = ICONS[name] ?? Trophy
  return <Icon size={size} strokeWidth={1.8} />
}
