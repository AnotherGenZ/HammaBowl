import { Link, createFileRoute } from '@tanstack/react-router'
import { AdminTools } from '../components/AdminTools'
import { pageMeta } from '../lib/meta'
import { useSession } from '../lib/SessionContext'
import { getCurrentEvent, getCurrentEvents } from '../lib/services'

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

  const isAdmin = user?.roles.includes('admin')

  return (
    <main>
      {loading ? (
        <section className="panel empty-state">
          <span className="spinner spinner-lg" aria-label="Loading" />
          <h1>Loading admin access</h1>
        </section>
      ) : isAdmin && event ? (
        <>
          <AdminNav />
          <AdminTools event={event} currentEvents={currentEvents} />
        </>
      ) : isAdmin ? (
        <>
          <AdminNav />
          <section className="panel empty-state">
            <h1>No current event</h1>
            <p>Raid Helper does not currently have an event for admin controls.</p>
          </section>
        </>
      ) : (
        <section className="panel empty-state">
          <h1>Discord admin role required</h1>
          <p>Sign in with Discord to use HammaBowl event controls.</p>
        </section>
      )}
    </main>
  )
}

export function AdminNav() {
  return (
    <nav className="admin-tabs" aria-label="Admin sections">
      <Link to="/admin" activeOptions={{ exact: true }} activeProps={{ className: 'active' }}>
        Event Configuration
      </Link>
      <Link to="/admin/general" activeOptions={{ exact: true }} activeProps={{ className: 'active' }}>
        General
      </Link>
      <Link to="/admin/history" activeOptions={{ exact: true }} activeProps={{ className: 'active' }}>
        Historical events
      </Link>
    </nav>
  )
}
