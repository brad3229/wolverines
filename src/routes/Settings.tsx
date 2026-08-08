import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../hooks/useAuth'
import { AvatarUploader } from '../components/AvatarUploader'
import { registerPasskey, listPasskeys, deletePasskey, browserSupportsPasskeys } from '../lib/passkey'
import { errorMessage } from '../lib/errors'
import type { PasskeyListItem } from '@supabase/supabase-js'

export function Settings() {
  const { soldier } = useAuth()
  const [passkeys, setPasskeys] = useState<PasskeyListItem[]>([])
  const [loadingPasskeys, setLoadingPasskeys] = useState(true)
  const [registering, setRegistering] = useState(false)
  const [passkeyError, setPasskeyError] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function refreshPasskeys() {
    setLoadingPasskeys(true)
    listPasskeys()
      .then(setPasskeys)
      .catch(() => setPasskeys([]))
      .finally(() => setLoadingPasskeys(false))
  }

  useEffect(() => {
    if (browserSupportsPasskeys()) refreshPasskeys()
    else setLoadingPasskeys(false)
  }, [])

  async function handleRegister() {
    setRegistering(true)
    setPasskeyError(null)
    try {
      await registerPasskey()
      refreshPasskeys()
    } catch (err) {
      setPasskeyError(errorMessage(err, 'Failed to register passkey'))
    } finally {
      setRegistering(false)
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id)
    setPasskeyError(null)
    try {
      await deletePasskey(id)
      refreshPasskeys()
    } catch (err) {
      setPasskeyError(errorMessage(err, 'Failed to remove passkey'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="mx-auto max-w-[600px]">
      {soldier && (
        <>
          <h2 className="mb-2.5 font-display text-sm font-semibold tracking-wide text-ink-dim">PROFILE PHOTO</h2>
          <div className="mb-6">
            <AvatarUploader />
          </div>
        </>
      )}

      {browserSupportsPasskeys() && (
        <>
          <h2 className="mb-2.5 font-display text-sm font-semibold tracking-wide text-ink-dim">PASSKEY SIGN-IN</h2>
          <div className="mb-6 rounded-xl border border-line bg-panel p-4 sm:p-5">
            <p className="mb-3 text-xs text-ink-muted">
              Sign in with Face ID, Touch ID, or Windows Hello instead of typing your password.
            </p>
            {!loadingPasskeys && passkeys.length > 0 && (
              <div className="mb-3 flex flex-col gap-2">
                {passkeys.map((pk) => (
                  <div
                    key={pk.id}
                    className="flex items-center justify-between rounded-lg border border-line-soft px-3 py-2"
                  >
                    <span className="text-sm">{pk.friendly_name || 'Passkey'}</span>
                    <button
                      disabled={deletingId === pk.id}
                      onClick={() => handleDelete(pk.id)}
                      className="rounded-md bg-neutral-bg px-2.5 py-1 text-[11px] font-bold tracking-wide text-neutral-ink disabled:opacity-50"
                    >
                      {deletingId === pk.id ? 'REMOVING...' : 'REMOVE'}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={handleRegister}
              disabled={registering}
              className="rounded-md bg-accent px-4 py-2 text-xs font-bold tracking-wide text-accent-ink disabled:opacity-50"
            >
              {registering ? 'FOLLOW YOUR DEVICE PROMPT...' : 'SET UP A PASSKEY'}
            </button>
            {passkeyError && <p className="mt-3 text-sm text-bad-ink">{passkeyError}</p>}
          </div>
        </>
      )}

      <h2 className="mb-2.5 font-display text-sm font-semibold tracking-wide text-ink-dim">ACCOUNT</h2>
      <div className="rounded-xl border border-line bg-panel p-1.5">
        <button
          onClick={() => supabase.auth.signOut()}
          className="flex w-full items-center justify-between px-3 py-3 text-left text-sm font-semibold text-bad-ink"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
