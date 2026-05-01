import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { DraftBoard } from '../components/DraftBoard'
import { getCurrentEvent } from '../lib/services'
import type { Role } from '../lib/types'

export const Route = createFileRoute('/draft')({
  loader: () => getCurrentEvent(),
  component: Draft,
})

function Draft() {
  const event = Route.useLoaderData()
  const [roles, setRoles] = useState<Role[]>([])
  const [userId, setUserId] = useState<string>()

  useEffect(() => {
    let active = true
    fetch('/api/auth/session')
      .then((response) => response.json())
      .then((payload: { user: { id: string; roles: Role[] } | null }) => {
        if (!active) return
        setRoles(payload.user?.roles ?? [])
        setUserId(payload.user?.id)
      })
      .catch(() => {
        if (!active) return
        setRoles([])
        setUserId(undefined)
      })

    return () => {
      active = false
    }
  }, [])

  const canBid = roles.includes('captain') || roles.includes('admin')

  return (
    <main className="wide-page">
      {event ? (
        <DraftBoard
          event={event}
          canBid={canBid}
          canManageAll={roles.includes('admin')}
          userId={userId}
        />
      ) : (
        <section className="panel empty-state">
          <h1>No current event</h1>
          <p>The draft will be available once Raid Helper has a current HammaBowl event.</p>
        </section>
      )}
    </main>
  )
}
