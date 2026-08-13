import { useEffect, useState } from 'react'
import { listDrillEvents, formatEventDateRange, EVENT_TYPE_LABEL } from '../../lib/drillEvents'
import { getOwnSoldierRecord } from '../../lib/soldiers'
import {
  listOwnSutaRequests,
  submitSutaRequest,
  resubmitSutaRequest,
  formatMakeupDateRange,
  SUTA_REQUEST_TYPE_LABEL,
  SUTA_DUTY_LOCATION_LABEL,
  SUTA_UNIT_OPTIONS,
  SUTA_ACKNOWLEDGMENTS,
} from '../../lib/sutaRequests'
import { errorMessage } from '../../lib/errors'
import { todayLocalDateString } from '../../lib/dates'
import { useAuth } from '../../hooks/useAuth'
import { LoadingScreen } from '../../components/LoadingScreen'
import type {
  DrillEvent,
  MakeupStatus,
  Soldier,
  SutaDutyLocation,
  SutaRequest,
  SutaRequestType,
  SutaStatus,
} from '../../types/database'

const STATUS_BADGE: Record<SutaStatus, { label: string; className: string }> = {
  pending: { label: 'PENDING', className: 'bg-warn-bg text-warn-ink' },
  approved: { label: 'APPROVED', className: 'bg-good-bg text-good-ink' },
  denied: { label: 'DENIED', className: 'bg-bad-bg text-bad-ink' },
}
const NEEDS_CORRECTION_BADGE = { label: 'NEEDS CORRECTION', className: 'bg-bad-bg text-bad-ink' }
const UNIT_OTHER = '__other__'

const MAKEUP_BADGE: Record<MakeupStatus, { label: string; className: string } | null> = {
  not_required: null,
  pending: { label: 'MAKE-UP PENDING', className: 'bg-warn-bg text-warn-ink' },
  completed: { label: 'MAKE-UP COMPLETE', className: 'bg-good-bg text-good-ink' },
}

