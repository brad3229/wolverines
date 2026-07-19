import { useState } from 'react'
import type { DrillEvent, DrillEventType } from '../types/database'
import { errorMessage } from '../lib/errors'

export interface EventFormValues {
  title: string
  event_type: DrillEventType
  event_date: string
  end_date: string
  start_time: string
  end_time: string
  location: string
  notes: string
}

export function eventFormValuesToPayload(values: EventFormValues): Partial<DrillEvent> {
  return {
    ...values,
    end_date: values.end_date || values.event_date,
    start_time: values.start_time || null,
    end_time: values.end_time || null,
    location: values.location || null,
    notes: values.notes || null,
  }
}

interface EventFormProps {
  initial?: Partial<DrillEvent>
  submitLabel: string
  onSubmit: (values: EventFormValues) => Promise<void>
}

export function EventForm({ initial, submitLabel, onSubmit }: EventFormProps) {
  const [values, setValues] = useState<EventFormValues>({
    title: initial?.title ?? '',
    event_type: initial?.event_type ?? 'drill',
    event_date: initial?.event_date ?? '',
    end_date: initial?.end_date ?? '',
    start_time: initial?.start_time ?? '',
    end_time: initial?.end_time ?? '',
    location: initial?.location ?? '',
    notes: initial?.notes ?? '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof EventFormValues>(key: K, value: EventFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function handleStartDateChange(value: string) {
    // Keep End date mirroring Start date until the user deliberately picks a different one,
    // so the common single-day Drill case only requires filling in one date.
    setValues((prev) => ({
      ...prev,
      event_date: value,
      end_date: !prev.end_date || prev.end_date === prev.event_date ? value : prev.end_date,
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await onSubmit(values)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  const inputClass =
    'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none'
  const labelClass = 'mb-1 block text-xs font-semibold tracking-wide text-ink-dim'

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className={labelClass}>Title</label>
        <input required value={values.title} onChange={(e) => set('title', e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Event type</label>
        <select
          value={values.event_type}
          onChange={(e) => set('event_type', e.target.value as DrillEventType)}
          className={inputClass}
        >
          <option value="drill">Drill</option>
          <option value="annual_training">Annual Training</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>Location</label>
        <input value={values.location} onChange={(e) => set('location', e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Start date</label>
        <input
          required
          type="date"
          value={values.event_date}
          onChange={(e) => handleStartDateChange(e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>End date</label>
        <input
          required
          type="date"
          min={values.event_date || undefined}
          value={values.end_date}
          onChange={(e) => set('end_date', e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Start time</label>
        <input
          type="time"
          value={values.start_time}
          onChange={(e) => set('start_time', e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>End time</label>
        <input
          type="time"
          value={values.end_time}
          onChange={(e) => set('end_time', e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass}>Notes</label>
        <textarea rows={3} value={values.notes} onChange={(e) => set('notes', e.target.value)} className={inputClass} />
      </div>

      {error && <p className="sm:col-span-2 text-sm text-bad-ink">{error}</p>}

      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-md bg-accent px-4 py-2.5 text-xs font-bold tracking-wide text-accent-ink transition-opacity disabled:opacity-50 sm:w-auto"
        >
          {submitting ? 'SAVING...' : submitLabel.toUpperCase()}
        </button>
      </div>
    </form>
  )
}
