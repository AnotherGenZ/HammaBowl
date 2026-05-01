import { useEffect, useState } from 'react'
import type { HammaEvent } from './types'

export function useRealtimeCurrentEvent(initialEvent: HammaEvent | null, enabled = true) {
  const [event, setEvent] = useState(initialEvent)

  useEffect(() => {
    setEvent(initialEvent)
  }, [initialEvent])

  useEffect(() => {
    if (!enabled || typeof EventSource === 'undefined') return

    let active = true
    let refreshing = false

    const refresh = async () => {
      if (refreshing) return
      refreshing = true
      try {
        const response = await fetch('/api/event/current')
        if (!response.ok) throw new Error(await response.text())
        const nextEvent = await response.json() as HammaEvent | null
        if (active) setEvent(nextEvent)
      } catch (error) {
        console.warn('Realtime event refresh failed', error)
      } finally {
        refreshing = false
      }
    }

    const source = new EventSource('/api/event/current/stream')
    source.addEventListener('event-update', () => {
      void refresh()
    })

    return () => {
      active = false
      source.close()
    }
  }, [enabled])

  return [event, setEvent] as const
}