export function Suta() {
  const { session, role } = useAuth()
  const [soldier, setSoldier] = useState<Soldier | null>(null)
  const [events, setEvents] = useState<DrillEvent[]>([])
  const [requests, setRequests] = useState<SutaRequest[]>([])
  const [showForm, setShowForm] = useState(false)
  const [eventId, setEventId] = useState('')
  const [requestType, setRequestType] = useState<SutaRequestType | ''>('')
  const [reason, setReason] = useState('')
  const [makeupDate, setMakeupDate] = useState('')
  const [makeupEndDate, setMakeupEndDate] = useState('')
  const [dutyLocation, setDutyLocation] = useState<SutaDutyLocation | ''>('')
  const [dutyUnit, setDutyUnit] = useState('')
  const [dutyUnitOther, setDutyUnitOther] = useState('')
  const [signatureName, setSignatureName] = useState('')
  const [ackMode, setAckMode] = useState<'submit' | 'resubmit' | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notLinked, setNotLinked] = useState(false)

  // Correction/resubmit flow -- same fields as the submission form, but
  // editing an existing request in place.
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editEventId, setEditEventId] = useState('')
  const [editRequestType, setEditRequestType] = useState<SutaRequestType | ''>('')
  const [editReason, setEditReason] = useState('')
  const [editMakeupDate, setEditMakeupDate] = useState('')
  const [editMakeupEndDate, setEditMakeupEndDate] = useState('')
  const [editDutyLocation, setEditDutyLocation] = useState<SutaDutyLocation | ''>('')
  const [editDutyUnit, setEditDutyUnit] = useState('')
  const [editDutyUnitOther, setEditDutyUnitOther] = useState('')

  async function refresh() {
    if (!session) return
    setLoading(true)
    setNotLinked(false)
    try {
      const [s, e] = await Promise.all([getOwnSoldierRecord(session.user.id), listDrillEvents()])
      setSoldier(s)
      setEvents(e)
      setRequests(await listOwnSutaRequests(s.id))
    } catch {
      setNotLinked(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session])

  if (loading) return <LoadingScreen />

  if (notLinked || !soldier) {
    return (
      <div className="mx-auto max-w-[560px]">
        <div className="rounded-xl border border-line bg-panel p-5 text-sm text-ink-muted">
          Your account isn&rsquo;t linked to a Soldier record on the roster, so you can&rsquo;t submit a SUTA
          request.{' '}
          {role === 'admin'
            ? 'Add yourself to the Roster and link your account to it, or have another admin do it.'
            : 'Ask an admin to add you to the Roster and link your account to it.'}
        </div>
      </div>
    )
  }

  const today = todayLocalDateString()
  const requestedEventIds = new Set(requests.map((r) => r.drill_event_id))
  const eligibleEvents = events.filter((e) => e.end_date >= today && !requestedEventIds.has(e.id))
  const editEligibleEvents = events.filter((e) => e.end_date >= today && (!requestedEventIds.has(e.id) || e.id === editEventId))
  const eventLabel = (id: string) => {
    const e = events.find((e) => e.id === id)
    return e ? `${e.title} — ${formatEventDateRange(e)}` : 'Unknown event'
  }
  const defaultSignatureName = `${soldier.first_name} ${soldier.middle_initial ? soldier.middle_initial + '. ' : ''}${soldier.last_name}`

  function openAckModal(mode: 'submit' | 'resubmit') {
    setSignatureName((prev) => prev || defaultSignatureName)
    setAckMode(mode)
  }

  async function handlePreview(request: SutaRequest) {
    const event = events.find((e) => e.id === request.drill_event_id)
    if (!soldier || !event) return
    try {
      const { fillSutaCertificate, previewPdf } = await import('../../lib/pdfForms')
      const bytes = await fillSutaCertificate(soldier, request, event)
      previewPdf(bytes)
    } catch (err) {
      setError(errorMessage(err, 'Failed to generate form'))
    }
  }

  async function handleConfirmedSubmit() {
    if (!soldier || !eventId || !requestType || !reason.trim() || !signatureName.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await submitSutaRequest({
        soldierId: soldier.id,
        drillEventId: eventId,
        reason: reason.trim(),
        requestType,
        requestedMakeupDate: makeupDate || null,
        requestedMakeupEndDate: makeupEndDate || null,
        dutyLocation: dutyLocation || null,
        dutyUnit: (dutyUnit === UNIT_OTHER ? dutyUnitOther.trim() : dutyUnit) || null,
        signatureName: signatureName.trim(),
      })
      setAckMode(null)
      setShowForm(false)
      setEventId('')
      setRequestType('')
      setReason('')
      setMakeupDate('')
      setMakeupEndDate('')
      setDutyLocation('')
      setDutyUnit('')
      setDutyUnitOther('')
      setSignatureName('')
      refresh()
    } catch (err) {
      setError(errorMessage(err, 'Failed to submit request'))
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(request: SutaRequest) {
    setEditingId(request.id)
    setEditEventId(request.drill_event_id)
    setEditRequestType(request.request_type ?? '')
    setEditReason(request.reason)
    setEditMakeupDate(request.requested_makeup_date ?? '')
    setEditMakeupEndDate(request.requested_makeup_end_date ?? '')
    setEditDutyLocation(request.duty_location ?? '')
    if (request.duty_unit && (SUTA_UNIT_OPTIONS as string[]).includes(request.duty_unit)) {
      setEditDutyUnit(request.duty_unit)
      setEditDutyUnitOther('')
    } else if (request.duty_unit) {
      setEditDutyUnit(UNIT_OTHER)
      setEditDutyUnitOther(request.duty_unit)
    } else {
      setEditDutyUnit('')
      setEditDutyUnitOther('')
    }
  }

  async function handleConfirmedResubmit() {
    if (!editingId || !editEventId || !editRequestType || !editReason.trim() || !signatureName.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await resubmitSutaRequest({
        id: editingId,
        drillEventId: editEventId,
        reason: editReason.trim(),
        requestType: editRequestType,
        requestedMakeupDate: editMakeupDate || null,
        requestedMakeupEndDate: editMakeupEndDate || null,
        dutyLocation: editDutyLocation || null,
        dutyUnit: (editDutyUnit === UNIT_OTHER ? editDutyUnitOther.trim() : editDutyUnit) || null,
        signatureName: signatureName.trim(),
      })
      setAckMode(null)
      setEditingId(null)
      setSignatureName('')
      refresh()
    } catch (err) {
      setError(errorMessage(err, 'Failed to resubmit request'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-[640px]">
      <div className="mb-4 flex justify-end sm:mb-5">
        <button
          onClick={() => setShowForm((v) => !v)}
          className="flex-shrink-0 rounded-md bg-accent px-4 py-2 text-xs font-bold tracking-wide text-accent-ink"
        >
          {showForm ? 'CANCEL' : '+ NEW REQUEST'}
        </button>
      </div>
      <p className="mb-5 text-[13px] text-ink-muted">
        Can't make a drill or Annual Training? Submit a request explaining why — your chain of command will review it.
        Approved requests still require a make-up.
      </p>

      {showForm && (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-line bg-panel p-4 sm:p-5">
          <div>
            <label className="mb-1 block text-xs font-semibold tracking-wide text-ink-dim">EVENT</label>
            <select
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
            >
              <option value="" disabled>
                Select event
              </option>
              {eligibleEvents.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} ({EVENT_TYPE_LABEL[e.event_type]}) — {formatEventDateRange(e)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold tracking-wide text-ink-dim">REQUEST TYPE</label>
            <select
              value={requestType}
              onChange={(e) => setRequestType(e.target.value as SutaRequestType)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
            >
              <option value="" disabled>
                Select request type
              </option>
              {(Object.keys(SUTA_REQUEST_TYPE_LABEL) as SutaRequestType[]).map((t) => (
                <option key={t} value={t}>
                  {SUTA_REQUEST_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold tracking-wide text-ink-dim">REASON</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Explain why you can't attend"
              className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold tracking-wide text-ink-dim">
              PLANNED MAKE-UP DATE (OPTIONAL)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={makeupDate}
                onChange={(e) => {
                  setMakeupDate(e.target.value)
                  if (makeupEndDate && makeupEndDate < e.target.value) setMakeupEndDate(e.target.value)
                }}
                className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
              />
              <span className="flex-shrink-0 text-xs text-ink-muted">to</span>
              <input
                type="date"
                value={makeupEndDate}
                min={makeupDate || undefined}
                disabled={!makeupDate}
                onChange={(e) => setMakeupEndDate(e.target.value)}
                className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none disabled:opacity-50"
              />
            </div>
            <p className="mt-1 text-xs text-ink-muted">
              Leave blank if you don&rsquo;t know yet — you can let your chain of command know later. Leave the end
              date blank if it&rsquo;s a single day.
            </p>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold tracking-wide text-ink-dim">
              LOCATION DUTY WILL BE PERFORMED (OPTIONAL)
            </label>
            <select
              value={dutyLocation}
              onChange={(e) => setDutyLocation(e.target.value as SutaDutyLocation)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
            >
              <option value="">Not sure yet</option>
              {(Object.keys(SUTA_DUTY_LOCATION_LABEL) as SutaDutyLocation[]).map((loc) => (
                <option key={loc} value={loc}>
                  {SUTA_DUTY_LOCATION_LABEL[loc]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold tracking-wide text-ink-dim">
              UNIT (IF DIFFERENT) — OPTIONAL
            </label>
            <select
              value={dutyUnit}
              onChange={(e) => setDutyUnit(e.target.value)}
              className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
            >
              <option value="">Same as my unit</option>
              {SUTA_UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
              <option value={UNIT_OTHER}>Other...</option>
            </select>
            {dutyUnit === UNIT_OTHER && (
              <input
                value={dutyUnitOther}
                onChange={(e) => setDutyUnitOther(e.target.value)}
                placeholder="Unit"
                className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
              />
            )}
          </div>
          {error && <p className="text-sm text-bad-ink">{error}</p>}
          <div>
            <button
              disabled={!eventId || !requestType || !reason.trim()}
              onClick={() => openAckModal('submit')}
              className="rounded-md bg-accent px-4 py-2 text-xs font-bold tracking-wide text-accent-ink disabled:opacity-50"
            >
              SUBMIT REQUEST
            </button>
          </div>
        </div>
      )}

      {ackMode && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setAckMode(null)}
        >
          <div
            className="flex w-full max-w-md max-h-[85vh] flex-col gap-3 overflow-y-auto rounded-xl border border-line bg-panel p-4 shadow-lg sm:p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold">Before you submit, please confirm you understand:</div>
            <ul className="flex flex-col gap-2 text-xs text-ink-dim">
              {SUTA_ACKNOWLEDGMENTS.map((text, i) => (
                <li key={i} className="flex gap-2">
                  <span className="flex-shrink-0 text-ink-faint">{i + 1}.</span>
                  <span>{text}</span>
                </li>
              ))}
            </ul>
            <div>
              <label className="mb-1 block text-xs font-semibold tracking-wide text-ink-dim">
                TYPE YOUR NAME TO SIGN
              </label>
              <input
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
                placeholder="Full name"
                className="w-full rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
              />
              <p className="mt-1 text-xs text-ink-muted">
                This is stamped onto the form as your signature (block 9) when you generate it.
              </p>
            </div>
            {error && <p className="text-sm text-bad-ink">{error}</p>}
            <div className="flex gap-2">
              <button
                disabled={submitting || !signatureName.trim()}
                onClick={ackMode === 'submit' ? handleConfirmedSubmit : handleConfirmedResubmit}
                className="rounded-md bg-accent px-3.5 py-2 text-xs font-bold tracking-wide text-accent-ink disabled:opacity-50"
              >
                {submitting ? 'SUBMITTING...' : 'I ACKNOWLEDGE & SUBMIT'}
              </button>
              <button
                onClick={() => setAckMode(null)}
                className="rounded-md bg-neutral-bg px-3.5 py-2 text-xs font-bold tracking-wide text-neutral-ink"
              >
                CANCEL
              </button>
            </div>
          </div>
        </div>
      )}

      <h2 className="mb-2.5 font-display text-sm font-semibold tracking-wide text-ink-dim">MY REQUESTS</h2>
      {requests.length === 0 ? (
        <p className="text-sm text-ink-muted">No SUTA requests yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {requests.map((r) => {
            const makeupBadge = MAKEUP_BADGE[r.makeup_status]
            const makeupCutoff = r.requested_makeup_end_date || r.requested_makeup_date
            const isOverdue = r.makeup_status === 'pending' && !!makeupCutoff && makeupCutoff < today
            return (
              <div
                key={r.id}
                className={`rounded-xl border p-3.5 ${
                  r.correction_notes ? 'border-bad-border bg-bad-bg/10' : 'border-line bg-panel'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-[180px] flex-1">
                    <div className="text-sm font-semibold">{eventLabel(r.drill_event_id)}</div>
                    {r.request_type && (
                      <div className="text-xs text-ink-muted">{SUTA_REQUEST_TYPE_LABEL[r.request_type]}</div>
                    )}
                    {r.duty_location && (
                      <div className="text-xs text-ink-muted">{SUTA_DUTY_LOCATION_LABEL[r.duty_location]}</div>
                    )}
                    {r.duty_unit && <div className="text-xs text-ink-muted">Unit: {r.duty_unit}</div>}
                    <div className="mt-0.5 text-xs italic text-ink-muted">&ldquo;{r.reason}&rdquo;</div>
                    {r.makeup_status === 'pending' && r.requested_makeup_date && (
                      <div className="mt-1 text-xs text-ink-dim">Planned make-up: {formatMakeupDateRange(r)}</div>
                    )}
                    {r.makeup_status === 'completed' && r.makeup_notes && (
                      <div className="mt-1 text-xs text-ink-dim">Make-up: {r.makeup_notes}</div>
                    )}
                    {r.correction_notes && <div className="mt-1 text-xs text-bad-ink">Cadre says: {r.correction_notes}</div>}
                  </div>
                  <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                    <button
                      onClick={() => handlePreview(r)}
                      className="rounded-md bg-neutral-bg px-2.5 py-1 text-[10px] font-bold tracking-wide text-neutral-ink"
                    >
                      PREVIEW FORM
                    </button>
                    <span
                      className={`rounded-md px-2.5 py-1 text-[10px] font-bold tracking-wide ${
                        r.correction_notes ? NEEDS_CORRECTION_BADGE.className : STATUS_BADGE[r.status].className
                      }`}
                    >
                      {r.correction_notes ? NEEDS_CORRECTION_BADGE.label : STATUS_BADGE[r.status].label}
                    </span>
                    {isOverdue ? (
                      <span className="rounded-md bg-bad-bg px-2.5 py-1 text-[10px] font-bold tracking-wide text-bad-ink">
                        OVERDUE
                      </span>
                    ) : (
                      makeupBadge && (
                        <span className={`rounded-md px-2.5 py-1 text-[10px] font-bold tracking-wide ${makeupBadge.className}`}>
                          {makeupBadge.label}
                        </span>
                      )
                    )}
                  </div>
                </div>

                {r.correction_notes && (
                  <div className="mt-3 border-t border-bad-border pt-3">
                    {editingId === r.id ? (
                      <div className="flex flex-col gap-2.5">
                        <select
                          value={editEventId}
                          onChange={(e) => setEditEventId(e.target.value)}
                          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                        >
                          {editEligibleEvents.map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.title} ({EVENT_TYPE_LABEL[e.event_type]}) — {formatEventDateRange(e)}
                            </option>
                          ))}
                        </select>
                        <select
                          value={editRequestType}
                          onChange={(e) => setEditRequestType(e.target.value as SutaRequestType)}
                          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                        >
                          <option value="" disabled>
                            Select request type
                          </option>
                          {(Object.keys(SUTA_REQUEST_TYPE_LABEL) as SutaRequestType[]).map((t) => (
                            <option key={t} value={t}>
                              {SUTA_REQUEST_TYPE_LABEL[t]}
                            </option>
                          ))}
                        </select>
                        <textarea
                          rows={3}
                          value={editReason}
                          onChange={(e) => setEditReason(e.target.value)}
                          className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                        />
                        <div>
                          <label className="mb-1 block text-xs font-semibold tracking-wide text-ink-dim">
                            PLANNED MAKE-UP DATE (OPTIONAL)
                          </label>
                          <div className="flex items-center gap-2">
                            <input
                              type="date"
                              value={editMakeupDate}
                              onChange={(e) => {
                                setEditMakeupDate(e.target.value)
                                if (editMakeupEndDate && editMakeupEndDate < e.target.value) setEditMakeupEndDate(e.target.value)
                              }}
                              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                            />
                            <span className="flex-shrink-0 text-xs text-ink-muted">to</span>
                            <input
                              type="date"
                              value={editMakeupEndDate}
                              min={editMakeupDate || undefined}
                              disabled={!editMakeupDate}
                              onChange={(e) => setEditMakeupEndDate(e.target.value)}
                              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none disabled:opacity-50"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold tracking-wide text-ink-dim">
                            LOCATION DUTY WILL BE PERFORMED (OPTIONAL)
                          </label>
                          <select
                            value={editDutyLocation}
                            onChange={(e) => setEditDutyLocation(e.target.value as SutaDutyLocation)}
                            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                          >
                            <option value="">Not sure yet</option>
                            {(Object.keys(SUTA_DUTY_LOCATION_LABEL) as SutaDutyLocation[]).map((loc) => (
                              <option key={loc} value={loc}>
                                {SUTA_DUTY_LOCATION_LABEL[loc]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="mb-1 block text-xs font-semibold tracking-wide text-ink-dim">
                            UNIT (IF DIFFERENT) — OPTIONAL
                          </label>
                          <select
                            value={editDutyUnit}
                            onChange={(e) => setEditDutyUnit(e.target.value)}
                            className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                          >
                            <option value="">Same as my unit</option>
                            {SUTA_UNIT_OPTIONS.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                            <option value={UNIT_OTHER}>Other...</option>
                          </select>
                          {editDutyUnit === UNIT_OTHER && (
                            <input
                              value={editDutyUnitOther}
                              onChange={(e) => setEditDutyUnitOther(e.target.value)}
                              placeholder="Unit"
                              className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                            />
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            disabled={!editEventId || !editRequestType || !editReason.trim()}
                            onClick={() => openAckModal('resubmit')}
                            className="rounded-md bg-accent px-3.5 py-2 text-xs font-bold tracking-wide text-accent-ink disabled:opacity-50"
                          >
                            RESUBMIT
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded-md bg-neutral-bg px-3.5 py-2 text-xs font-bold tracking-wide text-neutral-ink"
                          >
                            CANCEL
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => startEdit(r)}
                        className="rounded-md bg-accent px-3.5 py-2 text-xs font-bold tracking-wide text-accent-ink"
                      >
                        EDIT &amp; RESUBMIT
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
