// Supabase auth emails (invite, password recovery) redirect back with a `type` param
// in the URL hash alongside the session tokens. The Supabase client consumes that hash
// asynchronously to establish a session and then clears it from the URL, so this has to
// be captured at module load -- as early as physically possible -- or it's gone before
// anything else gets a chance to read it.
const initialParams =
  typeof window !== 'undefined' ? new URLSearchParams(window.location.hash.replace(/^#/, '')) : null

export const initialAuthFlowType = initialParams?.get('type') ?? null
