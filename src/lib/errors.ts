// Supabase query results carry a plain { message, code, ... } object on error, not an
// Error instance, unless .throwOnError() is used — so `instanceof Error` misses it.
export function errorMessage(err: unknown, fallback = 'Something went wrong'): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err && typeof err.message === 'string') {
    return err.message
  }
  return fallback
}

// supabase.functions.invoke() wraps any non-2xx response in a generic
// FunctionsHttpError whose .message is always "Edge Function returned a non-2xx status
// code" -- the actual { error: "..." } body our functions return has to be read off
// error.context (the raw Response) separately, or that real reason is lost.
export async function functionErrorMessage(err: unknown, fallback = 'Request failed'): Promise<string> {
  if (err && typeof err === 'object' && 'context' in err) {
    const context = (err as { context?: unknown }).context
    if (context instanceof Response) {
      try {
        const body = await context.clone().json()
        if (body && typeof body.error === 'string') return body.error
      } catch {
        // context wasn't JSON -- fall through to the generic message below
      }
    }
  }
  return errorMessage(err, fallback)
}
