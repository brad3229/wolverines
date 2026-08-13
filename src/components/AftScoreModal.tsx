import { useState } from 'react'
import { createAftTest, updateAftTest } from '../lib/aft'
import { todayLocalDateString } from '../lib/dates'
import type { AftTestInput } from '../lib/aft'
import {
  deadliftPoints,
  pushupPoints,
  sdcPoints,
  plankPoints,
  runEventPoints,
  parseMmSsToSeconds,
  overallAftResult,
} from '../lib/aftScoring'
import { AFT_RESULT_LABEL } from '../lib/aft'
import { errorMessage } from '../lib/errors'
import { useAuth } from '../hooks/useAuth'
import type { AftRunEventType, AftStandard, AftTest, Soldier } from '../types/database'

interface AftFormValues {
  test_date: string
  standard: AftStandard | ''
  aoc_mos: string
  rank_at_test: string
  age: string
  deadlift_lbs: string
  pushup_reps: string
  sdc_time: string
  plank_time: string
  run_event_type: AftRunEventType
  run_event_time: string
}

function emptyAftForm(soldier: Soldier): AftFormValues {
  return {
    test_date: todayLocalDateString(),
    standard: '',
    aoc_mos: '',
    rank_at_test: soldier.rank,
    age: '',
    deadlift_lbs: '',
    pushup_reps: '',
    sdc_time: '',
    plank_time: '',
    run_event_type: 'two_mile_run',
    run_event_time: '',
  }
}

function aftTestToForm(test: AftTest): AftFormValues {
  return {
    test_date: test.test_date,
    standard: test.standard,
    aoc_mos: test.aoc_mos ?? '',
    rank_at_test: test.rank_at_test ?? '',
    age: test.age != null ? String(test.age) : '',
    deadlift_lbs: test.deadlift_lbs != null ? String(test.deadlift_lbs) : '',
    pushup_reps: test.pushup_reps != null ? String(test.pushup_reps) : '',
    sdc_time: test.sdc_time ?? '',
    plank_time: test.plank_time ?? '',
    run_event_type: test.run_event_type,
    run_event_time: test.run_event_time ?? '',
  }
}

interface AftScoreModalProps {
  soldier: Soldier
  // Pass an existing test to edit it in place; omit/null to add a new one.
  existing?: AftTest | null
  onClose: () => void
  onSaved: () => void
}

const inputClass =
  'w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none'
const labelClass = 'mb-1 block text-[11px] font-semibold tracking-wide text-ink-faint'
const pointsDisplayClass =
  'flex h-[38px] w-full items-center rounded-md border border-line-soft bg-surface/60 px-3 text-sm text-ink-dim'

function PointsDisplay({ value }: { value: number | null }) {
  return <div className={pointsDisplayClass}>{value ?? '—'}</div>
}

