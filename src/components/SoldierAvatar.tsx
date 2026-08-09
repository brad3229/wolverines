import type { Soldier } from '../types/database'

interface SoldierAvatarProps {
  soldier: Pick<Soldier, 'first_name' | 'last_name' | 'avatar_url'>
  className?: string
  textClassName?: string
}

export function SoldierAvatar({ soldier, className = 'h-8 w-8', textClassName = 'text-[11px]' }: SoldierAvatarProps) {
  const initials = `${soldier.first_name.charAt(0)}${soldier.last_name.charAt(0)}`.toUpperCase()

  return soldier.avatar_url ? (
    <img src={soldier.avatar_url} alt="" className={`${className} flex-shrink-0 rounded-full object-cover`} />
  ) : (
    <div
      className={`flex ${className} ${textClassName} flex-shrink-0 items-center justify-center rounded-full bg-accent-soft font-display font-bold text-accent-soft-ink`}
    >
      {initials}
    </div>
  )
}
