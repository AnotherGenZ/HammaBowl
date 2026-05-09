import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { AdminTools } from '../components/AdminTools'
import { AdminLayout, type AdminSidebarSection } from '../components/AdminSidebar'
import { pageMeta } from '../lib/meta'
import { useSession } from '../lib/SessionContext'
import { getCurrentEvent, getCurrentEvents } from '../lib/services'

const EVENT_SECTIONS: AdminSidebarSection[] = [
  { id: 'admin-event-details', label: 'Event Details', status: 'ok' },
  { id: 'admin-signups', label: 'Signups', status: 'ok' },
  { id: 'admin-draft', label: 'Draft', status: 'ok' },
  { id: 'admin-teams', label: 'Captains & Team Setup', status: 'warning' },
  { id: 'admin-jaeger', label: 'Jaeger Assignments', status: 'ok' },
  { id: 'admin-coinflip', label: 'Coinflip', status: 'pending' },
  { id: 'admin-ratings', label: 'Rating Adjustments', status: 'ok' },
  { id: 'admin-rounds', label: 'Rounds', status: 'ok' },
  { id: 'admin-composition', label: 'Team Composition', status: 'ok' },
]

export const Route = createFileRoute('/admin')({
  loader: async () => {
    const event = await getCurrentEvent()
    return {
      event,
      currentEvents: await getCurrentEvents(),
    }
  },
  head: ({ loaderData }) =>
    pageMeta({
      title: loaderData?.event ? `${loaderData.event.name} Admin` : 'Admin',
      description: loaderData?.event
        ? `Private admin controls for ${loaderData.event.name}.`
        : 'Private HammaBowl admin controls.',
      path: '/admin',
      noIndex: true,
    }),
  component: Admin,
})

function Admin() {
  const { event, currentEvents } = Route.useLoaderData()
  const { user, loading } = useSession()
  const [eventJaegerWarningCount, setEventJaegerWarningCount] = useState<number | null>(null)

  const isAdmin = user?.roles.includes('admin')
  const eventSections = useMemo(
    () => buildEventSections(eventJaegerWarningCount),
    [eventJaegerWarningCount],
  )

  if (loading) {
    return (
      <main>
        <section className="panel empty-state">
          <span className="spinner spinner-lg" aria-label="Loading" />
          <h1>Loading admin access</h1>
        </section>
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main>
        <section className="panel empty-state">
          <h1>Admin access required</h1>
          <p>Sign in with Discord to use HammaBowl event controls.</p>
        </section>
      </main>
    )
  }

  if (!event) {
    return (
      <main className="admin-main">
        <AdminLayout sections={[]}>
          <section className="panel empty-state">
            <h1>No current event</h1>
            <p>Raid Helper does not currently have an event for admin controls.</p>
          </section>
        </AdminLayout>
      </main>
    )
  }

  return (
    <main className="admin-main">
      <AdminLayout sections={eventSections}>
        <AdminTools
          event={event}
          currentEvents={currentEvents}
          onEventJaegerWarningCount={setEventJaegerWarningCount}
        />
      </AdminLayout>
    </main>
  )
}

function buildEventSections(eventJaegerWarningCount: number | null): AdminSidebarSection[] {
  return EVENT_SECTIONS.map((section) => {
    if (section.id !== 'admin-jaeger') return section
    const count = eventJaegerWarningCount ?? 0
    return {
      ...section,
      status: count > 0 ? 'warning' : 'ok',
      badge: count > 0 ? count.toString() : undefined,
    }
  })
}
