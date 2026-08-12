import { AtlasMark } from './AtlasMark'

export function LoadingScreen() {
  return (
    <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3">
      <div className="relative flex h-14 w-14 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full border-2 border-line border-t-accent" />
        <AtlasMark className="h-7 w-7 text-[#D13048]" />
      </div>
      <p className="text-[11px] font-semibold tracking-[0.2em] text-ink-muted">LOADING</p>
    </div>
  )
}
