interface ProgressBarProps {
  value: number
  max: number
  className?: string
}

export function ProgressBar({ value, max, className = '' }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0
  const complete = max > 0 && value >= max
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={`h-1.5 w-full overflow-hidden rounded-full bg-neutral-bg ${className}`}
    >
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${complete ? 'bg-good-ink' : 'bg-accent'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
