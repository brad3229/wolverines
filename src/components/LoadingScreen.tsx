export function LoadingScreen() {
  return (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3">
      <div className="relative flex h-14 w-14 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-line border-t-accent" />
        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-accent font-display text-[11px] font-bold text-accent-ink">
          ACO
        </div>
      </div>
      <p className="text-[11px] font-semibold tracking-[0.2em] text-ink-muted">LOADING</p>
    </div>
  )
}
