import { useState } from 'react'
import { createCounseling, updateCounseling } from '../lib/counselings'
import { todayLocalDateString } from '../lib/dates'
import type { CounselingInput } from '../lib/counselings'
import { errorMessage } from '../lib/errors'
import { useAuth } from '../hooks/useAuth'
import type { Counseling, CounselingType, Soldier } from '../types/database'

interface CounselingFormValues {
  session_date: string
  counseling_type: CounselingType
  counselor_name: string
}

export const COUNSELING_TYPE_LABEL: Record<CounselingType, string> = {
  initial: 'Initial (welcome to the unit)',
  late: 'Late (tardiness)',
}

// This unit runs DA 4856 off a small set of canned scripts, one per
// counseling type -- Organization, Purpose, Key Points, Plan of Action, and
// Leader Responsibilities all come from here rather than free text, so
// records stay consistent instead of drifting into one-off wording. Picking
// a type in the UI just copies its script into the record; the PDF fill
// (fillCounseling in pdfForms.ts) draws whatever ends up stored there and
// has no notion of "type" itself.
interface CounselingScript {
  organization: string
  purpose: string
  keyPoints: string
  planOfAction: string
  leaderResponsibilities: string
}

const COUNSELING_SCRIPTS: Record<CounselingType, CounselingScript> = {
  initial: {
    organization: 'A CO 1-120 IN',
    purpose:
      'The purpose of this counseling is to formally welcome you to the unit, outline your basic roles and responsibilities as a Soldier, and clearly define my standards, expectations, and goals for your performance, conduct, and professional development.',
    // Joined without blank lines between points -- the PDF's Key Points box
    // can't fit this much text at a readable size with extra spacing
    // between all 19 points.
    keyPoints: [
      'Role and Scope: Your primary duty is to perform as an 11B Infantryman within A Co 1-120 IN. You are expected to learn, master, and perform your duties to standard with minimal supervision once trained.',
      'Mission First: You are expected to support the unit’s mission at all times. This means maintaining 100% qualification in your primary duties and completing all assigned tasks to the best of your ability.',
      'Ancillary Training: You are responsible for monitoring and maintaining your individual readiness, including Army Learning Management System (ALMS) courses, Medical Readiness (MEDPROS), and additional duty training requirements.',
      'The "15 Minutes Prior" Rule: Timeliness is non-negotiable in the Army. The standard is to be formed, inspected, and ready to go 10 minutes prior to any scheduled formation or "time hack." If the formation is at 0630, you should be present at 0620.',
      'Accountability: If you are going to be late or cannot make a formation due to an emergency, you must contact me immediately prior to the scheduled time.',
      'Physical Readiness: Physical fitness is a fundamental requirement of being a Soldier. You must participate in all unit Physical Readiness Training (PRT) sessions with high motivation and intensity.',
      'Standards: You are expected to pass the Army Fitness Test (AFT) and maintain compliance with the Army Body Composition Program (ABCP) standards in accordance with AR 600-9.',
      'Self-Discipline: If you fail to meet fitness or body composition standards, it will immediately affect your opportunities for promotion, schools, and overall career advancement. It is your responsibility to maintain your physical readiness on and off duty.',
      'Uniform Standards: You will maintain clean, serviceable, and properly fitted uniforms at all times. Your boots will be clean, and your patches and rank insignia must be correctly placed.',
      'Grooming: You will remain in strict compliance with the grooming standards outlined in AR 670-1 (haircuts, shaving daily, fingernails, jewelry). You are the face of the United States Army; represent it with pride.',
      'Bearing: Conduct yourself in a professional manner at all times. Show composure, self-control, and respect to all Service Members, regardless of rank.',
      'Customs and Courtesies: Always stand at the position of "Attention" when speaking to an Officer, and the position of "Parade Rest" when speaking to a Non-Commissioned Officer (NCO).',
      'Chain of Command: Understand and utilize your Chain of Command. If you have an issue, complaint, or request, bring it to me first so we can work together to resolve it. Our leadership has an open-door policy, but it must be utilized respectfully and through the proper channels.',
      'Safety First: Safety is paramount in everything we do, whether on duty or off duty. Always use the proper Technical Manuals (TMs), wear the required Personal Protective Equipment (PPE), and assign safety observers when performing hazardous tasks.',
      'Off-Duty Conduct: Your conduct off duty reflects directly on the unit and the Army. Do not engage in activities that will compromise your health, safety, or military career.',
      'Zero Tolerance: This command has a zero-tolerance policy for driving under the influence (DUI), drug abuse, sexual harassment/assault (SHARP), and domestic violence. One bad decision can end your military career.',
      'Military Education: I expect you to pursue your professional military education (PME) as soon as you are eligible. Look for opportunities to attend schools (Airborne, Air Assault, Ranger, etc.) that will enhance your capabilities.',
      'Civilian Education: I encourage you to use your Tuition Assistance (TA) or study during your off-duty hours to earn college credits or certifications.',
      'Goal Setting: Within the next 30 days, I want you to write down three short-term goals (next 6 months) and two long-term goals (next 2–5 years) so we can discuss how to achieve them.',
    ].join('\n'),
    planOfAction: [
      'Review Standards: Read and familiarize yourself with AR 670-1 (Wear and Appearance of Army Uniforms) and AR 600-9 (Army Body Composition Program) within 7 days of this counseling.',
      'Punctuality: Arrive at least 10 minutes prior to all formations and daily work call times starting tomorrow.',
      'Physical Fitness: Maintain a personal physical fitness regimen outside of unit PRT hours to ensure you are capable of scoring at least a 400 on the AFT.',
      'Professional Goals: Draft your personal and professional goals (3 short-term, 2 long-term) and present them to me during our first monthly follow-up counseling in 30 days.',
      'Integration: Check-in with the training room, supply, and medical readiness NCOs within the next 5 working days to ensure your records are 100% updated.',
    ].join('\n\n'),
    leaderResponsibilities: [
      'As your supervisor, I will:',
      'Provide you with the tools, training, and guidance necessary to successfully execute your duties.',
      'Monitor your performance daily and provide constructive feedback, both positive and corrective.',
      'Keep you informed of any changes to training schedules, duty requirements, or unit policies.',
      'Assist you in achieving your personal and professional goals, including helping you submit packets for military schools or tuition assistance.',
      'Conduct formal monthly follow-up counselings to evaluate your progress.',
    ].join('\n'),
  },
  late: {
    organization: 'A CO 1-120 IN',
    purpose:
      'The purpose of this counseling is to address your recent failure to report to formation/duty at the prescribed time. Timeliness and accountability are non-negotiable standards for every Soldier, and this session ensures you understand the standard, the impact of your actions, and the corrective actions required going forward.',
    keyPoints: [
      'Incident: You failed to report to formation/duty at the required time, per the report from your chain of command.',
      'Standard: AR 600-20 and unit SOP require all Soldiers to be present, in the proper uniform, and ready 10 minutes prior to any formation or appointment.',
      'Impact on the Unit: Tardiness undermines unit readiness, disrupts training schedules, and places additional burden on your peers and chain of command.',
      'Accountability: If an emergency prevents you from being on time, you are required to notify your chain of command immediately, prior to the scheduled time -- not after the fact.',
      'UCMJ Implications: Repeated or uncorrected tardiness may be punishable under Article 86, UCMJ (Absence Without Leave), and can result in adverse administrative or judicial action.',
      'Career Impact: A pattern of tardiness reflects poor discipline and reliability and will be considered in evaluations and future recommendations.',
    ].join('\n'),
    planOfAction: [
      'Punctuality: Report to all formations and duty appointments no later than 10 minutes prior to the designated time, effective immediately.',
      'Notification: If any circumstance will prevent on-time arrival, contact your first-line supervisor or the CQ/Staff Duty NCO immediately, before the scheduled time.',
      'Self-Assessment: Identify and correct the root cause of your tardiness (transportation, time management, wake-up routine, etc.) within 7 days.',
      'Follow-up: A follow-up counseling will be conducted in 30 days to assess whether the standard has been met.',
    ].join('\n\n'),
    leaderResponsibilities: [
      'As your supervisor, I will:',
      'Monitor your attendance and punctuality at all formations and appointments.',
      'Provide any support or resources needed to help you meet the standard.',
      'Document any further incidents and take appropriate corrective action if the pattern continues.',
      'Conduct a formal follow-up counseling in 30 days to evaluate your progress.',
    ].join('\n'),
  },
}

