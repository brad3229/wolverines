import { useState } from 'react'
import type { BloodType, Soldier } from '../types/database'
import { errorMessage } from '../lib/errors'

export const BLOOD_TYPES: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']

const RANK_GROUPS: { label: string; ranks: string[] }[] = [
  {
    label: 'Enlisted',
    ranks: ['PVT', 'PV2', 'PFC', 'SPC', 'CPL', 'SGT', 'SSG', 'SFC', 'MSG', '1SG', 'SGM', 'CSM', 'SMA'],
  },
  { label: 'Warrant Officer', ranks: ['WO1', 'CW2', 'CW3', 'CW4', 'CW5'] },
  {
    label: 'Officer',
    ranks: ['2LT', '1LT', 'CPT', 'MAJ', 'LTC', 'COL', 'BG', 'MG', 'LTG', 'GEN', 'GA'],
  },
]

const ALL_RANKS = new Set(RANK_GROUPS.flatMap((group) => group.ranks))

// Corporal and above (enlisted) are NCOs; specialists and below, warrant officers, and
// commissioned officers are not.
const NCO_RANKS = new Set(['CPL', 'SGT', 'SSG', 'SFC', 'MSG', '1SG', 'SGM', 'CSM', 'SMA'])

export interface SoldierFormValues {
  first_name: string
  last_name: string
  rank: string
  date_of_rank: string
  dod_id: string
  ets_date: string
  last_ncoer_date: string
  status: string
  phone_number: string
  personal_email: string
  mil_email: string
  home_address: string
  emergency_contact_name: string
  emergency_contact_relationship: string
  emergency_contact_phone: string
  blood_type: BloodType | ''
  cac_expiration_date: string
  receives_drill_pay: boolean
}

export function soldierFormValuesToPayload(values: SoldierFormValues): Partial<Soldier> {
  const isNco = NCO_RANKS.has(values.rank)
  return {
    ...values,
    is_nco: isNco,
    last_ncoer_date: isNco ? values.last_ncoer_date : null,
    phone_number: values.phone_number || null,
    personal_email: values.personal_email || null,
    mil_email: values.mil_email || null,
    home_address: values.home_address || null,
    emergency_contact_name: values.emergency_contact_name || null,
    emergency_contact_relationship: values.emergency_contact_relationship || null,
    emergency_contact_phone: values.emergency_contact_phone || null,
    blood_type: values.blood_type || null,
    cac_expiration_date: values.cac_expiration_date || null,
    receives_drill_pay: values.receives_drill_pay,
  }
}

interface SoldierFormProps {
  initial?: Partial<Soldier>
  submitLabel: string
  onSubmit: (values: SoldierFormValues) => Promise<void>
}

