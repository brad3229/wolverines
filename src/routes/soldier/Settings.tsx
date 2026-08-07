import { supabase } from '../../lib/supabaseClient'

export function Settings() {
  return (
    <div className="mx-auto max-w-[600px]">
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