function emptyCounselingForm(): CounselingFormValues {
  return {
    session_date: todayLocalDateString(),
    counseling_type: 'initial',
    counselor_name: '',
  }
}

function counselingToForm(c: Counseling): CounselingFormValues {
  return {
    session_date: c.session_date,
    counseling_type: c.counseling_type,
    counselor_name: c.counselor_name,
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

export function CounselingModal({ soldier, existing, onClose, onSaved }: CounselingModalProps) {
  const { session } = useAuth()
  const [form, setForm] = useState<CounselingFormValues>(existing ? counselingToForm(existing) : emptyCounselingForm())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canSubmit = !!(form.session_date && form.counselor_name)

  async function handleSubmit() {
    if (!canSubmit || !session) return
    setSubmitting(true)
    setError(null)
    const script = COUNSELING_SCRIPTS[form.counseling_type]
    const input: CounselingInput = {
      soldierId: soldier.id,
      sessionDate: form.session_date,
      counselingType: form.counseling_type,
      organization: script.organization,
      counselorName: form.counselor_name,
      purpose: script.purpose,
      keyPoints: script.keyPoints,
      planOfAction: script.planOfAction,
      leaderResponsibilities: script.leaderResponsibilities,
      // Both of these are the Soldier's own words, not the counselor's --
      // remarks come from their acknowledgeCounseling, assessment from a
      // follow-up session -- so an edit here must carry forward whatever's
      // already there instead of wiping it.
      individualRemarks: existing?.individual_remarks ?? null,
      assessment: existing?.assessment ?? null,
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
          <div className="col-span-2">
            <label className={labelClass}>COUNSELING TYPE</label>
            <select
              value={form.counseling_type}
              onChange={(e) => setForm((p) => ({ ...p, counseling_type: e.target.value as CounselingType }))}
              className={inputClass}
            >
              {(Object.keys(COUNSELING_TYPE_LABEL) as CounselingType[]).map((type) => (
                <option key={type} value={type}>
                  {COUNSELING_TYPE_LABEL[type]}
                </option>
              ))}
            </select>
          </div>
          <div className="col-span-2">
            <label className={labelClass}>DATE OF COUNSELING</label>
            <input
              type="date"
              value={form.session_date}
              onChange={(e) => setForm((p) => ({ ...p, session_date: e.target.value }))}
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
        </div>

        <p className="text-xs text-ink-faint">
          Organization, Purpose, Key Points, Plan of Action, and Leader Responsibilities come from the selected
          type&rsquo;s standard script, not free text. The Soldier&rsquo;s agree/disagree, remarks, signature, and date
          are completed on the generated PDF at the actual counseling — only the counselor&rsquo;s signature line is
          pre-filled. Assessment of the plan of action is completed at a later follow-up session.
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
