import '@tanstack/react-start/server-only'

export interface EventUpdate {
  type: string
  eventId: string
  at: string
  message?: string
  tone?: 'neutral' | 'success' | 'error'
}

type Listener = (message: EventUpdate) => void

const listeners = new Set<Listener>()

export function subscribeToEventUpdates(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function publishEventUpdate(
  eventId: string,
  type: string,
  options: Pick<EventUpdate, 'message' | 'tone'> = {},
) {
  const message = {
    type,
    eventId,
    at: new Date().toISOString(),
    ...options,
  }

  for (const listener of listeners) {
    listener(message)
  }
}
