import { createFileRoute } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { AdminTools } from '../components/AdminTools'
import { pageMeta } from '../lib/meta'
import { getCurrentEvent } from '../lib/services'
import type { Role } from '../lib/types'

export const Route = createFileRoute('/admin')({
  loader: () => getCurrentEvent(),
  head: ({ loaderData }) =>
    pageMeta({
      title: loaderData ? `${loaderData.name} Admin` : 'Admin',
      description: loaderData
        ? `Private admin controls for ${loaderData.name}.`
        : 'Private HammaBowl admin controls.',
      path: '/admin',
      noIndex: true,
    }),
  component: Admin,
})

interface SessionUser {
  id: string
  name: string
  roles: Role[]
}

function Admin() {
  const event = Route.useLoaderData()
  const [user, setUser] = useState<SessionUser | null | undefined>()

  useEffect(() => {
    let active = true

    fetch('/api/auth/session')
      .then((response) => response.json())
      .then((payload: { user: SessionUser | null }) => {
        if (active) setUser(payload.user)
      })
      .catch(() => {
        if (active) setUser(null)
      })

    return () => {
      active = false
    }
  }, [])

  const isAdmin = user?.roles.includes('admin')

  return (
    <main>
      {user === undefined ? (
        <section className="panel empty-state">
          <h1>Loading admin access</h1>
        </section>
      ) : isAdmin && event ? (
        <AdminTools event={event} />
      ) : isAdmin ? (
        <section className="panel empty-state">
          <h1>No current event</h1>
          <p>Raid Helper does not currently have an event for admin controls.</p>
        </section>
      ) : (
        <section className="panel empty-state">
          <h1>Discord admin role required</h1>
          <p>Sign in with Discord to use HammaBowl event controls.</p>
        </section>
      )}
    </main>
  )
}
