import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useEffect, useMemo, useState } from 'react'
import { AdminTools } from '../components/AdminTools'
import { AdminLayout, type AdminSidebarSection } from '../components/AdminSidebar'
import { pageMeta } from '../lib/meta'
import { useSession } from '../lib/SessionContext'
import type { HammaEvent } from '../lib/types'
import { adminMainClass, emptyStatePanelClass, pageMainClass } from '../lib/ui'

const EVENT_SETUP_SECTIONS: AdminSidebarSection[] = [
  { id: 'admin-event-overview', label: 'Overview', status: 'ok', group: 'Event Setup' },
  { id: 'admin-event-signup-options', label: 'Signup Options', status: 'ok', group: 'Event Setup' },
  { id: 'admin-event-reminders', label: 'Reminders', status: 'ok', group: 'Event Setup' },
  { id: 'admin-signups', label: 'Signup Management', status: 'ok', group: 'Event Setup' },
  { id: 'admin-event-discord', label: 'Discord Publishing', status: 'ok', group: 'Event Setup' },
  { id: 'admin-event-danger', label: 'Danger Zone', status: 'warning', group: 'Event Setup' },
]

const CREATE_EVENT_SECTIONS: AdminSidebarSection[] = EVENT_SETUP_SECTIONS.slice(0, 3)

const MATCH_SETUP_SECTIONS: AdminSidebarSection[] = [
  { id: 'admin-event-details', label: 'Match Details', status: 'ok', group: 'Match Setup' },
  { id: 'admin-draft', label: 'Draft', status: 'ok', group: 'Match Setup' },
  { id: 'admin-teams', label: 'Captains & Team Setup', status: 'warning', group: 'Match Setup' },
  { id: 'admin-jaeger', label: 'Jaeger Assignments', status: 'ok', group: 'Match Setup' },
  { id: 'admin-coinflip', label: 'Coinflip', status: 'pending', group: 'Match Setup' },
  { id: 'admin-ratings', label: 'Rating Adjustments', status: 'ok', group: 'Match Setup' },
  { id: 'admin-rounds', label: 'Rounds', status: 'ok', group: 'Match Setup' },
  { id: 'admin-composition', label: 'Team Composition', status: 'ok', group: 'Match Setup' },
]

interface AdminRouteData {
  event: HammaEvent | null
  currentEvents: HammaEvent[]
  creating: boolean
}

const loadAdminRouteData = createServerFn({ method: 'GET' })
  .inputValidator((input: AdminSearch) => input)
  .handler(async ({ data }): Promise<AdminRouteData> => {
    const { getCurrentEvent, getCurrentEvents, requireEventByIdOrCurrent } = await import('../lib/services')
    const currentEvents = await getCurrentEvents()
    const event = data.create
      ? null
      : data.eventId
        ? await requireEventByIdOrCurrent(data.eventId)
        : await getCurrentEvent()
    return {
      event,
      currentEvents,
      creating: data.create || (!event && currentEvents.length === 0),
    }
  })

export const Route = createFileRoute('/admin')({
  validateSearch: validateAdminSearch,
  loaderDeps: ({ search }) => ({
    create: search.create,
    eventId: search.eventId,
  }),
  loader: async ({ deps }) => loadAdminRouteData({ data: deps }),
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
  const { event, currentEvents, creating } = Route.useLoaderData()
  const navigate = Route.useNavigate()
  const { user, loading } = useSession()
  const [eventJaegerWarningCount, setEventJaegerWarningCount] = useState<number | null>(null)
  const [creatingEvent, setCreatingEvent] = useState(creating)

  useEffect(() => {
    setCreatingEvent(creating)
  }, [creating])

  const isAdmin = user?.roles.includes('admin')
  const eventSections = useMemo(
    () => buildEventSections(eventJaegerWarningCount, creatingEvent),
    [creatingEvent, eventJaegerWarningCount],
  )

  if (loading) {
    return (
      <main className={pageMainClass}>
        <section className={emptyStatePanelClass}>
          <span className="spinner spinner-lg" aria-label="Loading" />
          <h1>Loading admin access</h1>
        </section>
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main className={pageMainClass}>
        <section className={emptyStatePanelClass}>
          <h1>Admin access required</h1>
          <p>Sign in with Discord to use HammaBowl event controls.</p>
        </section>
      </main>
    )
  }

  if (!event) {
    return (
      <main className={adminMainClass}>
        <AdminLayout sections={eventSections}>
          <AdminTools
            event={null}
            currentEvents={currentEvents}
            creating={creating}
            onEditEventIdChange={(eventId) => void navigate({ search: { eventId } })}
            onCreateEventChange={() => void navigate({ search: { create: true } })}
            onClearEditEventChange={() => void navigate({ search: {} })}
            onEventJaegerWarningCount={setEventJaegerWarningCount}
            onCreationModeChange={setCreatingEvent}
          />
        </AdminLayout>
      </main>
    )
  }

  return (
    <main className={adminMainClass}>
      <AdminLayout sections={eventSections}>
        <AdminTools
          event={event}
          currentEvents={currentEvents}
          creating={creating}
          onEditEventIdChange={(eventId) => void navigate({ search: { eventId } })}
          onCreateEventChange={() => void navigate({ search: { create: true } })}
          onClearEditEventChange={() => void navigate({ search: {} })}
          onEventJaegerWarningCount={setEventJaegerWarningCount}
          onCreationModeChange={setCreatingEvent}
        />
      </AdminLayout>
    </main>
  )
}

interface AdminSearch {
  eventId?: string
  create?: boolean
}

function validateAdminSearch(search: Record<string, unknown>): AdminSearch {
  const eventId = typeof search.eventId === 'string' && search.eventId.trim()
    ? search.eventId.trim()
    : undefined
  const create = search.create === true || search.create === 'true' || search.create === '1'
  return {
    ...(eventId ? { eventId } : {}),
    ...(create ? { create } : {}),
  }
}

function buildEventSections(eventJaegerWarningCount: number | null, creatingEvent: boolean): AdminSidebarSection[] {
  const sections = creatingEvent
    ? CREATE_EVENT_SECTIONS
    : [...EVENT_SETUP_SECTIONS, ...MATCH_SETUP_SECTIONS]

  return sections.map((section) => {
    if (section.id !== 'admin-jaeger') return section
    const count = eventJaegerWarningCount ?? 0
    return {
      ...section,
      status: count > 0 ? 'warning' : 'ok',
      badge: count > 0 ? count.toString() : undefined,
    }
  })
}
