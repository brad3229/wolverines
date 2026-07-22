import { useNavigate } from 'react-router-dom'

export function BackButton({ to, label }: { to: string; label: string }) {
  const navigate = useNavigate()
  return (
    <button
      onClick={() => navigate(to)}
      className="mb-4 inline-flex items-center gap-1.5 rounded-md bg-neutral-bg px-3 py-2 text-sm font-semibold text-neutral-ink transition-colors hover:bg-line"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4 flex-shrink-0">
        <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </button>
  )
}
