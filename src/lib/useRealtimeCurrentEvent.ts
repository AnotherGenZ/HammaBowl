import { useEffect, useState } from 'react'
import type { HammaEvent } from './types'

export interface RealtimeEventUpdate {
  type: string
  eventId: string
  at: string
  message?: string
  tone?: 'neutral' | 'success' | 'error'
}

export function useRealtimeCurrentEvent(initialEvent: HammaEvent | null, enabled = true) {
  const [event, setEvent] = useState(initialEvent)
  const [lastUpdate, setLastUpdate] = useState<RealtimeEventUpdate>()

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

    const streamUrl = event?.id
      ? `/api/event/current/stream?eventId=${encodeURIComponent(event.id)}`
      : '/api/event/current/stream'
    const source = new EventSource(streamUrl)
    source.addEventListener('event-update', (messageEvent) => {
      try {
        setLastUpdate(JSON.parse(messageEvent.data) as RealtimeEventUpdate)
      } catch (error) {
        console.warn('Realtime event message parse failed', error)
      }
      void refresh()
    })

    return () => {
      active = false
      source.close()
    }
  }, [enabled, event?.id])

  return [event, setEvent, lastUpdate] as const
}
