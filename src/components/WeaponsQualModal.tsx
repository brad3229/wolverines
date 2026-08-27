import { useState } from 'react'
import { createWeaponsQualification, updateWeaponsQualification, qualificationRatingForTotal } from '../lib/weaponsQual'
import { WEAPONS_QUAL_RATING_LABEL } from '../lib/weaponsQual'
import { todayLocalDateString } from '../lib/dates'
import type { WeaponsQualInput } from '../lib/weaponsQual'
import { errorMessage } from '../lib/errors'
import { useAuth } from '../hooks/useAuth'
import type { Soldier, WeaponsQualification, WeaponsQualTableType } from '../types/database'

interface WeaponsQualFormValues {
  qual_date: string
  weapon_type: string
  equipment_optics: string
  lane_firing_order: string
  table_type: WeaponsQualTableType | ''
  phase1_hits: string
  phase2_hits: string
  phase3_hits: string
  phase4_hits: string
  range_oic_name: string
  remarks: string
}

function emptyWeaponsQualForm(): WeaponsQualFormValues {
  return {
    qual_date: todayLocalDateString(),
    weapon_type: '',
    equipment_optics: '',
    lane_firing_order: '',
    table_type: '',
    phase1_hits: '',
    phase2_hits: '',
    phase3_hits: '',
    phase4_hits: '',
    range_oic_name: '',
    remarks: '',
  }
}

function qualToForm(q: WeaponsQualification): WeaponsQualFormValues {
  return {
    qual_date: q.qual_date,
    weapon_type: q.weapon_type,
    equipment_optics: q.equipment_optics ?? '',
    lane_firing_order: q.lane_firing_order ?? '',
    table_type: q.table_type,
    phase1_hits: q.phase1_hits != null ? String(q.phase1_hits) : '',
    phase2_hits: q.phase2_hits != null ? String(q.phase2_hits) : '',
    phase3_hits: q.phase3_hits != null ? String(q.phase3_hits) : '',
    phase4_hits: q.phase4_hits != null ? String(q.phase4_hits) : '',
    range_oic_name: q.range_oic_name ?? '',
    remarks: q.remarks ?? '',
  }
}

interface WeaponsQualModalProps {
  soldier: Soldier
  // Pass an existing qualification to edit it in place; omit/null to add a new one.
  existing?: WeaponsQualification | null
  onClose: () => void
  onSaved: () => void
}

const inputClass =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none'
const labelClass = 'mb-1 block text-[11px] font-semibold tracking-wide text-ink-faint'
const totalDisplayClass =
  'flex h-[38px] w-full items-center justify-center rounded-md border border-line-soft bg-surface/60 px-3 font-display text-base font-semibold text-ink'

