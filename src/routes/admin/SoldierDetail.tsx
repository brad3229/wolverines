import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getSoldier, updateSoldier } from '../../lib/soldiers'
import { inviteSoldierAccount, setUserRole } from '../../lib/adminApi'
import { getProfileRole } from '../../lib/profiles'
import { errorMessage } from '../../lib/errors'
import { listEditRequests, reviewEditRequest, coerceEditRequestValue, formatEditRequestValue } from '../../lib/editRequests'
import { notify } from '../../lib/notifications'
import { getAttendanceHistory, attendanceBadge } from '../../lib/attendance'
import type { AttendanceHistoryEntry } from '../../lib/attendance'
import { formatEventDateRange } from '../../lib/drillEvents'
import { listOwnSutaRequests } from '../../lib/sutaRequests'
import { listOwnGearRequests } from '../../lib/gearRequests'
import { listOwnPayIssues } from '../../lib/payIssues'
import { listActiveTaskLists, listTaskItems, listOwnCompletions } from '../../lib/tasks'
import { listAftTestsForSoldier, deleteAftTest, AFT_STANDARD_LABEL, AFT_RESULT_LABEL } from '../../lib/aft'
import { formatDate, todayLocalDateString } from '../../lib/dates'
import { SoldierForm, soldierFormValuesToPayload } from '../../components/SoldierForm'
import { BackButton } from '../../components/BackButton'
import { SoldierAvatar } from '../../components/SoldierAvatar'
import { LoadingScreen } from '../../components/LoadingScreen'
import { AftScoreModal } from '../../components/AftScoreModal'
import { IconAttendance, IconSuta, IconGear, IconPay, IconTasks, IconNote } from '../../components/icons'
import { useAuth } from '../../hooks/useAuth'
import type { AftTest, EditRequest, Soldier, UserRole } from '../../types/database'

interface ReadinessSnapshot {
  sutaPending: number
  sutaOverdue: number
  gearOpen: number
  payOpen: number
  tasksTotal: number
  tasksVerified: number
}

const READINESS_TONE_CLASS: Record<'good' | 'warn' | 'bad' | 'neutral', string> = {
  good: 'text-good-ink',
  warn: 'text-warn-ink',
  bad: 'text-bad-ink',
  neutral: 'text-ink-muted',
}

async function loadReadinessSnapshot(soldierId: string): Promise<ReadinessSnapshot> {
  const today = todayLocalDateString()
  const [sutaRequests, gearRequests, payIssues, taskLists, completions] = await Promise.all([
    listOwnSutaRequests(soldierId),
    listOwnGearRequests(soldierId),
    listOwnPayIssues(soldierId),
    listActiveTaskLists(soldierId),
    listOwnCompletions(soldierId),
  ])
  const items = (await Promise.all(taskLists.map((l) => listTaskItems(l.id)))).flat()
  const verifiedIds = new Set(completions.filter((c) => c.status === 'verified').map((c) => c.task_item_id))
  return {
    sutaPending: sutaRequests.filter((r) => r.status === 'pending').length,
    sutaOverdue: sutaRequests.filter(
      (r) =>
        r.status === 'approved' &&
        r.makeup_status === 'pending' &&
        !!r.requested_makeup_date &&
        r.requested_makeup_date < today,
    ).length,
    gearOpen: gearRequests.filter((r) => r.status !== 'resolved').length,
    payOpen: payIssues.filter((i) => i.status !== 'resolved').length,
    tasksTotal: items.length,
    tasksVerified: items.filter((i) => verifiedIds.has(i.id)).length,
  }
}