export function SoldierForm({ initial, submitLabel, onSubmit }: SoldierFormProps) {
  const [values, setValues] = useState<SoldierFormValues>({
    first_name: initial?.first_name ?? '',
    last_name: initial?.last_name ?? '',
    rank: initial?.rank ?? '',
    date_of_rank: initial?.date_of_rank ?? '',
    dod_id: initial?.dod_id ?? '',
    ets_date: initial?.ets_date ?? '',
    last_ncoer_date: initial?.last_ncoer_date ?? '',
    status: initial?.status ?? 'active',
    phone_number: initial?.phone_number ?? '',
    personal_email: initial?.personal_email ?? '',
    mil_email: initial?.mil_email ?? '',
    home_address: initial?.home_address ?? '',
    emergency_contact_name: initial?.emergency_contact_name ?? '',
    emergency_contact_relationship: initial?.emergency_contact_relationship ?? '',
    emergency_contact_phone: initial?.emergency_contact_phone ?? '',
    blood_type: initial?.blood_type ?? '',
    cac_expiration_date: initial?.cac_expiration_date ?? '',
    receives_drill_pay: initial?.receives_drill_pay ?? true,
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const isUnknownRank = values.rank !== '' && !ALL_RANKS.has(values.rank)
  const isNco = NCO_RANKS.has(values.rank)

  function set<K extends keyof SoldierFormValues>(key: K, value: SoldierFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }))
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
      <div>
        <label className={labelClass}>First name</label>
        <input
          required
          value={values.first_name}
          onChange={(e) => set('first_name', e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Last name</label>
        <input
          required
          value={values.last_name}
          onChange={(e) => set('last_name', e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Rank</label>
        <select required value={values.rank} onChange={(e) => set('rank', e.target.value)} className={inputClass}>
          <option value="" disabled>
            Select rank
          </option>
          {isUnknownRank && <option value={values.rank}>{values.rank} (unrecognized)</option>}
          {RANK_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.ranks.map((rank) => (
                <option key={rank} value={rank}>
                  {rank}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Date of rank</label>
        <input
          required
          type="date"
          value={values.date_of_rank}
          onChange={(e) => set('date_of_rank', e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>DOD ID number</label>
        <input required value={values.dod_id} onChange={(e) => set('dod_id', e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>ETS date</label>
        <input
          required
          type="date"
          value={values.ets_date}
          onChange={(e) => set('ets_date', e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Status</label>
        <select value={values.status} onChange={(e) => set('status', e.target.value)} className={inputClass}>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
      {isNco && (
        <div className="sm:col-span-2">
          <label className={labelClass}>Last NCOER date</label>
          <input
            required
            type="date"
            value={values.last_ncoer_date}
            onChange={(e) => set('last_ncoer_date', e.target.value)}
            className={inputClass}
          />
        </div>
      )}

      <div className="sm:col-span-2 mt-2 border-t border-line pt-4">
        <h3 className="font-display text-xs font-semibold tracking-wide text-ink-muted">CONTACT INFO</h3>
      </div>
      <div>
        <label className={labelClass}>Phone number</label>
        <input
          type="tel"
          value={values.phone_number}
          onChange={(e) => set('phone_number', e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Personal email</label>
        <input
          type="email"
          value={values.personal_email}
          onChange={(e) => set('personal_email', e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>.mil email</label>
        <input
          type="email"
          value={values.mil_email}
          onChange={(e) => set('mil_email', e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Home address</label>
        <input
          value={values.home_address}
          onChange={(e) => set('home_address', e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="sm:col-span-2 mt-2 border-t border-line pt-4">
        <h3 className="font-display text-xs font-semibold tracking-wide text-ink-muted">EMERGENCY CONTACT</h3>
      </div>
      <div>
        <label className={labelClass}>Name</label>
        <input
          value={values.emergency_contact_name}
          onChange={(e) => set('emergency_contact_name', e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Relationship</label>
        <input
          value={values.emergency_contact_relationship}
          onChange={(e) => set('emergency_contact_relationship', e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Phone number</label>
        <input
          type="tel"
          value={values.emergency_contact_phone}
          onChange={(e) => set('emergency_contact_phone', e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="sm:col-span-2 mt-2 border-t border-line pt-4">
        <h3 className="font-display text-xs font-semibold tracking-wide text-ink-muted">ADDITIONAL INFO</h3>
      </div>
      <div>
        <label className={labelClass}>Blood type</label>
        <select
          value={values.blood_type}
          onChange={(e) => set('blood_type', e.target.value as SoldierFormValues['blood_type'])}
          className={inputClass}
        >
          <option value="">Unknown</option>
          {BLOOD_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>CAC expiration date</label>
        <input
          type="date"
          value={values.cac_expiration_date}
          onChange={(e) => set('cac_expiration_date', e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Receives drill pay</label>
        <select
          value={values.receives_drill_pay ? 'yes' : 'no'}
          onChange={(e) => set('receives_drill_pay', e.target.value === 'yes')}
          className={inputClass}
        >
          <option value="yes">Yes</option>
          <option value="no">No — waived (e.g. VA disability)</option>
        </select>
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
