import '@tanstack/react-start/server-only'

interface EventUpdate {
  type: string
  eventId: string
  at: string
}

type Listener = (message: EventUpdate) => void

const listeners = new Set<Listener>()

export function subscribeToEventUpdates(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function publishEventUpdate(eventId: string, type: string) {
  const message = {
    type,
    eventId,
    at: new Date().toISOString(),
  }

  for (const listener of listeners) {
    listener(message)
  }
}
