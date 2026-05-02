import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { GeneralAdminTools } from '../components/AdminTools'
import { pageMeta } from '../lib/meta'
import { getCurrentEvent, getCurrentEvents } from '../lib/services'
import { AdminNav } from './admin'

const requireGeneralAdmin = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireAdminSession } = await import('../lib/discord.server')
  await requireAdminSession()
  return { ok: true }
})

export const Route = createFileRoute('/admin_/general')({
  loader: async () => {
    await requireGeneralAdmin()
    const event = await getCurrentEvent()
    return {
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
  const { event, currentEvents } = Route.useLoaderData()

  return (
    <main>
      <AdminNav />
      <GeneralAdminTools event={event} currentEvents={currentEvents} />
    </main>
  )
}