export function WeaponsQualModal({ soldier, existing, onClose, onSaved }: WeaponsQualModalProps) {
  const { session } = useAuth()
  const [form, setForm] = useState<WeaponsQualFormValues>(existing ? qualToForm(existing) : emptyWeaponsQualForm())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Stage I total (out of 40) and qualification rating are derived live from
  // the four phase hit counts, straight off the score bands on the form
  // itself -- never typed in directly, so the two can't drift apart.
  const phaseHits = [form.phase1_hits, form.phase2_hits, form.phase3_hits, form.phase4_hits]
  const allPhasesEntered = phaseHits.every((h) => h !== '')
  const totalHits = allPhasesEntered ? phaseHits.reduce((sum, h) => sum + Number(h), 0) : null
  const qualificationRating = qualificationRatingForTotal(totalHits)

  const canSubmit = !!(form.qual_date && form.weapon_type.trim() && form.table_type)

  async function handleSubmit() {
    if (!canSubmit || !form.table_type || !session) return
    setSubmitting(true)
    setError(null)
    const input: WeaponsQualInput = {
      soldierId: soldier.id,
      qualDate: form.qual_date,
      weaponType: form.weapon_type.trim(),
      equipmentOptics: form.equipment_optics || null,
      laneFiringOrder: form.lane_firing_order || null,
      tableType: form.table_type,
      phase1Hits: form.phase1_hits ? Number(form.phase1_hits) : null,
      phase2Hits: form.phase2_hits ? Number(form.phase2_hits) : null,
      phase3Hits: form.phase3_hits ? Number(form.phase3_hits) : null,
      phase4Hits: form.phase4_hits ? Number(form.phase4_hits) : null,
      totalHits,
      qualificationRating,
      rangeOicName: form.range_oic_name || null,
      remarks: form.remarks || null,
    }
    try {
      if (existing) {
        await updateWeaponsQualification(existing.id, input)
      } else {
        await createWeaponsQualification(input, session.user.id)
      }
      onSaved()
    } catch (err) {
      setError(errorMessage(err, 'Failed to save weapons qualification'))
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
          {existing ? 'Edit' : 'Add'} Weapons Qual — {soldier.rank} {soldier.last_name}, {soldier.first_name}
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className={labelClass}>QUAL DATE</label>
            <input
              type="date"
              value={form.qual_date}
              onChange={(e) => setForm((p) => ({ ...p, qual_date: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>TABLE</label>
            <select
              value={form.table_type}
              onChange={(e) => setForm((p) => ({ ...p, table_type: e.target.value as WeaponsQualTableType }))}
              className={inputClass}
            >
              <option value="" disabled>
                Select
              </option>
              <option value="practice">Table V (Practice)</option>
              <option value="qualification">Table VI (Qualification)</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>WEAPON TYPE</label>
            <select
              value={form.weapon_type}
              onChange={(e) => setForm((p) => ({ ...p, weapon_type: e.target.value }))}
              className={inputClass}
            >
              <option value="" disabled>
                Select
              </option>
              <option value="M4">M4</option>
              <option value="M249">M249</option>
              <option value="M7">M7</option>
              <option value="M250">M250</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>EQUIPMENT/OPTICS (OPTIONAL)</label>
            <select
              value={form.equipment_optics}
              onChange={(e) => setForm((p) => ({ ...p, equipment_optics: e.target.value }))}
              className={inputClass}
            >
              <option value="">Select</option>
              <option value="Iron Sights">Iron Sights</option>
              <option value="ACOG">ACOG</option>
              <option value="CCO">CCO</option>
              <option value="M157">M157</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>LANE/FIRING ORDER (OPTIONAL)</label>
            <input
              value={form.lane_firing_order}
              onChange={(e) => setForm((p) => ({ ...p, lane_firing_order: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>RANGE OIC NAME/RANK (OPTIONAL)</label>
            <input
              placeholder="e.g. SFC Owens, Bradford"
              value={form.range_oic_name}
              onChange={(e) => setForm((p) => ({ ...p, range_oic_name: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div className="col-span-2 mt-1 border-t border-line pt-2">
            <h3 className="font-display text-[11px] font-semibold tracking-wide text-ink-muted">
              STAGE I HITS (0-10 PER PHASE)
            </h3>
          </div>
          <div>
            <label className={labelClass}>PHASE 1 (STANDING/PRONE)</label>
            <input
              type="number"
              min={0}
              max={10}
              value={form.phase1_hits}
              onChange={(e) => setForm((p) => ({ ...p, phase1_hits: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>PHASE 2 (PRONE SUPPORTED)</label>
            <input
              type="number"
              min={0}
              max={10}
              value={form.phase2_hits}
              onChange={(e) => setForm((p) => ({ ...p, phase2_hits: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>PHASE 3 (KNEELING SUPPORTED)</label>
            <input
              type="number"
              min={0}
              max={10}
              value={form.phase3_hits}
              onChange={(e) => setForm((p) => ({ ...p, phase3_hits: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>PHASE 4 (STANDING SUPPORTED)</label>
            <input
              type="number"
              min={0}
              max={10}
              value={form.phase4_hits}
              onChange={(e) => setForm((p) => ({ ...p, phase4_hits: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div className="col-span-2 mt-1 border-t border-line pt-2">
            <label className={labelClass}>STAGE I TOTAL / RATING</label>
            <div className={totalDisplayClass}>
              {totalHits != null
                ? `${totalHits} / 40 — ${qualificationRating ? WEAPONS_QUAL_RATING_LABEL[qualificationRating] : '—'}`
                : 'Enter all four phases'}
            </div>
          </div>

          <div className="col-span-2">
            <label className={labelClass}>REMARKS (OPTIONAL)</label>
            <textarea
              value={form.remarks}
              onChange={(e) => setForm((p) => ({ ...p, remarks: e.target.value }))}
              className={`${inputClass} min-h-[70px] resize-y`}
            />
          </div>
        </div>

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
