export function decodeJwt(token: string): Record<string, unknown> {
  const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
  return JSON.parse(atob(base64))
}

export function jwtAmrMethods(token: string): string[] {
  const amr = decodeJwt(token).amr
  if (!Array.isArray(amr)) return []
  return amr.map((entry) => (entry as { method?: string }).method).filter((m): m is string => !!m)
}
