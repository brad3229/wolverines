import { useState } from 'react'
import type { BloodType, Platoon, Squad, Team, Sex, MrcStatus, Soldier } from '../types/database'
import { errorMessage } from '../lib/errors'
import { formatPhoneAsTyped } from '../lib/phone'

export const BLOOD_TYPES: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
export const PLATOONS: Platoon[] = ['1st Platoon', '2nd Platoon', '3rd Platoon', 'HQ Platoon']
export const SQUADS: Squad[] = ['1st Squad', '2nd Squad', '3rd Squad', '4th Squad']
export const TEAMS: Team[] = ['Alpha Team', 'Bravo Team']

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

// Official Army ACU/OCP size matrix -- 7 sizes (X-Small through 3X-Large) each
// crossed with Short/Regular/Long. Value is the abbreviated code (e.g. "MR" for
// Medium Regular) since that's the shorthand supply expects on the CCDF form.
export const ACU_SIZE_OPTIONS: { value: string; label: string }[] = [
  { value: 'XSS', label: 'X-Small Short' },
  { value: 'XSR', label: 'X-Small Regular' },
  { value: 'XSL', label: 'X-Small Long' },
  { value: 'SS', label: 'Small Short' },
  { value: 'SR', label: 'Small Regular' },
  { value: 'SL', label: 'Small Long' },
  { value: 'MS', label: 'Medium Short' },
  { value: 'MR', label: 'Medium Regular' },
  { value: 'ML', label: 'Medium Long' },
  { value: 'LS', label: 'Large Short' },
  { value: 'LR', label: 'Large Regular' },
  { value: 'LL', label: 'Large Long' },
  { value: 'XLS', label: 'X-Large Short' },
  { value: 'XLR', label: 'X-Large Regular' },
  { value: 'XLL', label: 'X-Large Long' },
  { value: '2XLS', label: '2X-Large Short' },
  { value: '2XLR', label: '2X-Large Regular' },
  { value: '2XLL', label: '2X-Large Long' },
  { value: '3XLS', label: '3X-Large Short' },
  { value: '3XLR', label: '3X-Large Regular' },
  { value: '3XLL', label: '3X-Large Long' },
]

const SHIRT_SIZE_OPTIONS: { value: string; label: string }[] = [
  { value: 'XS', label: 'X-Small' },
  { value: 'S', label: 'Small' },
  { value: 'M', label: 'Medium' },
  { value: 'L', label: 'Large' },
  { value: 'XL', label: 'X-Large' },
  { value: '2XL', label: '2X-Large' },
  { value: '3XL', label: '3X-Large' },
]

function numberRange(start: number, end: number, step: number): number[] {
  const out: number[] = []
  for (let v = start; v <= end + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000)
  return out
}

const LENGTH_LABEL: Record<string, string> = { S: 'Short', R: 'Regular', L: 'Long' }

// Boots / Dress shoes: whole & half U.S. sizes, Regular/Wide width.
function shoeSizeOptions(min: number, max: number): { value: string; label: string }[] {
  return numberRange(min, max, 0.5).flatMap((size) => [
    { value: `${size}R`, label: `${size} Regular` },
    { value: `${size}W`, label: `${size} Wide` },
  ])
}
const BOOTS_SIZE_OPTIONS = shoeSizeOptions(4, 14)
const DRESS_SHOES_SIZE_OPTIONS = shoeSizeOptions(4, 14)

// ASU coat: chest size (even inches) x Short/Regular/Long.
const ASU_COAT_SIZE_OPTIONS = numberRange(34, 56, 2).flatMap((chest) =>
  (['S', 'R', 'L'] as const).map((len) => ({ value: `${chest}${len}`, label: `${chest} Chest ${LENGTH_LABEL[len]}` })),
)

// ASU pants: waist size (inches) x Short/Regular/Long.
const ASU_PANTS_SIZE_OPTIONS = numberRange(28, 50, 1).flatMap((waist) =>
  (['S', 'R', 'L'] as const).map((len) => ({ value: `${waist}${len}`, label: `${waist} Waist ${LENGTH_LABEL[len]}` })),
)

// ASU shirt: neck size (half inches) x sleeve length.
const ASU_SHIRT_SIZE_OPTIONS = numberRange(14, 20, 0.5).flatMap((neck) =>
  numberRange(32, 37, 1).map((sleeve) => ({ value: `${neck}x${sleeve}`, label: `${neck} Neck / ${sleeve} Sleeve` })),
)

