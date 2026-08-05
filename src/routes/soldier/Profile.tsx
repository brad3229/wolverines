import { useEffect, useState } from 'react'
import { getOwnSoldierRecord } from '../../lib/soldiers'
import { submitEditRequest, listOwnEditRequests, formatEditRequestValue } from '../../lib/editRequests'
import { flagForDate, CAC_WARNING_DAYS } from '../../lib/expirations'
import { formatDate } from '../../lib/dates'
import { BLOOD_TYPES, UNIFORM_SIZE_FIELDS } from '../../components/SoldierForm'
import { errorMessage } from '../../lib/errors'
import { useAuth } from '../../hooks/useAuth'
import { LoadingScreen } from '../../components/LoadingScreen'
import type { EditRequest, Soldier } from '../../types/database'

type FieldKey =
  | 'name'
  | 'rank'
  | 'dod_id'
  | 'ets_date'
  | 'last_ncoer_date'
  | 'phone_number'
  | 'personal_email'
  | 'mil_email'
  | 'address'
  | 'blood_type'
  | 'cac_expiration_date'
  | 'emergency_contact'
  | 'receives_drill_pay'
  | 'uniform_sizes'

const FIELD_LABEL: Record<FieldKey, string> = {
  name: 'NAME',
  rank: 'RANK',
  dod_id: 'DoD ID',
  ets_date: 'ETS DATE',
  last_ncoer_date: 'LAST NCOER DATE',
  phone_number: 'PHONE NUMBER',
  personal_email: 'PERSONAL EMAIL',
  mil_email: '.MIL EMAIL',
  address: 'ADDRESS',
  blood_type: 'BLOOD TYPE',
  cac_expiration_date: 'CAC EXPIRATION DATE',
  emergency_contact: 'EMERGENCY CONTACT',
  receives_drill_pay: 'RECEIVES DRILL PAY',
  uniform_sizes: 'UNIFORM SIZES',
}

const RAW_FIELD_LABEL: Record<string, string> = {
  first_name: 'First name',
  last_name: 'Last name',
  middle_initial: 'Middle initial',
  rank: 'Rank',
  dod_id: 'DoD ID',
  ets_date: 'ETS date',
  last_ncoer_date: 'Last NCOER date',
  phone_number: 'Phone number',
  personal_email: 'Personal email',
  mil_email: '.mil email',
  street_address: 'Street address',
  city: 'City',
  state: 'State',
  zip_code: 'Zip code',
  blood_type: 'Blood type',
  cac_expiration_date: 'CAC expiration date',
  emergency_contact_name: 'Emergency contact name',
  emergency_contact_relationship: 'Emergency contact relationship',
  emergency_contact_phone: 'Emergency contact phone',
  receives_drill_pay: 'Receives drill pay',
  ...Object.fromEntries(UNIFORM_SIZE_FIELDS.map(({ key, label }) => [key, label])),
}

const DATE_FIELDS = new Set<FieldKey>(['ets_date', 'last_ncoer_date', 'cac_expiration_date'])

