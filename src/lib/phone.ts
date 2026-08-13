// Normalizes any 10-digit (or 11-digit with a leading 1) number to (111) 111-1111
// for display, regardless of how it was originally entered/stored. Falls back to the
// raw value for anything that doesn't cleanly fit (extensions, international numbers)
// rather than mangling it.
export function formatPhoneNumber(raw: string | null | undefined): string {
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  const tenDigits = digits.length === 11 && digits.startsWith('1') ? digits.slice(1) : digits
  if (tenDigits.length !== 10) return raw
  return `(${tenDigits.slice(0, 3)}) ${tenDigits.slice(3, 6)}-${tenDigits.slice(6)}`
}

// Live-formats a phone number input as the user types, building up
// (111) 111-1111 progressively. Caps at 10 digits.
export function formatPhoneAsTyped(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length === 0) return ''
  if (digits.length < 4) return `(${digits}`
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
}