export function AftScoreModal({ soldier, existing, onClose, onSaved }: AftScoreModalProps) {
  const { session } = useAuth()
  const [form, setForm] = useState<AftFormValues>(existing ? aftTestToForm(existing) : emptyAftForm(soldier))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Points are calculated live from the official AFT score tables (HQDA
  // EXORD 218-25, effective 1 June 2025) as raw values are entered -- not
  // editable directly, so there's no way for the displayed score to drift
  // from what the Soldier actually did. Combat standard scores sex-neutral
  // (same column as male), so standard has to be picked before scoring can
  // start, same as age/sex.
  const age = form.age ? Number(form.age) : null
  const sex = soldier.sex
  const standard = form.standard || null
  const canScore = age != null && sex != null && standard != null

  const dlPoints =
    canScore && form.deadlift_lbs ? deadliftPoints(Number(form.deadlift_lbs), age, sex, standard) : null
  const puPoints = canScore && form.pushup_reps ? pushupPoints(Number(form.pushup_reps), age, sex, standard) : null
  const sdcSeconds = parseMmSsToSeconds(form.sdc_time)
  const sdcPts = canScore && sdcSeconds != null ? sdcPoints(sdcSeconds, age, sex, standard) : null
  const plankSeconds = parseMmSsToSeconds(form.plank_time)
  const plankPts = canScore && plankSeconds != null ? plankPoints(plankSeconds, age, sex, standard) : null
  const runSeconds = parseMmSsToSeconds(form.run_event_time)
  const runPts =
    canScore && runSeconds != null ? runEventPoints(form.run_event_type, runSeconds, age, sex, standard) : null

  const allScored = [dlPoints, puPoints, sdcPts, plankPts, runPts].every((p) => p != null)
  const totalPoints = allScored ? dlPoints! + puPoints! + sdcPts! + plankPts! + runPts! : null
  const overallResult = standard ? overallAftResult(standard, [dlPoints, puPoints, sdcPts, plankPts, runPts]) : null

  async function handleSubmit() {
    if (!form.test_date || !form.standard || !session) return
    setSubmitting(true)
    setError(null)
    const input: AftTestInput = {
      soldierId: soldier.id,
      testDate: form.test_date,
      standard: form.standard,
      aocMos: form.aoc_mos || null,
      rankAtTest: form.rank_at_test || null,
      age,
      deadliftLbs: form.deadlift_lbs ? Number(form.deadlift_lbs) : null,
      deadliftPoints: dlPoints,
      pushupReps: form.pushup_reps ? Number(form.pushup_reps) : null,
      pushupPoints: puPoints,
      sdcTime: form.sdc_time || null,
      sdcPoints: sdcPts,
      plankTime: form.plank_time || null,
      plankPoints: plankPts,
      runEventType: form.run_event_type,
      runEventTime: form.run_event_time || null,
      runEventPoints: runPts,
      totalPoints,
      overallResult,
    }
    try {
      if (existing) {
        await updateAftTest(existing.id, input)
      } else {
        await createAftTest(input, session.user.id)
      }
      onSaved()
    } catch (err) {
      setError(errorMessage(err, 'Failed to save AFT score'))
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
          {existing ? 'Edit' : 'Add'} AFT Score — {soldier.rank} {soldier.last_name}, {soldier.first_name}
        </div>

        {!sex && (
          <p className="rounded-md bg-warn-bg px-3 py-2 text-xs text-warn-ink">
            This Soldier has no sex on file, so points can&rsquo;t be calculated yet. Set it on their Roster page,
            then come back here.
          </p>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          <div>
            <label className={labelClass}>TEST DATE</label>
            <input
              type="date"
              value={form.test_date}
              onChange={(e) => setForm((p) => ({ ...p, test_date: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>STANDARD</label>
            <select
              value={form.standard}
              onChange={(e) => setForm((p) => ({ ...p, standard: e.target.value as AftStandard }))}
              className={inputClass}
            >
              <option value="" disabled>
                Select
              </option>
              <option value="combat">Combat</option>
              <option value="general">General</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>AOC/MOS</label>
            <input
              value={form.aoc_mos}
              onChange={(e) => setForm((p) => ({ ...p, aoc_mos: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>RANK/GRADE</label>
            <input
              value={form.rank_at_test}
              onChange={(e) => setForm((p) => ({ ...p, rank_at_test: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>AGE (at time of test)</label>
            <input
              type="number"
              value={form.age}
              onChange={(e) => setForm((p) => ({ ...p, age: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>OVERALL RESULT</label>
            <div
              className={`flex h-[38px] w-full items-center rounded-md border border-line-soft px-3 text-sm font-bold ${
                overallResult === 'go'
                  ? 'bg-good-bg text-good-ink'
                  : overallResult === 'nogo'
                    ? 'bg-bad-bg text-bad-ink'
                    : 'bg-surface/60 text-ink-dim'
              }`}
            >
              {overallResult ? AFT_RESULT_LABEL[overallResult] : '—'}
            </div>
          </div>

          <div className="col-span-2 mt-1 border-t border-line pt-2">
            <h3 className="font-display text-[11px] font-semibold tracking-wide text-ink-muted">
              3RM DEADLIFT (heaviest, lbs)
            </h3>
          </div>
          <div>
            <label className={labelClass}>WEIGHT</label>
            <input
              type="number"
              value={form.deadlift_lbs}
              onChange={(e) => setForm((p) => ({ ...p, deadlift_lbs: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>POINTS</label>
            <PointsDisplay value={dlPoints} />
          </div>

          <div className="col-span-2 mt-1 border-t border-line pt-2">
            <h3 className="font-display text-[11px] font-semibold tracking-wide text-ink-muted">HAND-RELEASE PUSH-UP</h3>
          </div>
          <div>
            <label className={labelClass}>REPETITIONS</label>
            <input
              type="number"
              value={form.pushup_reps}
              onChange={(e) => setForm((p) => ({ ...p, pushup_reps: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>POINTS</label>
            <PointsDisplay value={puPoints} />
          </div>

          <div className="col-span-2 mt-1 border-t border-line pt-2">
            <h3 className="font-display text-[11px] font-semibold tracking-wide text-ink-muted">SPRINT-DRAG-CARRY</h3>
          </div>
          <div>
            <label className={labelClass}>TIME (mm:ss)</label>
            <input
              placeholder="e.g. 2:30"
              value={form.sdc_time}
              onChange={(e) => setForm((p) => ({ ...p, sdc_time: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>POINTS</label>
            <PointsDisplay value={sdcPts} />
          </div>

          <div className="col-span-2 mt-1 border-t border-line pt-2">
            <h3 className="font-display text-[11px] font-semibold tracking-wide text-ink-muted">PLANK</h3>
          </div>
          <div>
            <label className={labelClass}>TIME (mm:ss)</label>
            <input
              placeholder="e.g. 3:00"
              value={form.plank_time}
              onChange={(e) => setForm((p) => ({ ...p, plank_time: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>POINTS</label>
            <PointsDisplay value={plankPts} />
          </div>

          <div className="col-span-2 mt-1 border-t border-line pt-2">
            <h3 className="font-display text-[11px] font-semibold tracking-wide text-ink-muted">
              2-MILE RUN OR ALTERNATE EVENT
            </h3>
          </div>
          <div className="col-span-2">
            <label className={labelClass}>EVENT</label>
            <select
              value={form.run_event_type}
              onChange={(e) => setForm((p) => ({ ...p, run_event_type: e.target.value as AftRunEventType }))}
              className={inputClass}
            >
              <option value="two_mile_run">2-Mile Run</option>
              <option value="row_5k">5K Row</option>
              <option value="swim_1k">1K Swim</option>
              <option value="bike_12k">12K Bike</option>
              <option value="walk_2_5mi">2.5 Mile Walk</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>TIME (mm:ss)</label>
            <input
              placeholder="e.g. 15:30"
              value={form.run_event_time}
              onChange={(e) => setForm((p) => ({ ...p, run_event_time: e.target.value }))}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>POINTS{form.run_event_type !== 'two_mile_run' ? ' (GO=60 / NO-GO=0)' : ''}</label>
            <PointsDisplay value={runPts} />
          </div>

          <div className="col-span-2 mt-1 border-t border-line pt-2">
            <label className={labelClass}>TOTAL POINTS</label>
            <div className={`${pointsDisplayClass} font-display text-base font-semibold text-ink`}>
              {totalPoints ?? '—'}
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-bad-ink">{error}</p>}
        <div className="flex gap-2">
          <button
            disabled={submitting || !form.test_date || !form.standard}
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
