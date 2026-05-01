import { useEffect, useMemo, useState } from 'react'

export function Countdown({ target }: { target?: string }) {
  const targetTime = useMemo(() => (target ? new Date(target).getTime() : 0), [target])
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])

  if (!target || !Number.isFinite(targetTime)) return null

  const remaining = Math.max(0, targetTime - now)
  const totalSeconds = Math.floor(remaining / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return (
    <div className="countdown">
      <span>Signups close in</span>
      <strong>
        {days ? `${days}d ` : ''}
        {hours.toString().padStart(2, '0')}:
        {minutes.toString().padStart(2, '0')}:
        {seconds.toString().padStart(2, '0')}
      </strong>
    </div>
  )
}