// Beret / service cap: standard Army hat-size range.
const BERET_SIZE_OPTIONS: { value: string; label: string }[] = [
  '6 1/2', '6 5/8', '6 3/4', '6 7/8', '7', '7 1/8', '7 1/4', '7 3/8', '7 1/2', '7 5/8', '7 3/4',
].map((size) => ({ value: size, label: size }))

// Matches the CCDF Order Form's fields -- keeping these on the Soldier record
// lets the pre-filled gear-request PDF skip asking for sizes every time.
// Exported so Profile.tsx's self-service edit-request flow can reuse the same list.
export const UNIFORM_SIZE_FIELDS: {
  key: keyof SoldierFormValues
  label: string
  options?: { value: string; label: string }[]
}[] = [
  { key: 'ocp_top_size', label: 'OCP top', options: ACU_SIZE_OPTIONS },
  { key: 'ocp_bottom_size', label: 'OCP bottom', options: ACU_SIZE_OPTIONS },
  { key: 'tshirt_size', label: 'T-shirt', options: SHIRT_SIZE_OPTIONS },
  { key: 'boots_size', label: 'Boots', options: BOOTS_SIZE_OPTIONS },
  { key: 'gloves_size', label: 'Gloves', options: SHIRT_SIZE_OPTIONS },
  { key: 'ach_size', label: 'ACH', options: SHIRT_SIZE_OPTIONS },
  { key: 'asu_coat_size', label: 'ASU coat', options: ASU_COAT_SIZE_OPTIONS },
  { key: 'asu_pants_size', label: 'ASU pants', options: ASU_PANTS_SIZE_OPTIONS },
  { key: 'asu_shirt_size', label: 'ASU shirt', options: ASU_SHIRT_SIZE_OPTIONS },
  { key: 'dress_shoes_size', label: 'Dress shoes', options: DRESS_SHOES_SIZE_OPTIONS },
  { key: 'beret_size', label: 'Beret / service cap', options: BERET_SIZE_OPTIONS },
  { key: 'pro_mask_size', label: 'Pro-mask', options: SHIRT_SIZE_OPTIONS },
  { key: 'iba_iotv_size', label: 'IBA / IOTV', options: SHIRT_SIZE_OPTIONS },
  { key: 'apfu_jacket_size', label: 'APFU jacket', options: SHIRT_SIZE_OPTIONS },
  { key: 'apfu_pants_size', label: 'APFU pants', options: SHIRT_SIZE_OPTIONS },
  { key: 'apfu_tshirt_size', label: 'APFU t-shirt', options: SHIRT_SIZE_OPTIONS },
  { key: 'apfu_shorts_size', label: 'APFU shorts', options: SHIRT_SIZE_OPTIONS },
]

// Sergeant and above get NCOERs; Corporal and below (including junior
// enlisted, warrant officers, and commissioned officers) don't.
const NCO_RANKS = new Set(['SGT', 'SSG', 'SFC', 'MSG', '1SG', 'SGM', 'CSM', 'SMA'])

