import type { Profile } from '@/types'

interface AvatarProps {
  profile?: Profile | null
  size?: number
  className?: string
}

export default function Avatar({ profile, size = 38, className = '' }: AvatarProps) {
  const initials = profile?.display_name
    ? profile.display_name
        .split(' ')
        .slice(0, 2)
        .map((s) => s[0])
        .join('')
        .toUpperCase()
    : '?'

  if (profile?.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={profile.display_name}
        className={`avatar ${className}`}
        style={{ width: size, height: size }}
      />
    )
  }

  return (
    <div
      className={`avatar ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </div>
  )
}
