import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import { uploadOwnAvatar, removeOwnAvatar } from '../lib/avatar'
import { errorMessage } from '../lib/errors'
import { IconCamera } from './icons'

// Self-contained -- reads the signed-in user's own Soldier record straight off
// useAuth rather than taking it as a prop, so it can drop into both the
// Soldier Profile page and the shared Settings page without wiring.
export function AvatarUploader() {
  const { session, soldier, refreshSoldier } = useAuth()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Nothing to attach a photo to without a linked Soldier row.
  if (!soldier) return null

  async function handleChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // let the same file be re-picked later (e.g. after an error)
    if (!file || !session) return
    setUploading(true)
    setError(null)
    try {
      await uploadOwnAvatar(session.user.id, file)
      refreshSoldier()
    } catch (err) {
      setError(errorMessage(err, 'Failed to upload photo'))
    } finally {
      setUploading(false)
    }
  }

  async function handleRemove() {
    if (!session) return
    setUploading(true)
    setError(null)
    try {
      await removeOwnAvatar(session.user.id)
      refreshSoldier()
    } catch (err) {
      setError(errorMessage(err, 'Failed to remove photo'))
    } finally {
      setUploading(false)
    }
  }

  const hasPhoto = !!soldier.avatar_url

  return (
    <div className="flex items-center gap-4 rounded-xl border border-line bg-panel p-4">
      <div className="relative h-16 w-16 flex-shrink-0">
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          aria-label={hasPhoto ? 'Change photo' : 'Add photo'}
          className="group relative block h-16 w-16 overflow-hidden rounded-full transition-transform duration-150 ease-out hover:scale-105 active:scale-95 disabled:pointer-events-none"
        >
          {hasPhoto ? (
            <img
              src={soldier.avatar_url ?? undefined}
              alt=""
              className="h-16 w-16 rounded-full object-cover shadow-[0_0_0_2px_var(--color-accent)]"
            />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-soft font-display text-lg font-bold text-accent shadow-[0_0_0_2px_var(--color-accent)]">
              {soldier.first_name.charAt(0)}
              {soldier.last_name.charAt(0)}
            </div>
          )}
          {/* Dims and labels on hover (desktop); the camera badge below covers
              the same affordance for touch, where hover never fires. */}
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/70 text-center text-[9.5px] font-bold uppercase leading-tight tracking-wide text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            {hasPhoto ? 'Change Photo' : 'Add Photo'}
          </div>
        </button>
        <div className="pointer-events-none absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-panel bg-accent text-accent-ink">
          <IconCamera className="h-2.5 w-2.5" />
        </div>
        {uploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/50">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        {hasPhoto && (
          <button
            disabled={uploading}
            onClick={handleRemove}
            className="rounded-md bg-neutral-bg px-3 py-1.5 text-[11px] font-bold tracking-wide text-bad-ink transition-colors hover:bg-line disabled:opacity-50"
          >
            REMOVE PHOTO
          </button>
        )}
        <input ref={inputRef} type="file" accept="image/*" onChange={handleChange} className="hidden" />
        <p className="mt-1.5 text-xs text-ink-muted">Updates immediately -- no approval needed.</p>
        {error && <p className="mt-1 text-xs text-bad-ink">{error}</p>}
      </div>
    </div>
  )
}
