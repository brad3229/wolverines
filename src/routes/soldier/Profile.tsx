import { useEffect, useState } from 'react'
import { getOwnSoldierRecord } from '../../lib/soldiers'
import { submitEditRequest, listOwnEditRequests, formatEditRequestValue } from '../../lib/editRequests'
import { flagForDate, CAC_WARNING_DAYS } from '../../lib/expirations'
import { BLOOD_TYPES } from '../../components/SoldierForm'
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
  | 'home_address'
  | 'blood_type'
  | 'cac_expiration_date'
  | 'emergency_contact'
  | 'receives_drill_pay'

const FIELD_LABEL: Record<FieldKey, string> = {
  name: 'NAME',
  rank: 'RANK',
  dod_id: 'DoD ID',
  ets_date: 'ETS DATE',
  last_ncoer_date: 'LAST NCOER DATE',
  phone_number: 'PHONE NUMBER',
  personal_email: 'PERSONAL EMAIL',
  mil_email: '.MIL EMAIL',
  home_address: 'HOME ADDRESS',
  blood_type: 'BLOOD TYPE',
  cac_expiration_date: 'CAC EXPIRATION DATE',
  emergency_contact: 'EMERGENCY CONTACT',
  receives_drill_pay: 'RECEIVES DRILL PAY',
}

const RAW_FIELD_LABEL: Record<string, string> = {
  first_name: 'First name',
  last_name: 'Last name',
  rank: 'Rank',
  dod_id: 'DoD ID',
  ets_date: 'ETS date',
  last_ncoer_date: 'Last NCOER date',
  phone_number: 'Phone number',
  personal_email: 'Personal email',
  mil_email: '.mil email',
  home_address: 'Home address',
  blood_type: 'Blood type',
  cac_expiration_date: 'CAC expiration date',
  emergency_contact_name: 'Emergency contact name',
  emergency_contact_relationship: 'Emergency contact relationship',
  emergency_contact_phone: 'Emergency contact phone',
  receives_drill_pay: 'Receives drill pay',
}

const DATE_FIELDS = new Set<FieldKey>(['ets_date', 'last_ncoer_date', 'cac_expiration_date'])

export function Profile() {
  const { session } = useAuth()
  const [soldier, setSoldier] = useState<Soldier | null>(null)
  const [requests, setRequests] = useState<EditRequest[]>([])
  const [editingField, setEditingField] = useState<FieldKey | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [ecName, setEcName] = useState('')
  const [ecRelationship, setEcRelationship] = useState('')
  const [ecPhone, setEcPhone] = useState('')
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
        <h1 className="mb-4 font-display text-2xl font-semibold uppercase tracking-wide sm:text-[26px]">My Profile</h1>
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
    setEcName(soldier.emergency_contact_name ?? '')
    setEcRelationship(soldier.emergency_contact_relationship ?? '')
    setEcPhone(soldier.emergency_contact_phone ?? '')
    if (field === 'name' || field === 'emergency_contact') {
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
    { key: 'name', display: `${soldier.first_name} ${soldier.last_name}`, editable: true },
    { key: 'rank', display: soldier.rank, editable: true },
    { key: 'dod_id', display: soldier.dod_id, editable: true },
    { key: 'ets_date', display: soldier.ets_date, editable: true },
    { key: 'last_ncoer_date', display: soldier.last_ncoer_date ?? '—', editable: soldier.is_nco },
    { key: 'receives_drill_pay', display: soldier.receives_drill_pay ? 'Yes' : 'No', editable: true },
  ]

  const cacFlag = flagForDate(soldier.cac_expiration_date, CAC_WARNING_DAYS)

  const contactRows: { key: FieldKey; display: string; editable: boolean; flag?: 'expired' | 'soon' | null }[] = [
    { key: 'phone_number', display: soldier.phone_number ?? '—', editable: true },
    { key: 'personal_email', display: soldier.personal_email ?? '—', editable: true },
    { key: 'mil_email', display: soldier.mil_email ?? '—', editable: true },
    { key: 'home_address', display: soldier.home_address ?? '—', editable: true },
    { key: 'blood_type', display: soldier.blood_type ?? 'Unknown', editable: true },
    { key: 'cac_expiration_date', display: soldier.cac_expiration_date ?? '—', editable: true, flag: cacFlag },
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
      <h1 className="mb-1 font-display text-2xl font-semibold uppercase tracking-wide sm:text-[26px]">My Profile</h1>
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

      {editingField && (
        <div className="mb-6 flex flex-col gap-2.5 rounded-xl border border-line bg-panel p-4">
          <div className="text-sm font-semibold">Request edit: {FIELD_LABEL[editingField]}</div>
          {editingField === 'name' ? (
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
