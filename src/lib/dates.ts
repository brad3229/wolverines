// Bare "YYYY-MM-DD" dates (no time component) parse as UTC midnight in JS, which can
// display as the previous day in timezones behind UTC -- appending T00:00:00 forces
// local-time parsing instead.
export function formatDate(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  })
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

// The write-side equivalent of the parsing pitfall above: formatting via toISOString()
// converts to UTC first, which can land on the wrong calendar day near midnight
// depending on the timezone -- this reads the local Y/M/D fields directly instead.
export function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function todayLocalDateString(): string {
  return toLocalDateString(new Date())
}

export function currentMonthLocalDateString(): string {
  const now = new Date()
  return toLocalDateString(new Date(now.getFullYear(), now.getMonth(), 1))
}

export function formatMonthLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}