export interface SoldierFormValues {
  first_name: string
  last_name: string
  middle_initial: string
  rank: string
  date_of_rank: string
  dod_id: string
  ets_date: string
  last_ncoer_date: string
  status: string
  phone_number: string
  personal_email: string
  mil_email: string
  street_address: string
  city: string
  state: string
  zip_code: string
  emergency_contact_name: string
  emergency_contact_relationship: string
  emergency_contact_phone: string
  blood_type: BloodType | ''
  cac_expiration_date: string
  receives_drill_pay: boolean
  has_gtcc: boolean
  mrc_status: MrcStatus | ''
  sex: Sex | ''
  platoon: Platoon | ''
  squad: Squad | ''
  team: Team | ''
  ocp_top_size: string
  ocp_bottom_size: string
  tshirt_size: string
  boots_size: string
  gloves_size: string
  ach_size: string
  asu_coat_size: string
  asu_pants_size: string
  asu_shirt_size: string
  dress_shoes_size: string
  beret_size: string
  pro_mask_size: string
  iba_iotv_size: string
  apfu_jacket_size: string
  apfu_pants_size: string
  apfu_tshirt_size: string
  apfu_shorts_size: string
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
    middle_initial: values.middle_initial || null,
    street_address: values.street_address || null,
    city: values.city || null,
    state: values.state || null,
    zip_code: values.zip_code || null,
    emergency_contact_name: values.emergency_contact_name || null,
    emergency_contact_relationship: values.emergency_contact_relationship || null,
    emergency_contact_phone: values.emergency_contact_phone || null,
    blood_type: values.blood_type || null,
    cac_expiration_date: values.cac_expiration_date || null,
    receives_drill_pay: values.receives_drill_pay,
    has_gtcc: values.has_gtcc,
    mrc_status: values.mrc_status || null,
    sex: values.sex || null,
    platoon: values.platoon || null,
    squad: values.squad || null,
    team: values.team || null,
    ocp_top_size: values.ocp_top_size || null,
    ocp_bottom_size: values.ocp_bottom_size || null,
    tshirt_size: values.tshirt_size || null,
    boots_size: values.boots_size || null,
    gloves_size: values.gloves_size || null,
    ach_size: values.ach_size || null,
    asu_coat_size: values.asu_coat_size || null,
    asu_pants_size: values.asu_pants_size || null,
    asu_shirt_size: values.asu_shirt_size || null,
    dress_shoes_size: values.dress_shoes_size || null,
    beret_size: values.beret_size || null,
    pro_mask_size: values.pro_mask_size || null,
    iba_iotv_size: values.iba_iotv_size || null,
    apfu_jacket_size: values.apfu_jacket_size || null,
    apfu_pants_size: values.apfu_pants_size || null,
    apfu_tshirt_size: values.apfu_tshirt_size || null,
    apfu_shorts_size: values.apfu_shorts_size || null,
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
    middle_initial: initial?.middle_initial ?? '',
    rank: initial?.rank ?? '',
    date_of_rank: initial?.date_of_rank ?? '',
    dod_id: initial?.dod_id ?? '',
    ets_date: initial?.ets_date ?? '',
    last_ncoer_date: initial?.last_ncoer_date ?? '',
    status: initial?.status ?? 'active',
    phone_number: initial?.phone_number ?? '',
    personal_email: initial?.personal_email ?? '',
    mil_email: initial?.mil_email ?? '',
    street_address: initial?.street_address ?? '',
    city: initial?.city ?? '',
    state: initial?.state ?? '',
    zip_code: initial?.zip_code ?? '',
    emergency_contact_name: initial?.emergency_contact_name ?? '',
    emergency_contact_relationship: initial?.emergency_contact_relationship ?? '',
    emergency_contact_phone: initial?.emergency_contact_phone ?? '',
    blood_type: initial?.blood_type ?? '',
    cac_expiration_date: initial?.cac_expiration_date ?? '',
    receives_drill_pay: initial?.receives_drill_pay ?? true,
    has_gtcc: initial?.has_gtcc ?? false,
    mrc_status: initial?.mrc_status ?? '',
    sex: initial?.sex ?? '',
    platoon: initial?.platoon ?? '',
    squad: initial?.squad ?? '',
    team: initial?.team ?? '',
    ocp_top_size: initial?.ocp_top_size ?? '',
    ocp_bottom_size: initial?.ocp_bottom_size ?? '',
    tshirt_size: initial?.tshirt_size ?? '',
    boots_size: initial?.boots_size ?? '',
    gloves_size: initial?.gloves_size ?? '',
    ach_size: initial?.ach_size ?? '',
    asu_coat_size: initial?.asu_coat_size ?? '',
    asu_pants_size: initial?.asu_pants_size ?? '',
    asu_shirt_size: initial?.asu_shirt_size ?? '',
    dress_shoes_size: initial?.dress_shoes_size ?? '',
    beret_size: initial?.beret_size ?? '',
    pro_mask_size: initial?.pro_mask_size ?? '',
    iba_iotv_size: initial?.iba_iotv_size ?? '',
    apfu_jacket_size: initial?.apfu_jacket_size ?? '',
    apfu_pants_size: initial?.apfu_pants_size ?? '',
    apfu_tshirt_size: initial?.apfu_tshirt_size ?? '',
    apfu_shorts_size: initial?.apfu_shorts_size ?? '',
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
        <label className={labelClass}>Middle initial</label>
        <input
          maxLength={1}
          value={values.middle_initial}
          onChange={(e) => set('middle_initial', e.target.value.toUpperCase())}
          placeholder="Optional"
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
        <h3 className="font-display text-xs font-semibold tracking-wide text-ink-muted">UNIT</h3>
      </div>
      <div>
        <label className={labelClass}>Platoon</label>
        <select
          value={values.platoon}
          onChange={(e) => set('platoon', e.target.value as SoldierFormValues['platoon'])}
          className={inputClass}
        >
          <option value="">Unassigned</option>
          {PLATOONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Squad</label>
        <select
          value={values.squad}
          onChange={(e) => set('squad', e.target.value as SoldierFormValues['squad'])}
          className={inputClass}
        >
          <option value="">Unassigned</option>
          {SQUADS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className={labelClass}>Team</label>
        <select
          value={values.team}
          onChange={(e) => set('team', e.target.value as SoldierFormValues['team'])}
          className={inputClass}
        >
          <option value="">Unassigned</option>
          {TEAMS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <div className="sm:col-span-2 mt-2 border-t border-line pt-4">
        <h3 className="font-display text-xs font-semibold tracking-wide text-ink-muted">CONTACT INFO</h3>
      </div>
      <div>
        <label className={labelClass}>Phone number</label>
        <input
          type="tel"
          value={values.phone_number}
          onChange={(e) => set('phone_number', formatPhoneAsTyped(e.target.value))}
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
      <div className="sm:col-span-2">
        <label className={labelClass}>Street address</label>
        <input
          value={values.street_address}
          onChange={(e) => set('street_address', e.target.value)}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>City</label>
        <input value={values.city} onChange={(e) => set('city', e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>State</label>
        <input
          maxLength={2}
          placeholder="e.g. NC"
          value={values.state}
          onChange={(e) => set('state', e.target.value.toUpperCase())}
          className={inputClass}
        />
      </div>
      <div>
        <label className={labelClass}>Zip code</label>
        <input value={values.zip_code} onChange={(e) => set('zip_code', e.target.value)} className={inputClass} />
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
          onChange={(e) => set('emergency_contact_phone', formatPhoneAsTyped(e.target.value))}
          className={inputClass}
        />
      </div>

      <div className="sm:col-span-2 mt-2 border-t border-line pt-4">
        <h3 className="font-display text-xs font-semibold tracking-wide text-ink-muted">ADDITIONAL INFO</h3>
      </div>
      <div>
        <label className={labelClass}>Sex</label>
        <select
          value={values.sex}
          onChange={(e) => set('sex', e.target.value as SoldierFormValues['sex'])}
          className={inputClass}
        >
          <option value="">Unknown</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
        </select>
        <p className="mt-1 text-[11px] text-ink-faint">Used for the AFT scorecard (standards are sex-adjusted).</p>
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
      <div>
        <label className={labelClass}>Has GTCC</label>
        <select
          value={values.has_gtcc ? 'yes' : 'no'}
          onChange={(e) => set('has_gtcc', e.target.value === 'yes')}
          className={inputClass}
        >
          <option value="no">No</option>
          <option value="yes">Yes</option>
        </select>
      </div>
      <div>
        <label className={labelClass}>MRC status</label>
        <select
          value={values.mrc_status}
          onChange={(e) => set('mrc_status', e.target.value as SoldierFormValues['mrc_status'])}
          className={inputClass}
        >
          <option value="">Unknown</option>
          <option value="1">1</option>
          <option value="2">2</option>
          <option value="3">3</option>
          <option value="4">4</option>
        </select>
        <p className="mt-1 text-[11px] text-ink-faint">A 3 or 4 flags the soldier as not medically ready.</p>
      </div>

      <div className="sm:col-span-2 mt-2 border-t border-line pt-4">
        <h3 className="font-display text-xs font-semibold tracking-wide text-ink-muted">UNIFORM SIZES</h3>
        <p className="mt-1 text-xs text-ink-faint">Used to pre-fill the CCDF Order Form on gear requests.</p>
      </div>
      {UNIFORM_SIZE_FIELDS.map(({ key, label, options }) => (
        <div key={key}>
          <label className={labelClass}>{label}</label>
          {options ? (
            <select
              value={values[key] as string}
              onChange={(e) => set(key, e.target.value as SoldierFormValues[typeof key])}
              className={inputClass}
            >
              <option value="">Select size</option>
              {options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              value={values[key] as string}
              onChange={(e) => set(key, e.target.value as SoldierFormValues[typeof key])}
              className={inputClass}
            />
          )}
        </div>
      ))}

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
