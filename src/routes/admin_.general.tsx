import { createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { GeneralAdminTools } from '../components/AdminTools'
import { pageMeta } from '../lib/meta'
import { AdminNav } from './admin'

const requireGeneralAdmin = createServerFn({ method: 'GET' }).handler(async () => {
  const { requireAdminSession } = await import('../lib/discord.server')
  await requireAdminSession()
  return { ok: true }
})

export const Route = createFileRoute('/admin_/general')({
  loader: () => requireGeneralAdmin(),
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
  return (
    <main>
      <AdminNav />
      <GeneralAdminTools />
    </main>
  )
}