export function Profile() {
  const { session } = useAuth()
  const [soldier, setSoldier] = useState<Soldier | null>(null)
  const [requests, setRequests] = useState<EditRequest[]>([])
  const [editingField, setEditingField] = useState<FieldKey | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [middleInitial, setMiddleInitial] = useState('')
  const [streetAddress, setStreetAddress] = useState('')
  const [city, setCity] = useState('')
  const [addrState, setAddrState] = useState('')
  const [zipCode, setZipCode] = useState('')
  const [ecName, setEcName] = useState('')
  const [ecRelationship, setEcRelationship] = useState('')
  const [ecPhone, setEcPhone] = useState('')
  const [sizeDrafts, setSizeDrafts] = useState<Record<string, string>>({})
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [notLinked, setNotLinked] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  function refresh() {
    if (!session) return
    setNotLinked(false)
    setLoadError(null)
    getOwnSoldierRecord(session.user.id)
      .then((s) => {
        setSoldier(s)
        listOwnEditRequests(s.id)
          .then(setRequests)
          .catch((err) => setLoadError(errorMessage(err, 'Failed to load edit requests')))
      })
      .catch(() => setNotLinked(true))
  }

  useEffect(refresh, [session])

  if (notLinked) {
    return (
      <div className="mx-auto max-w-[600px]">
        <div className="rounded-xl border border-line bg-panel p-5 text-sm text-ink-muted">
          Your account isn&rsquo;t linked to a Soldier record on the roster yet. Ask an admin to add you to the
          Roster and link your account to it.
        </div>
      </div>
    )
  }

  if (!soldier) return <LoadingScreen />

  function startEdit(field: FieldKey) {
    if (!soldier) return
    setEditingField(field)
    setFirstName(soldier.first_name)
    setLastName(soldier.last_name)
    setMiddleInitial(soldier.middle_initial ?? '')
    setStreetAddress(soldier.street_address ?? '')
    setCity(soldier.city ?? '')
    setAddrState(soldier.state ?? '')
    setZipCode(soldier.zip_code ?? '')
    setEcName(soldier.emergency_contact_name ?? '')
    setEcRelationship(soldier.emergency_contact_relationship ?? '')
    setEcPhone(soldier.emergency_contact_phone ?? '')
    setSizeDrafts(Object.fromEntries(UNIFORM_SIZE_FIELDS.map(({ key }) => [key, (soldier[key] as string) ?? ''])))
    if (field === 'name' || field === 'emergency_contact' || field === 'uniform_sizes' || field === 'address') {
      setValue('')
    } else if (field === 'receives_drill_pay') {
      setValue(soldier.receives_drill_pay ? 'true' : 'false')
    } else {
      setValue((soldier[field] as string) ?? '')
    }
  }

  async function submit() {
    if (!soldier || !editingField) return
    setSubmitting(true)
    try {
      if (editingField === 'name') {
        if (firstName !== soldier.first_name) {
          await submitEditRequest({
            soldierId: soldier.id,
            fieldName: 'first_name',
            oldValue: soldier.first_name,
            newValue: firstName,
          })
        }
        if (lastName !== soldier.last_name) {
          await submitEditRequest({
            soldierId: soldier.id,
            fieldName: 'last_name',
            oldValue: soldier.last_name,
            newValue: lastName,
          })
        }
        if (middleInitial !== (soldier.middle_initial ?? '')) {
          await submitEditRequest({
            soldierId: soldier.id,
            fieldName: 'middle_initial',
            oldValue: soldier.middle_initial,
            newValue: middleInitial,
          })
        }
      } else if (editingField === 'address') {
        if (streetAddress !== (soldier.street_address ?? '')) {
          await submitEditRequest({
            soldierId: soldier.id,
            fieldName: 'street_address',
            oldValue: soldier.street_address,
            newValue: streetAddress,
          })
        }
        if (city !== (soldier.city ?? '')) {
          await submitEditRequest({
            soldierId: soldier.id,
            fieldName: 'city',
            oldValue: soldier.city,
            newValue: city,
          })
        }
        if (addrState !== (soldier.state ?? '')) {
          await submitEditRequest({
            soldierId: soldier.id,
            fieldName: 'state',
            oldValue: soldier.state,
            newValue: addrState,
          })
        }
        if (zipCode !== (soldier.zip_code ?? '')) {
          await submitEditRequest({
            soldierId: soldier.id,
            fieldName: 'zip_code',
            oldValue: soldier.zip_code,
            newValue: zipCode,
          })
        }
      } else if (editingField === 'emergency_contact') {
        if (ecName !== (soldier.emergency_contact_name ?? '')) {
          await submitEditRequest({
            soldierId: soldier.id,
            fieldName: 'emergency_contact_name',
            oldValue: soldier.emergency_contact_name,
            newValue: ecName,
          })
        }
        if (ecRelationship !== (soldier.emergency_contact_relationship ?? '')) {
          await submitEditRequest({
            soldierId: soldier.id,
            fieldName: 'emergency_contact_relationship',
            oldValue: soldier.emergency_contact_relationship,
            newValue: ecRelationship,
          })
        }
        if (ecPhone !== (soldier.emergency_contact_phone ?? '')) {
          await submitEditRequest({
            soldierId: soldier.id,
            fieldName: 'emergency_contact_phone',
            oldValue: soldier.emergency_contact_phone,
            newValue: ecPhone,
          })
        }
      } else if (editingField === 'uniform_sizes') {
        for (const { key } of UNIFORM_SIZE_FIELDS) {
          const draft = sizeDrafts[key] ?? ''
          if (draft !== ((soldier[key] as string) ?? '')) {
            await submitEditRequest({
              soldierId: soldier.id,
              fieldName: key,
              oldValue: (soldier[key] as string) ?? null,
              newValue: draft,
            })
          }
        }
      } else {
        await submitEditRequest({
          soldierId: soldier.id,
          fieldName: editingField,
          oldValue:
            editingField === 'receives_drill_pay'
              ? soldier.receives_drill_pay
                ? 'true'
                : 'false'
              : ((soldier[editingField] as string) ?? null),
          newValue: value,
        })
      }
      setEditingField(null)
      refresh()
    } finally {
      setSubmitting(false)
    }
  }

  const profileRows: { key: FieldKey; display: string; editable: boolean }[] = [
    {
      key: 'name',
      display: `${soldier.first_name} ${soldier.middle_initial ? soldier.middle_initial + '. ' : ''}${soldier.last_name}`,
      editable: true,
    },
    { key: 'rank', display: soldier.rank, editable: true },
    { key: 'dod_id', display: soldier.dod_id, editable: true },
    { key: 'ets_date', display: formatDate(soldier.ets_date), editable: true },
    {
      key: 'last_ncoer_date',
      display: soldier.last_ncoer_date ? formatDate(soldier.last_ncoer_date) : '—',
      editable: soldier.is_nco,
    },
    { key: 'receives_drill_pay', display: soldier.receives_drill_pay ? 'Yes' : 'No', editable: true },
  ]

  const cacFlag = flagForDate(soldier.cac_expiration_date, CAC_WARNING_DAYS)

  const contactRows: { key: FieldKey; display: string; editable: boolean; flag?: 'expired' | 'soon' | null }[] = [
    { key: 'phone_number', display: soldier.phone_number ?? '—', editable: true },
    { key: 'personal_email', display: soldier.personal_email ?? '—', editable: true },
    { key: 'mil_email', display: soldier.mil_email ?? '—', editable: true },
    {
      key: 'address',
      display: soldier.street_address
        ? [soldier.street_address, [soldier.city, soldier.state].filter(Boolean).join(', '), soldier.zip_code]
            .filter(Boolean)
            .join(' — ')
        : '—',
      editable: true,
    },
    { key: 'blood_type', display: soldier.blood_type ?? 'Unknown', editable: true },
    {
      key: 'cac_expiration_date',
      display: soldier.cac_expiration_date ? formatDate(soldier.cac_expiration_date) : '—',
      editable: true,
      flag: cacFlag,
    },
    {
      key: 'emergency_contact',
      display: soldier.emergency_contact_name
        ? [
            soldier.emergency_contact_name,
            soldier.emergency_contact_relationship ? `(${soldier.emergency_contact_relationship})` : '',
            soldier.emergency_contact_phone,
          ]
            .filter(Boolean)
            .join(' ')
        : '—',
      editable: true,
    },
  ]

  const pending = requests.filter((r) => r.status === 'pending')

  return (
    <div className="mx-auto max-w-[600px]">
      <p className="mb-5 text-[13px] text-ink-muted">Field changes require admin approval.</p>

      {loadError && <p className="mb-4 text-sm text-bad-ink">{loadError}</p>}

      <div className="mb-6 rounded-xl border border-line bg-panel p-1.5">
        {profileRows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-2.5 border-b border-line-soft px-3 py-3 last:border-0">
            <div className="min-w-0">
              <div className="mb-0.5 text-[11px] tracking-wide text-ink-faint">{FIELD_LABEL[row.key]}</div>
              <div className="text-sm font-medium">{row.display}</div>
            </div>
            {row.editable && (
              <button
                onClick={() => startEdit(row.key)}
                className="flex-shrink-0 rounded-md bg-neutral-bg px-2.5 py-1.5 text-[11px] font-bold tracking-wide text-neutral-ink"
              >
                REQUEST EDIT
              </button>
            )}
          </div>
        ))}
        <div className="flex items-center justify-between gap-2.5 px-3 py-3">
          <div className="min-w-0">
            <div className="mb-0.5 text-[11px] tracking-wide text-ink-faint">NCO STATUS</div>
            <div className="text-sm font-medium">{soldier.is_nco ? 'NCO' : 'Not NCO'}</div>
          </div>
        </div>
      </div>

      <h2 className="mb-2.5 font-display text-sm font-semibold tracking-wide text-ink-dim">CONTACT &amp; EMERGENCY INFO</h2>
      <div className="mb-6 rounded-xl border border-line bg-panel p-1.5">
        {contactRows.map((row) => (
          <div key={row.key} className="flex items-center justify-between gap-2.5 border-b border-line-soft px-3 py-3 last:border-0">
            <div className="min-w-0">
              <div className="mb-0.5 flex items-center gap-2 text-[11px] tracking-wide text-ink-faint">
                {FIELD_LABEL[row.key]}
                {row.flag && (
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wide ${
                      row.flag === 'expired' ? 'bg-bad-bg text-bad-ink' : 'bg-warn-bg text-warn-ink'
                    }`}
                  >
                    {row.flag === 'expired' ? 'EXPIRED' : 'EXPIRING SOON'}
                  </span>
                )}
              </div>
              <div className="truncate text-sm font-medium">{row.display}</div>
            </div>
            {row.editable && (
              <button
                onClick={() => startEdit(row.key)}
                className="flex-shrink-0 rounded-md bg-neutral-bg px-2.5 py-1.5 text-[11px] font-bold tracking-wide text-neutral-ink"
              >
                REQUEST EDIT
              </button>
            )}
          </div>
        ))}
      </div>

      <h2 className="mb-2.5 font-display text-sm font-semibold tracking-wide text-ink-dim">UNIFORM SIZES</h2>
      <div className="mb-6 rounded-xl border border-line bg-panel p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <p className="text-sm text-ink-muted">Used to pre-fill the CCDF Order Form when you request gear.</p>
          <button
            onClick={() => startEdit('uniform_sizes')}
            className="flex-shrink-0 rounded-md bg-neutral-bg px-2.5 py-1.5 text-[11px] font-bold tracking-wide text-neutral-ink"
          >
            REQUEST EDIT
          </button>
        </div>
      </div>

      {editingField && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setEditingField(null)}
        >
        <div
          className={`flex w-full max-h-[85vh] flex-col gap-2.5 overflow-y-auto rounded-xl border border-line bg-panel p-4 shadow-lg ${
            editingField === 'uniform_sizes' ? 'max-w-md' : 'max-w-sm'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-sm font-semibold">Request edit: {FIELD_LABEL[editingField]}</div>
          {editingField === 'uniform_sizes' ? (
            <div className="grid grid-cols-2 gap-2.5">
              {UNIFORM_SIZE_FIELDS.map(({ key, label, options }) => (
                <div key={key}>
                  <label className="mb-1 block text-[11px] font-semibold tracking-wide text-ink-faint">{label}</label>
                  {options ? (
                    <select
                      value={sizeDrafts[key] ?? ''}
                      onChange={(e) => setSizeDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
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
                      value={sizeDrafts[key] ?? ''}
                      onChange={(e) => setSizeDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                    />
                  )}
                </div>
              ))}
            </div>
          ) : editingField === 'name' ? (
            <>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First name"
                className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
              />
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last name"
                className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
              />
              <input
                maxLength={1}
                value={middleInitial}
                onChange={(e) => setMiddleInitial(e.target.value.toUpperCase())}
                placeholder="Middle initial (optional)"
                className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
              />
            </>
          ) : editingField === 'address' ? (
            <>
              <input
                value={streetAddress}
                onChange={(e) => setStreetAddress(e.target.value)}
                placeholder="Street address"
                className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
              />
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
              />
              <div className="flex gap-2.5">
                <input
                  maxLength={2}
                  value={addrState}
                  onChange={(e) => setAddrState(e.target.value.toUpperCase())}
                  placeholder="State (e.g. NC)"
                  className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
                />
                <input
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  placeholder="Zip code"
                  className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
                />
              </div>
            </>
          ) : editingField === 'emergency_contact' ? (
            <>
              <input
                value={ecName}
                onChange={(e) => setEcName(e.target.value)}
                placeholder="Name"
                className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
              />
              <input
                value={ecRelationship}
                onChange={(e) => setEcRelationship(e.target.value)}
                placeholder="Relationship"
                className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
              />
              <input
                type="tel"
                value={ecPhone}
                onChange={(e) => setEcPhone(e.target.value)}
                placeholder="Phone number"
                className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
              />
            </>
          ) : editingField === 'blood_type' ? (
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
            >
              <option value="">Unknown</option>
              {BLOOD_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          ) : editingField === 'receives_drill_pay' ? (
            <select
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
            >
              <option value="true">Yes</option>
              <option value="false">No — waive drill pay (e.g. VA disability)</option>
            </select>
          ) : (
            <input
              type={
                DATE_FIELDS.has(editingField)
                  ? 'date'
                  : editingField === 'personal_email' || editingField === 'mil_email'
                    ? 'email'
                    : editingField === 'phone_number'
                      ? 'tel'
                      : 'text'
              }
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="New value"
              className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
          )}
          <div className="flex gap-2">
            <button
              disabled={submitting}
              onClick={submit}
              className="rounded-md bg-accent px-3.5 py-2 text-xs font-bold tracking-wide text-accent-ink disabled:opacity-50"
            >
              SUBMIT REQUEST
            </button>
            <button
              onClick={() => setEditingField(null)}
              className="rounded-md bg-neutral-bg px-3.5 py-2 text-xs font-bold tracking-wide text-neutral-ink"
            >
              CANCEL
            </button>
          </div>
        </div>
        </div>
      )}

      <h2 className="mb-2.5 font-display text-sm font-semibold tracking-wide text-ink-dim">MY PENDING REQUESTS</h2>
      {pending.length === 0 ? (
        <p className="text-sm text-ink-muted">No pending requests.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {pending.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2.5 rounded-xl border border-line bg-panel p-3.5">
              <div className="min-w-0 text-sm font-semibold">
                {RAW_FIELD_LABEL[r.field_name] ?? r.field_name}: {formatEditRequestValue(r.field_name, r.old_value)}{' '}
                &rarr; {formatEditRequestValue(r.field_name, r.new_value)}
              </div>
              <span className="flex-shrink-0 rounded-md bg-warn-bg px-2.5 py-1 text-[10px] font-bold tracking-wide text-warn-ink">
                PENDING
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
