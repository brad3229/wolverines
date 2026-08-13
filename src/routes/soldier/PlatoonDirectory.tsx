import { useEffect, useState } from 'react'
import { listPlatoonmates } from '../../lib/soldiers'
import { errorMessage } from '../../lib/errors'
import { LoadingScreen } from '../../components/LoadingScreen'
import { SoldierAvatar } from '../../components/SoldierAvatar'
import { IconPhone } from '../../components/icons'
import { formatPhoneNumber } from '../../lib/phone'
import type { Platoonmate } from '../../types/database'

function DirectoryRow({ mate }: { mate: Platoonmate }) {
  const content = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        <SoldierAvatar soldier={mate} />
        <span className="truncate text-sm font-semibold">
          {mate.rank} {mate.last_name}, {mate.first_name}
        </span>
      </div>
      {mate.phone_number ? (
        <span className="flex flex-shrink-0 items-center gap-2 text-sm font-bold text-accent-soft-ink">
          <IconPhone className="h-4 w-4" />
          {formatPhoneNumber(mate.phone_number)}
        </span>
      ) : (
        <span className="flex-shrink-0 text-xs text-ink-faint">No number on file</span>
      )}
    </>
  )

  // The whole row is the tap target, not just the phone number, so a
  // fat-fingered tap anywhere on the card still places the call.
  if (mate.phone_number) {
    return (
      <a
        href={`tel:${mate.phone_number.replace(/[^\d+]/g, '')}`}
        className="flex items-center justify-between gap-3 rounded-xl border border-line bg-panel p-4 transition-colors active:bg-surface-raised"
      >
        {content}
      </a>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-panel p-4">{content}</div>
  )
}

export function PlatoonDirectory() {
  const [platoonmates, setPlatoonmates] = useState<Platoonmate[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    listPlatoonmates()
      .then(setPlatoonmates)
      .catch((err) => setError(errorMessage(err, 'Failed to load platoon directory')))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingScreen />

  const squad = platoonmates.filter((m) => m.same_squad)
  const restOfPlatoon = platoonmates.filter((m) => !m.same_squad)

  return (
    <div className="mx-auto max-w-[560px]">
      <p className="mb-5 text-[13px] text-ink-muted">
        Everyone in your platoon, with a tap-to-call number for whoever you don&rsquo;t already have saved.
      </p>

      {error && <p className="mb-4 text-sm text-bad-ink">{error}</p>}

      {!error && platoonmates.length === 0 && (
        <p className="rounded-xl border border-line bg-panel p-6 text-center text-sm text-ink-muted">
          No one to show yet — either you haven&rsquo;t been assigned a platoon, or no one in it has a phone number
          on file.
        </p>
      )}

      {squad.length > 0 && (
        <>
          <h2 className="mb-2.5 font-display text-[15px] font-semibold tracking-wide text-ink-dim">YOUR SQUAD</h2>
          <div className="mb-6 flex flex-col gap-2">
            {squad.map((m) => (
              <DirectoryRow key={m.id} mate={m} />
            ))}
          </div>
        </>
      )}

      {restOfPlatoon.length > 0 && (
        <>
          <h2 className="mb-2.5 font-display text-[15px] font-semibold tracking-wide text-ink-dim">
            REST OF YOUR PLATOON
          </h2>
          <div className="flex flex-col gap-2">
            {restOfPlatoon.map((m) => (
              <DirectoryRow key={m.id} mate={m} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
