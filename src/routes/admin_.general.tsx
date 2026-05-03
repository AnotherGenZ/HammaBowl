import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { GeneralAdminTools } from '../components/AdminTools'
import { pageMeta } from '../lib/meta'
import { getCurrentEvent, getCurrentEvents } from '../lib/services'
import { AdminNav } from './admin'

const requireGeneralAdmin = createServerFn({ method: 'GET' }).handler(async () => {
  const { getDiscordSessionUser } = await import('../lib/discord.server')
  const user = await getDiscordSessionUser()
  return { ok: Boolean(user?.roles.includes('admin')) }
})

export const Route = createFileRoute('/admin_/general')({
  loader: async () => {
    const access = await requireGeneralAdmin()
    if (!access.ok) {
      return {
        authorized: false,
        event: null,
        currentEvents: [],
      }
    }

    const event = await getCurrentEvent()
    return {
      authorized: true,
      event,
      currentEvents: await getCurrentEvents(),
    }
  },
  head: () =>
    pageMeta({
      title: 'General Admin',
      description: 'General HammaBowl admin controls for players and badges.',
      path: '/admin/general',
      noIndex: true,
    }),
  component: GeneralAdmin,
})

function GeneralAdmin() {
  const { authorized, event, currentEvents } = Route.useLoaderData()

  return (
    <main>
      {authorized ? (
        <>
          <AdminNav />
          <GeneralAdminTools event={event} currentEvents={currentEvents} />
        </>
      ) : (
        <section className="panel empty-state">
          <h1>Admin access required</h1>
          <p>Sign in with Discord to use HammaBowl general controls.</p>
        </section>
      )}
    </main>
  )
}
