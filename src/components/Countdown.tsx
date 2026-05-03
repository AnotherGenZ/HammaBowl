import { useEffect, useMemo, useState } from 'react'

type CountdownTarget =
  | { label: string; time: number; variant: 'signups' | 'draft' | 'start'; inProgress?: false }
  | { inProgress: true }

export function Countdown({
  closingTime,
  startsAt,
  draftStartMinutesBefore,
}: {
  closingTime?: string
  startsAt: string
  draftStartMinutesBefore?: number
}) {
  const schedule = useMemo(
    () => buildCountdownSchedule({ closingTime, startsAt, draftStartMinutesBefore }),
    [closingTime, startsAt, draftStartMinutesBefore],
  )
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  const target = selectCountdownTarget(schedule, now)
  if (!target) return null

  if (target.inProgress) {
    return (
      <div className="countdown countdown-start">
        <span>Event status</span>
        <strong>Event in progress</strong>
      </div>
    )
  }

  const remaining = Math.max(0, target.time - now)
  const totalSeconds = Math.floor(remaining / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return (
    <div className={`countdown countdown-${target.variant}`}>
      <span>{target.label}</span>
      <strong>
        {days ? `${days}d ` : ''}
        {hours.toString().padStart(2, '0')}:
        {minutes.toString().padStart(2, '0')}:
        {seconds.toString().padStart(2, '0')}
      </strong>
    </div>
  )
}

function buildCountdownSchedule({
  closingTime,
  startsAt,
  draftStartMinutesBefore,
}: {
  closingTime?: string
  startsAt: string
  draftStartMinutesBefore?: number
}) {
  const startTime = new Date(startsAt).getTime()
  const signupCloseTime = closingTime ? new Date(closingTime).getTime() : Number.NaN
  const hasDraftOffset = typeof draftStartMinutesBefore === 'number'
  const draftStartTime =
    Number.isFinite(startTime) && hasDraftOffset
      ? startTime - draftStartMinutesBefore * 60_000
      : Number.NaN

  return {
    signupCloseTime,
    draftStartTime,
    startTime,
    hasDraftOffset,
  }
}

function selectCountdownTarget(
  schedule: ReturnType<typeof buildCountdownSchedule>,
  now: number,
): CountdownTarget | null {
  if (Number.isFinite(schedule.signupCloseTime) && now < schedule.signupCloseTime) {
    return { label: 'Signups close in', time: schedule.signupCloseTime, variant: 'signups' }
  }

  if (
    schedule.hasDraftOffset &&
    Number.isFinite(schedule.draftStartTime) &&
    now < schedule.draftStartTime
  ) {
    return { label: 'Draft starts in', time: schedule.draftStartTime, variant: 'draft' }
  }

  if (Number.isFinite(schedule.startTime) && now < schedule.startTime) {
    return { label: 'Event starts in', time: schedule.startTime, variant: 'start' }
  }

  if (Number.isFinite(schedule.startTime)) {
    return { inProgress: true }
  }

  return null
}
