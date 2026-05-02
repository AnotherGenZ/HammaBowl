import { createFileRoute } from '@tanstack/react-router'
import { requireAdminSession } from '../lib/discord.server'
import { clearCurrentEventCache, requireEventByIdOrCurrent } from '../lib/services'
import { ensureDefaultTeams, getDbEvent } from '../lib/db.server'
import { publishEventUpdate } from '../lib/realtime.server'

export const Route = createFileRoute('/api/admin/teams/ensure')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await requireAdminSession()
        const body = await request.json().catch(() => ({}))
        const event = await requireEventByIdOrCurrent(String(body.eventId ?? ''))
        const teams = await ensureDefaultTeams(event)
        clearCurrentEventCache()
        const updated = await getDbEvent(event.id)
        publishEventUpdate(event.id, 'teams.updated')

        return Response.json({
          ok: true,
          message: `Configured ${teams.length} teams.`,
          teams: updated?.captains ?? [],
          event: updated,
        })
      },
    },
  },
  component: () => null,
})
