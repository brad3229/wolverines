// Supabase auth emails (invite, password recovery) redirect back with a `type` param
// in the URL hash alongside the session tokens. The Supabase client consumes that hash
// asynchronously to establish a session and then clears it from the URL, so this has to
// be captured at module load -- as early as physically possible -- or it's gone before
// anything else gets a chance to read it.
const initialParams =
  typeof window !== 'undefined' ? new URLSearchParams(window.location.hash.replace(/^#/, '')) : null

export const initialAuthFlowType = initialParams?.get('type') ?? null

// A failed or expired invite/recovery link redirects back the same way, but with
// `error`/`error_code`/`error_description` set instead of a session -- captured here for
// the same reason as the type above, so Login can explain what happened instead of just
// showing a bare sign-in form with no context.
export const initialAuthError = initialParams?.get('error')
  ? {
      code: initialParams.get('error_code'),
      description: initialParams.get('error_description'),
    }
  : null
