import { useEffect, useMemo, useState } from 'react'

type CountdownTarget =
  | { label: string; time: number; accent: string; inProgress?: false }
  | { inProgress: true }

export function Countdown({
  closingTime,
  startsAt,
  draftStartMinutesBefore,
  roundStartedAt,
  roundDurationSeconds,
  roundNumber,
  initialNow,
}: {
  closingTime?: string
  startsAt: string
  draftStartMinutesBefore?: number
  roundStartedAt?: string
  roundDurationSeconds?: number
  roundNumber?: number
  initialNow?: number
}) {
  const schedule = useMemo(
    () =>
      buildCountdownSchedule({
        closingTime,
        startsAt,
        draftStartMinutesBefore,
        roundStartedAt,
        roundDurationSeconds,
        roundNumber,
      }),
    [closingTime, startsAt, draftStartMinutesBefore, roundStartedAt, roundDurationSeconds, roundNumber],
  )
  const [now, setNow] = useState(initialNow ?? Date.now())

  useEffect(() => {
    const updateNow = () => setNow(Date.now())
    updateNow()
    const id = window.setInterval(updateNow, 1000)
    return () => window.clearInterval(id)
  }, [])

  const target = selectCountdownTarget(schedule, now)
  if (!target) return null

  if (target.inProgress) {
    return (
      <div className="countdown countdown-in-progress">
        <span className="countdown-pulse" />
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
    <div className="countdown-block">
      <p className="countdown-label" style={{ color: target.accent }}>{target.label}</p>
      <div className="countdown-units">
        {days > 0 ? <CountdownUnit value={days} label="Days" /> : null}
        <CountdownUnit value={hours} label="Hours" />
        <span className="countdown-sep">:</span>
        <CountdownUnit value={minutes} label="Mins" />
        <span className="countdown-sep">:</span>
        <CountdownUnit value={seconds} label="Secs" />
      </div>
    </div>
  )
}

function CountdownUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="countdown-unit">
      <div className="countdown-digit">{String(value).padStart(2, '0')}</div>
      <span className="countdown-unit-label">{label}</span>
    </div>
  )
}

function buildCountdownSchedule({
  closingTime,
  startsAt,
  draftStartMinutesBefore,
  roundStartedAt,
  roundDurationSeconds,
  roundNumber,
}: {
  closingTime?: string
  startsAt: string
  draftStartMinutesBefore?: number
  roundStartedAt?: string
  roundDurationSeconds?: number
  roundNumber?: number
}) {
  const startTime = new Date(startsAt).getTime()
  const roundStartTime = roundStartedAt ? new Date(roundStartedAt).getTime() : Number.NaN
  const roundEndTime =
    Number.isFinite(roundStartTime) && typeof roundDurationSeconds === 'number'
      ? roundStartTime + roundDurationSeconds * 1000
      : Number.NaN
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
    roundEndTime,
    roundNumber,
    hasDraftOffset,
  }
}

function selectCountdownTarget(
  schedule: ReturnType<typeof buildCountdownSchedule>,
  now: number,
): CountdownTarget | null {
  if (Number.isFinite(schedule.roundEndTime) && now < schedule.roundEndTime) {
    return {
      label: `Round ${schedule.roundNumber ?? ''} ends in`.trim(),
      time: schedule.roundEndTime,
      accent: '#e4b45e',
    }
  }

  if (Number.isFinite(schedule.signupCloseTime) && now < schedule.signupCloseTime) {
    return { label: 'Signups close in', time: schedule.signupCloseTime, accent: '#e4b45e' }
  }

  if (
    schedule.hasDraftOffset &&
    Number.isFinite(schedule.draftStartTime) &&
    now < schedule.draftStartTime
  ) {
    return { label: 'Draft starts in', time: schedule.draftStartTime, accent: '#84bdf5' }
  }

  if (Number.isFinite(schedule.startTime) && now < schedule.startTime) {
    return { label: 'Event starts in', time: schedule.startTime, accent: '#47bf8f' }
  }

  if (Number.isFinite(schedule.startTime)) {
    return { inProgress: true }
  }

  return null
}
