import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { HammaEvent, Role } from './types'

export interface SessionUser {
  id: string
  name: string
  avatarUrl?: string
  profileComplete: boolean
  roles: Role[]
}

interface SessionContextValue {
  user: SessionUser | null
  loading: boolean
  hasCurrentEvent: boolean
  canRateCurrentEvent: boolean
}

const SessionContext = createContext<SessionContextValue>({
  user: null,
  loading: true,
  hasCurrentEvent: false,
  canRateCurrentEvent: false,
})

export function SessionProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasCurrentEvent, setHasCurrentEvent] = useState(false)
  const [canRateCurrentEvent, setCanRateCurrentEvent] = useState(false)

  useEffect(() => {
    let active = true

    Promise.all([
      fetch('/api/auth/session')
        .then((r) => r.json())
        .catch(() => ({ user: null })),
      fetch('/api/event/current')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ]).then(([sessionPayload, event]: [{ user: SessionUser | null }, HammaEvent | null]) => {
      if (!active) return

      const sessionUser = sessionPayload.user
      setUser(sessionUser)
      setHasCurrentEvent(Boolean(event))
      setCanRateCurrentEvent(Boolean(
        event &&
        sessionUser?.profileComplete &&
        (
          sessionUser.roles.includes('admin') ||
          event.players.some((player) => player.id === sessionUser.id)
        ),
      ))
    }).finally(() => {
      if (active) setLoading(false)
    })

    return () => {
      active = false
    }
  }, [])

  return (
    <SessionContext value={{ user, loading, hasCurrentEvent, canRateCurrentEvent }}>
      {children}
    </SessionContext>
  )
}

export function useSession() {
  return useContext(SessionContext)
}
