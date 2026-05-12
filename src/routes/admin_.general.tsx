import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { GeneralAdminTools } from '../components/AdminTools'
import { AdminLayout, type AdminSidebarSection } from '../components/AdminSidebar'
import { pageMeta } from '../lib/meta'
import { getCurrentEvent, getCurrentEvents } from '../lib/services'
import { adminMainClass } from '../lib/ui'

const GENERAL_SECTIONS: AdminSidebarSection[] = [
  { id: 'admin-active-event', label: 'Active Event', status: 'ok' },
  { id: 'admin-event-sync', label: 'Event Sync', status: 'ok' },
  { id: 'admin-discord-cache', label: 'Discord Cache', status: 'ok' },
  { id: 'admin-player-names', label: 'Player Names', status: 'ok' },
  { id: 'admin-jaeger-chars', label: 'Jaeger Characters', status: 'warning' },
  { id: 'admin-badges', label: 'Badges', status: 'ok' },
]

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

  if (!authorized) {
    return (
      <main className="min-w-0 mx-auto w-[min(1180px,calc(100%_-_32px))] py-7 pb-[54px] max-[1023px]:w-[min(100%_-_24px,1180px)] max-[1023px]:py-[18px] max-[1023px]:pb-[42px] max-[480px]:w-[min(100%_-_18px,1180px)]">
        <section className="panel rounded-lg border border-white/[0.10] bg-white/[0.055] p-[clamp(18px,3vw,28px)] mt-[18px] first:mt-0 max-[720px]:px-[clamp(14px,4vw,18px)]  empty-state min-h-[320px] grid content-center justify-items-center text-center gap-2.5 [&_p]:text-[#c0c8c6]">
          <h1>Admin access required</h1>
          <p>Sign in with Discord to use HammaBowl general controls.</p>
        </section>
      </main>
    )
  }

  return (
    <main className={adminMainClass}>
      <AdminLayout sections={GENERAL_SECTIONS}>
        <GeneralAdminTools event={event} currentEvents={currentEvents} />
      </AdminLayout>
    </main>
  )
}
