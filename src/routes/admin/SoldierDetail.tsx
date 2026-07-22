import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getSoldier, updateSoldier } from '../../lib/soldiers'
import { inviteSoldierAccount, setUserRole } from '../../lib/adminApi'
import { getProfileRole } from '../../lib/profiles'
import { errorMessage } from '../../lib/errors'
import { listEditRequests, reviewEditRequest, coerceEditRequestValue, formatEditRequestValue } from '../../lib/editRequests'
import { getAttendanceHistory, attendanceBadge } from '../../lib/attendance'
import type { AttendanceHistoryEntry } from '../../lib/attendance'
import { formatEventDateRange } from '../../lib/drillEvents'
import { SoldierForm, soldierFormValuesToPayload } from '../../components/SoldierForm'
import { BackButton } from '../../components/BackButton'
import { useAuth } from '../../hooks/useAuth'
import type { EditRequest, Soldier, UserRole } from '../../types/database'

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
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceHistoryEntry[] | null>(null)
  const [attendanceRate, setAttendanceRate] = useState<number | null>(null)

  function refresh() {
    if (!id) return
    getSoldier(id).then((s) => {
      setSoldier(s)
      setInviteEmail(s.personal_email ?? '')
      if (s.profile_id) getProfileRole(s.profile_id).then(setAccountRole)

      getAttendanceHistory(s.id).then(({ history, rate }) => {
        setAttendanceHistory(history)
        setAttendanceRate(rate)
      })
    })
    listEditRequests().then((all) => setEditRequests(all.filter((r) => r.soldier_id === id && r.status === 'pending')))
  }

  useEffect(refresh, [id])

  if (!soldier) return <p className="text-sm text-ink-muted">Loading...</p>

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
    await reviewEditRequest({ id: request.id, approve, reviewedBy: session.user.id })
    if (approve) {
      await updateSoldier(request.soldier_id, {
        [request.field_name]: coerceEditRequestValue(request.field_name, request.new_value),
      })
    }
    refresh()
    refreshPendingCounts()
  }

  return (
    <div>
      <BackButton to="/admin/roster" label="Back to roster" />
      <h1 className="mb-5 font-display text-2xl font-semibold uppercase tracking-wide sm:text-[26px]">
        {soldier.rank} {soldier.first_name} {soldier.last_name}
      </h1>

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
                    <div className="truncate text-sm font-medium">{event.title}</div>
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
    </div>
  )
}
