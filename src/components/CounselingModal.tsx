import { useState } from 'react'
import { createCounseling, updateCounseling } from '../lib/counselings'
import { todayLocalDateString } from '../lib/dates'
import type { CounselingInput } from '../lib/counselings'
import { errorMessage } from '../lib/errors'
import { useAuth } from '../hooks/useAuth'
import type { Counseling, Soldier } from '../types/database'

interface CounselingFormValues {
  session_date: string
  organization: string
  counselor_name: string
  purpose: string
  key_points: string
  plan_of_action: string
  leader_responsibilities: string
  individual_remarks: string
  assessment: string
}

function emptyCounselingForm(): CounselingFormValues {
  return {
    session_date: todayLocalDateString(),
    organization: 'A CO 1-120 IN',
    counselor_name: '',
    purpose: 'Initial Counseling',
    key_points: '',
    plan_of_action: '',
    leader_responsibilities: '',
    individual_remarks: '',
    assessment: '',
  }
}

function counselingToForm(c: Counseling): CounselingFormValues {
  return {
    session_date: c.session_date,
    organization: c.organization,
    counselor_name: c.counselor_name,
    purpose: c.purpose,
    key_points: c.key_points,
    plan_of_action: c.plan_of_action,
    leader_responsibilities: c.leader_responsibilities ?? '',
    individual_remarks: c.individual_remarks ?? '',
    assessment: c.assessment ?? '',
  }
}

interface CounselingModalProps {
  soldier: Soldier
  // Pass an existing counseling to edit it in place; omit/null to add a new one.
  existing?: Counseling | null
  onClose: () => void
  onSaved: () => void
}

const inputClass =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none'
const labelClass = 'mb-1 block text-[11px] font-semibold tracking-wide text-ink-faint'
const textareaClass = `${inputClass} min-h-[90px] resize-y`

export function CounselingModal({ soldier, existing, onClose, onSaved }: CounselingModalProps) {
  const { session } = useAuth()
  const [form, setForm] = useState<CounselingFormValues>(existing ? counselingToForm(existing) : emptyCounselingForm())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = !!(form.session_date && form.counselor_name && form.purpose && form.key_points && form.plan_of_action)

  async function handleSubmit() {
    if (!canSubmit || !session) return
    setSubmitting(true)
    setError(null)
    const input: CounselingInput = {
      soldierId: soldier.id,
      sessionDate: form.session_date,
      organization: form.organization,
      counselorName: form.counselor_name,
      purpose: form.purpose,
      keyPoints: form.key_points,
      planOfAction: form.plan_of_action,
      leaderResponsibilities: form.leader_responsibilities || null,
      individualRemarks: form.individual_remarks || null,
      assessment: form.assessment || null,
    }
    try {
      if (existing) {
        await updateCounseling(existing.id, input)
      } else {
        await createCounseling(input, session.user.id)
      }
      onSaved()
    } catch (err) {
      setError(errorMessage(err, 'Failed to save counseling'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="flex w-full max-w-lg max-h-[85vh] flex-col gap-2.5 overflow-y-auto rounded-xl border border-line bg-panel p-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-sm font-semibold">
          {existing ? 'Edit' : 'Add'} Counseling — {soldier.rank} {soldier.last_name}, {soldier.first_name}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className={labelClass}>DATE OF COUNSELING</label>
            <input
              type="date"
              value={form.session_date}
              onChange={(e) => setForm((p) => ({ ...p, session_date: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>ORGANIZATION</label>
            <input
              value={form.organization}
              onChange={(e) => setForm((p) => ({ ...p, organization: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>NAME AND TITLE OF COUNSELOR</label>
            <input
              placeholder="e.g. SFC Owens, Bradford"
              value={form.counselor_name}
              onChange={(e) => setForm((p) => ({ ...p, counselor_name: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>PURPOSE OF COUNSELING</label>
            <input
              value={form.purpose}
              onChange={(e) => setForm((p) => ({ ...p, purpose: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>KEY POINTS OF DISCUSSION</label>
            <textarea
              value={form.key_points}
              onChange={(e) => setForm((p) => ({ ...p, key_points: e.target.value }))}
              className={textareaClass}
            />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>PLAN OF ACTION</label>
            <textarea
              value={form.plan_of_action}
              onChange={(e) => setForm((p) => ({ ...p, plan_of_action: e.target.value }))}
              className={textareaClass}
            />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>LEADER RESPONSIBILITIES (OPTIONAL)</label>
            <textarea
              value={form.leader_responsibilities}
              onChange={(e) => setForm((p) => ({ ...p, leader_responsibilities: e.target.value }))}
              className={textareaClass}
            />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>INDIVIDUAL COUNSELED REMARKS (OPTIONAL)</label>
            <textarea
              value={form.individual_remarks}
              onChange={(e) => setForm((p) => ({ ...p, individual_remarks: e.target.value }))}
              className={textareaClass}
            />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>ASSESSMENT OF THE PLAN OF ACTION (OPTIONAL)</label>
            <textarea
              value={form.assessment}
              onChange={(e) => setForm((p) => ({ ...p, assessment: e.target.value }))}
              className={textareaClass}
            />
          </div>
        </div>

        <p className="text-xs text-ink-faint">
          The Soldier&rsquo;s agree/disagree, signature, and dates are completed on the generated PDF at the actual
          counseling — only the counselor&rsquo;s signature line is pre-filled.
        </p>

        {error && <p className="text-sm text-bad-ink">{error}</p>}
        <div className="flex gap-2">
          <button
            disabled={submitting || !canSubmit}
            onClick={handleSubmit}
            className="rounded-md bg-accent px-3.5 py-2 text-xs font-bold tracking-wide text-accent-ink disabled:opacity-50"
          >
            {submitting ? 'SAVING...' : 'SAVE'}
          </button>
          <button
            onClick={onClose}
            className="rounded-md bg-neutral-bg px-3.5 py-2 text-xs font-bold tracking-wide text-neutral-ink"
          >
            CANCEL
          </button>
        </div>
      </div>
    </div>
  )
}
