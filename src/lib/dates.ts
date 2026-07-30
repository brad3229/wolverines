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