export function SoldierDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { session, refreshPendingCounts } = useAuth()
  const [soldier, setSoldier] = useState<Soldier | null>(null)
  const [editRequests, setEditRequests] = useState<EditRequest[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteStatus, setInviteStatus] = useState<string | null>(null)
  const [showEmailInput, setShowEmailInput] = useState(false)
  const [accountRole, setAccountRole] = useState<UserRole | null>(null)
  const [confirmingRoleChange, setConfirmingRoleChange] = useState(false)
  const [roleChangeLoading, setRoleChangeLoading] = useState(false)
  const [roleChangeError, setRoleChangeError] = useState<string | null>(null)
  const [confirmingSelfLink, setConfirmingSelfLink] = useState(false)
  const [selfLinkLoading, setSelfLinkLoading] = useState(false)
  const [selfLinkError, setSelfLinkError] = useState<string | null>(null)
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceHistoryEntry[] | null>(null)
  const [attendanceRate, setAttendanceRate] = useState<number | null>(null)
  const [readiness, setReadiness] = useState<ReadinessSnapshot | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [noteModal, setNoteModal] = useState<{ name: string; reason: string } | null>(null)
  const [aftTests, setAftTests] = useState<AftTest[]>([])
  const [aftModalMode, setAftModalMode] = useState<'new' | 'edit' | null>(null)
  const [aftEditingTest, setAftEditingTest] = useState<AftTest | null>(null)
  const [confirmingDeleteAft, setConfirmingDeleteAft] = useState<string | null>(null)

  function refresh() {
    if (!id) return
    setLoadError(null)
    getSoldier(id)
      .then((s) => {
        setSoldier(s)
        setInviteEmail(s.personal_email ?? '')
        if (s.profile_id) getProfileRole(s.profile_id).then(setAccountRole)

        getAttendanceHistory(s.id).then(({ history, rate }) => {
          setAttendanceHistory(history)
          setAttendanceRate(rate)
        })

        loadReadinessSnapshot(s.id)
          .then(setReadiness)
          .catch(() => setReadiness(null))

        listAftTestsForSoldier(s.id)
          .then(setAftTests)
          .catch(() => setAftTests([]))
      })
      .catch((err) => setLoadError(errorMessage(err, 'Failed to load Soldier')))
    listEditRequests()
      .then((all) => setEditRequests(all.filter((r) => r.soldier_id === id && r.status === 'pending')))
      .catch((err) => setLoadError(errorMessage(err, 'Failed to load edit requests')))
  }

  useEffect(refresh, [id])

  if (!soldier) return loadError ? <p className="text-sm text-bad-ink">{loadError}</p> : <LoadingScreen />

  async function handleInvite() {
    if (!id || !inviteEmail) return
    if (session?.user.email?.toLowerCase() === inviteEmail.trim().toLowerCase()) {
      setInviteStatus("That's your own admin login email — invite the Soldier's own email instead.")
      return
    }
    setInviteStatus('Sending invite...')
    try {
      await inviteSoldierAccount({ email: inviteEmail, soldierId: id })
      setInviteStatus('Invite sent.')
    } catch (err) {
      setInviteStatus(errorMessage(err, 'Failed to send invite'))
    }
  }

  async function handleLinkToMyAccount() {
    if (!id || !session) return
    setSelfLinkLoading(true)
    setSelfLinkError(null)
    try {
      await updateSoldier(id, { profile_id: session.user.id })
      setConfirmingSelfLink(false)
      refresh()
    } catch (err) {
      setSelfLinkError(errorMessage(err, 'Failed to link account'))
    } finally {
      setSelfLinkLoading(false)
    }
  }

  async function handleRoleChange(role: UserRole) {
    if (!soldier?.profile_id) return
    setRoleChangeLoading(true)
    setRoleChangeError(null)
    try {
      await setUserRole({ profileId: soldier.profile_id, role })
      setAccountRole(role)
      setConfirmingRoleChange(false)
    } catch (err) {
      setRoleChangeError(errorMessage(err, 'Failed to update role'))
    } finally {
      setRoleChangeLoading(false)
    }
  }

  async function handleReview(request: EditRequest, approve: boolean) {
    if (!session) return
    try {
      await reviewEditRequest({ id: request.id, approve, reviewedBy: session.user.id })
      if (approve) {
        await updateSoldier(request.soldier_id, {
          [request.field_name]: coerceEditRequestValue(request.field_name, request.new_value),
        })
      }
      notify({
        profileId: soldier?.profile_id,
        title: approve ? 'Profile edit approved' : 'Profile edit rejected',
        body: `${request.field_name}: ${formatEditRequestValue(request.field_name, request.new_value)}`,
        link: '/soldier/profile',
      })
      refresh()
      refreshPendingCounts()
    } catch (err) {
      setLoadError(errorMessage(err, 'Failed to review request'))
    }
  }

  function openNewAftModal() {
    setAftEditingTest(null)
    setAftModalMode('new')
  }

  function openEditAftModal(test: AftTest) {
    setAftEditingTest(test)
    setAftModalMode('edit')
  }

  async function handleDeleteAft(testId: string) {
    try {
      await deleteAftTest(testId)
      setConfirmingDeleteAft(null)
      refresh()
    } catch (err) {
      setLoadError(errorMessage(err, 'Failed to delete AFT score'))
    }
  }

  async function handlePreviewAft(test: AftTest) {
    if (!soldier) return
    try {
      const { fillAftScorecard, previewPdf } = await import('../../lib/pdfForms')
      const bytes = await fillAftScorecard(soldier, test)
      previewPdf(bytes)
    } catch (err) {
      setLoadError(errorMessage(err, 'Failed to generate form'))
    }
  }

  const sessionEmail = session?.user.email?.toLowerCase()
  const isOwnEmail =
    !!sessionEmail &&
    (soldier.personal_email?.toLowerCase() === sessionEmail || soldier.mil_email?.toLowerCase() === sessionEmail)

  return (
    <div>
      <BackButton to="/admin/roster" label="Back to roster" />
      <div className="mb-5 flex items-center gap-3">
        <SoldierAvatar soldier={soldier} className="h-12 w-12" textClassName="text-base" />
        <h1 className="font-display text-2xl font-semibold uppercase tracking-wide sm:text-[26px]">
          {soldier.rank} {soldier.first_name} {soldier.last_name}
        </h1>
      </div>

      {loadError && <p className="mb-4 text-sm text-bad-ink">{loadError}</p>}

      <div className="mb-6 rounded-xl border border-line bg-panel p-4 sm:p-6">
        <h2 className="mb-3 font-display text-[15px] font-semibold tracking-wide text-ink-dim">READINESS</h2>
        {!readiness ? (
          <p className="text-sm text-ink-muted">Loading...</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {[
              {
                key: 'attendance',
                icon: <IconAttendance />,
                label: 'ATTENDANCE',
                value: attendanceRate !== null ? `${attendanceRate}%` : '—',
                tone:
                  attendanceRate === null ? 'neutral' : attendanceRate >= 80 ? 'good' : attendanceRate >= 60 ? 'warn' : 'bad',
              },
              {
                key: 'suta',
                icon: <IconSuta />,
                label: 'SUTA',
                value:
                  readiness.sutaOverdue > 0
                    ? `${readiness.sutaOverdue} OVERDUE`
                    : readiness.sutaPending > 0
                      ? `${readiness.sutaPending} PENDING`
                      : 'ALL GOOD',
                tone: readiness.sutaOverdue > 0 ? 'bad' : readiness.sutaPending > 0 ? 'warn' : 'good',
              },
              {
                key: 'gear',
                icon: <IconGear />,
                label: 'GEAR',
                value: readiness.gearOpen > 0 ? `${readiness.gearOpen} OPEN` : 'ALL GOOD',
                tone: readiness.gearOpen > 0 ? 'warn' : 'good',
              },
              {
                key: 'pay',
                icon: <IconPay />,
                label: 'PAY',
                value: readiness.payOpen > 0 ? `${readiness.payOpen} OPEN` : 'ALL GOOD',
                tone: readiness.payOpen > 0 ? 'warn' : 'good',
              },
              {
                key: 'tasks',
                icon: <IconTasks />,
                label: 'TASKS',
                value: readiness.tasksTotal === 0 ? '—' : `${readiness.tasksVerified}/${readiness.tasksTotal}`,
                tone:
                  readiness.tasksTotal === 0
                    ? 'neutral'
                    : readiness.tasksVerified === readiness.tasksTotal
                      ? 'good'
                      : 'warn',
              },
            ].map((tile) => (
              <div
                key={tile.key}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-line-soft px-3 py-3 text-center"
              >
                <span className={READINESS_TONE_CLASS[tile.tone as keyof typeof READINESS_TONE_CLASS]}>{tile.icon}</span>
                <span className="text-[10px] font-bold tracking-wide text-ink-dim">{tile.label}</span>
                <span
                  className={`font-display text-sm font-semibold ${READINESS_TONE_CLASS[tile.tone as keyof typeof READINESS_TONE_CLASS]}`}
                >
                  {tile.value}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {editRequests.length > 0 && (
        <div className="mb-6 rounded-xl border border-line bg-panel p-4 sm:p-6">
          <h2 className="mb-3 font-display text-[15px] font-semibold tracking-wide text-ink-dim">
            PENDING EDIT REQUESTS
          </h2>
          <ul className="space-y-3">
            {editRequests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                <span className="text-ink-dim">
                  <strong className="text-ink">{r.field_name}</strong>: {formatEditRequestValue(r.field_name, r.old_value)}{' '}
                  &rarr; {formatEditRequestValue(r.field_name, r.new_value)}
                </span>
                <span className="flex gap-2">
                  <button
                    onClick={() => handleReview(r, true)}
                    className="rounded-md bg-good-bg px-3 py-1.5 text-[11px] font-bold tracking-wide text-good-ink"
                  >
                    APPROVE
                  </button>
                  <button
                    onClick={() => handleReview(r, false)}
                    className="rounded-md bg-bad-bg px-3 py-1.5 text-[11px] font-bold tracking-wide text-bad-ink"
                  >
                    REJECT
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {!soldier.profile_id && (
        <div className="mb-6 rounded-xl border border-line bg-panel p-4 sm:p-6">
          <h2 className="mb-3 font-display text-[15px] font-semibold tracking-wide text-ink-dim">
            INVITE SOLDIER ACCOUNT
          </h2>
          {soldier.personal_email && !showEmailInput ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm text-ink-dim">
                Send invite to <span className="font-semibold text-ink">{soldier.personal_email}</span>
              </p>
              <button
                onClick={handleInvite}
                className="rounded-md bg-accent px-4 py-2 text-xs font-bold tracking-wide text-accent-ink"
              >
                SEND INVITE
              </button>
              <button
                onClick={() => setShowEmailInput(true)}
                className="text-xs font-semibold text-ink-muted underline underline-offset-2"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="email"
                placeholder="soldier@email.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1 rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
              />
              <button
                onClick={handleInvite}
                className="rounded-md bg-accent px-4 py-2.5 text-xs font-bold tracking-wide text-accent-ink"
              >
                SEND INVITE
              </button>
              {soldier.personal_email && (
                <button
                  onClick={() => {
                    setShowEmailInput(false)
                    setInviteEmail(soldier.personal_email ?? '')
                  }}
                  className="text-xs font-semibold text-ink-muted underline underline-offset-2 sm:self-center"
                >
                  Cancel
                </button>
              )}
            </div>
          )}
          {!soldier.personal_email && (
            <p className="mt-2 text-xs text-ink-muted">
              No personal email on file — add one below under Details, or just type one here.
            </p>
          )}
          {inviteStatus && <p className="mt-2 text-sm text-ink-muted">{inviteStatus}</p>}

          {isOwnEmail && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="mb-2 text-sm text-ink-dim">
                This Soldier&rsquo;s email matches your own admin login. If this is you, link it directly instead of
                sending yourself an invite.
              </p>
              {!confirmingSelfLink ? (
                <button
                  onClick={() => setConfirmingSelfLink(true)}
                  className="rounded-md bg-accent px-4 py-2 text-xs font-bold tracking-wide text-accent-ink"
                >
                  LINK TO MY ACCOUNT
                </button>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-warn-ink">
                    Link this Soldier record to your own admin login ({session?.user.email})?
                  </p>
                  <div className="flex gap-2">
                    <button
                      disabled={selfLinkLoading}
                      onClick={handleLinkToMyAccount}
                      className="rounded-md bg-accent px-4 py-2 text-xs font-bold tracking-wide text-accent-ink disabled:opacity-50"
                    >
                      {selfLinkLoading ? 'LINKING...' : 'CONFIRM LINK'}
                    </button>
                    <button
                      onClick={() => setConfirmingSelfLink(false)}
                      className="rounded-md bg-neutral-bg px-4 py-2 text-xs font-bold tracking-wide text-neutral-ink"
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              )}
              {selfLinkError && <p className="mt-2 text-sm text-bad-ink">{selfLinkError}</p>}
            </div>
          )}
        </div>
      )}

      {soldier.profile_id && accountRole && (
        <div className="mb-6 rounded-xl border border-line bg-panel p-4 sm:p-6">
          <h2 className="mb-1 font-display text-[15px] font-semibold tracking-wide text-ink-dim">ACCOUNT ROLE</h2>
          <p className="mb-3 text-sm text-ink-muted">
            Current role: <span className="font-semibold text-ink">{accountRole === 'admin' ? 'Admin' : 'Basic User'}</span>
          </p>

          {soldier.profile_id === session?.user.id ? (
            <p className="text-xs text-ink-muted">This is your own account — you can&rsquo;t change your own role here.</p>
          ) : !confirmingRoleChange ? (
            <button
              onClick={() => setConfirmingRoleChange(true)}
              className={`rounded-md px-4 py-2 text-xs font-bold tracking-wide ${
                accountRole === 'soldier' ? 'bg-accent text-accent-ink' : 'bg-neutral-bg text-neutral-ink'
              }`}
            >
              {accountRole === 'soldier' ? 'PROMOTE TO ADMIN' : 'DEMOTE TO BASIC USER'}
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-sm text-warn-ink">
                {accountRole === 'soldier'
                  ? 'Give this account full admin access, including the Roster, SUTA reviews, and Security settings.'
                  : 'Remove admin access from this account?'}
              </p>
              <div className="flex gap-2">
                <button
                  disabled={roleChangeLoading}
                  onClick={() => handleRoleChange(accountRole === 'soldier' ? 'admin' : 'soldier')}
                  className={`rounded-md px-4 py-2 text-xs font-bold tracking-wide disabled:opacity-50 ${
                    accountRole === 'soldier' ? 'bg-accent text-accent-ink' : 'bg-bad-bg text-bad-ink'
                  }`}
                >
                  {roleChangeLoading ? 'SAVING...' : accountRole === 'soldier' ? 'CONFIRM PROMOTE' : 'CONFIRM DEMOTE'}
                </button>
                <button
                  onClick={() => setConfirmingRoleChange(false)}
                  className="rounded-md bg-neutral-bg px-4 py-2 text-xs font-bold tracking-wide text-neutral-ink"
                >
                  CANCEL
                </button>
              </div>
            </div>
          )}
          {roleChangeError && <p className="mt-2 text-sm text-bad-ink">{roleChangeError}</p>}

          {soldier.profile_id !== session?.user.id && (
            <div className="mt-4 border-t border-line pt-4">
              <p className="mb-2 text-xs text-ink-muted">
                Account not confirmed yet, or the invite email never arrived?
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="email"
                  placeholder="soldier@email.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-none"
                />
                <button
                  onClick={handleInvite}
                  className="flex-shrink-0 rounded-md bg-neutral-bg px-4 py-2 text-xs font-bold tracking-wide text-neutral-ink"
                >
                  RESEND INVITE
                </button>
              </div>
              {inviteStatus && <p className="mt-2 text-sm text-ink-muted">{inviteStatus}</p>}
            </div>
          )}
        </div>
      )}

      <div className="mb-6 rounded-xl border border-line bg-panel p-4 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-[15px] font-semibold tracking-wide text-ink-dim">ATTENDANCE HISTORY</h2>
          {attendanceRate !== null && (
            <span
              className={`font-display text-lg font-semibold ${
                attendanceRate >= 80 ? 'text-good-ink' : attendanceRate >= 60 ? 'text-warn-ink' : 'text-bad-ink'
              }`}
            >
              {attendanceRate}%
            </span>
          )}
        </div>
        {!attendanceHistory ? (
          <p className="text-sm text-ink-muted">Loading...</p>
        ) : attendanceHistory.length === 0 ? (
          <p className="text-sm text-ink-muted">No past drills yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {attendanceHistory.slice(0, 10).map(({ event, record }) => {
              const badge = attendanceBadge(record)
              return (
                <div
                  key={event.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-line-soft px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 truncate text-sm font-medium">
                      {event.title}
                      {record?.reason && (
                        <button
                          onClick={() => setNoteModal({ name: event.title, reason: record.reason as string })}
                          title="View comment"
                          className="flex-shrink-0 text-info-ink"
                        >
                          <IconNote className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="text-xs text-ink-muted">{formatEventDateRange(event)}</div>
                  </div>
                  <span
                    className={`flex-shrink-0 rounded-md px-2.5 py-1 text-[10px] font-bold tracking-wide ${badge.className}`}
                  >
                    {badge.label}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="mb-6 rounded-xl border border-line bg-panel p-4 sm:p-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-[15px] font-semibold tracking-wide text-ink-dim">AFT SCORES</h2>
          <button
            onClick={openNewAftModal}
            className="rounded-md bg-accent px-3 py-1.5 text-[11px] font-bold tracking-wide text-accent-ink"
          >
            + ADD TEST
          </button>
        </div>
        {aftTests.length === 0 ? (
          <p className="text-sm text-ink-muted">No AFT scores on record.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {aftTests.map((t) => (
              <div
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line-soft px-3 py-2.5"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold">
                    {formatDate(t.test_date)} — {AFT_STANDARD_LABEL[t.standard]}
                  </div>
                  <div className="text-xs text-ink-muted">
                    {t.total_points != null ? `${t.total_points} pts` : 'No total recorded'}
                  </div>
                </div>
                <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5">
                  {t.overall_result && (
                    <span
                      className={`rounded-md px-2.5 py-1 text-[10px] font-bold tracking-wide ${
                        t.overall_result === 'go' ? 'bg-good-bg text-good-ink' : 'bg-bad-bg text-bad-ink'
                      }`}
                    >
                      {AFT_RESULT_LABEL[t.overall_result]}
                    </span>
                  )}
                  <button
                    onClick={() => handlePreviewAft(t)}
                    className="rounded-md bg-neutral-bg px-2.5 py-1 text-[10px] font-bold tracking-wide text-neutral-ink"
                  >
                    PREVIEW
                  </button>
                  <button
                    onClick={() => openEditAftModal(t)}
                    className="rounded-md bg-neutral-bg px-2.5 py-1 text-[10px] font-bold tracking-wide text-neutral-ink"
                  >
                    EDIT
                  </button>
                  {confirmingDeleteAft === t.id ? (
                    <>
                      <button
                        onClick={() => handleDeleteAft(t.id)}
                        className="rounded-md bg-bad-bg px-2.5 py-1 text-[10px] font-bold tracking-wide text-bad-ink"
                      >
                        CONFIRM
                      </button>
                      <button
                        onClick={() => setConfirmingDeleteAft(null)}
                        className="rounded-md bg-neutral-bg px-2.5 py-1 text-[10px] font-bold tracking-wide text-neutral-ink"
                      >
                        CANCEL
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setConfirmingDeleteAft(t.id)}
                      className="rounded-md bg-neutral-bg px-2.5 py-1 text-[10px] font-bold tracking-wide text-bad-ink"
                    >
                      DELETE
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-line bg-panel p-4 sm:p-6">
        <h2 className="mb-4 font-display text-[15px] font-semibold tracking-wide text-ink-dim">DETAILS</h2>
        <SoldierForm
          initial={soldier}
          submitLabel="Save Changes"
          onSubmit={async (values) => {
            if (!id) return
            await updateSoldier(id, soldierFormValuesToPayload(values))
            navigate('/admin/roster')
          }}
        />
      </div>

      {aftModalMode && (
        <AftScoreModal
          soldier={soldier}
          existing={aftEditingTest}
          onClose={() => setAftModalMode(null)}
          onSaved={() => {
            setAftModalMode(null)
            refresh()
          }}
        />
      )}

      {noteModal && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setNoteModal(null)}
        >
          <div
            className="flex w-full max-w-sm flex-col gap-2.5 rounded-xl border border-line bg-panel p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-semibold">{noteModal.name}</div>
            <p className="text-sm text-ink-dim">{noteModal.reason}</p>
            <button
              onClick={() => setNoteModal(null)}
              className="self-end rounded-md bg-neutral-bg px-3.5 py-2 text-xs font-bold tracking-wide text-neutral-ink"
            >
              CLOSE
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
