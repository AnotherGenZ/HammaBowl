import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import type { HammaEvent, Role } from './types'

export interface SessionUser {
  id: string
  name: string
  groupTag?: string
  groupTagColor?: string
  avatarUrl?: string
  profileComplete: boolean
  roles: Role[]
}

interface SessionContextValue {
  user: SessionUser | null
  loading: boolean
  hasCurrentEvent: boolean
  canRateCurrentEvent: boolean
  refreshSession: () => Promise<void>
}

export interface InitialSessionState {
  user: SessionUser | null
  hasCurrentEvent: boolean
  canRateCurrentEvent: boolean
}

const SessionContext = createContext<SessionContextValue>({
  user: null,
  loading: true,
  hasCurrentEvent: false,
  canRateCurrentEvent: false,
  refreshSession: async () => {},
})

export function SessionProvider({
  children,
  initialSession,
}: Readonly<{ children: ReactNode; initialSession?: InitialSessionState }>) {
  const [user, setUser] = useState<SessionUser | null>(initialSession?.user ?? null)
  const [loading, setLoading] = useState(!initialSession)
  const [hasCurrentEvent, setHasCurrentEvent] = useState(initialSession?.hasCurrentEvent ?? false)
  const [canRateCurrentEvent, setCanRateCurrentEvent] = useState(initialSession?.canRateCurrentEvent ?? false)

  const refreshSession = useCallback(async () => {
    const [sessionPayload, event]: [{ user: SessionUser | null }, HammaEvent | null] = await Promise.all([
      fetch('/api/auth/session')
        .then((r) => r.json())
        .catch(() => ({ user: null })),
      fetch('/api/event/current')
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    ])

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
  }, [])

  useEffect(() => {
    let active = true

    if (initialSession) {
      setLoading(false)
      return () => {
        active = false
      }
    }

    refreshSession().finally(() => {
      if (active) setLoading(false)
    })

    return () => {
      active = false
    }
  }, [initialSession, refreshSession])

  return (
    <SessionContext value={{ user, loading, hasCurrentEvent, canRateCurrentEvent, refreshSession }}>
      {children}
    </SessionContext>
  )
}

export function useSession() {
  return useContext(SessionContext)
}
