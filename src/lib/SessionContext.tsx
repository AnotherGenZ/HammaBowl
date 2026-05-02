import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Role } from './types'

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
}

const SessionContext = createContext<SessionContextValue>({
  user: null,
  loading: true,
  hasCurrentEvent: false,
})

export function SessionProvider({
  children,
}: Readonly<{ children: ReactNode }>) {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasCurrentEvent, setHasCurrentEvent] = useState(false)

  useEffect(() => {
    let active = true

    Promise.all([
      fetch('/api/auth/session')
        .then((r) => r.json())
        .then((payload: { user: SessionUser | null }) => {
          if (active) setUser(payload.user)
        })
        .catch(() => {
          if (active) setUser(null)
        }),
      fetch('/api/event/current')
        .then((r) => (r.ok ? r.json() : null))
        .then((event) => {
          if (active) setHasCurrentEvent(Boolean(event))
        })
        .catch(() => {
          if (active) setHasCurrentEvent(false)
        }),
    ]).finally(() => {
      if (active) setLoading(false)
    })

    return () => {
      active = false
    }
  }, [])

  return (
    <SessionContext value={{ user, loading, hasCurrentEvent }}>
      {children}
    </SessionContext>
  )
}

export function useSession() {
  return useContext(SessionContext)
}
