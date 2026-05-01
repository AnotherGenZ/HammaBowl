import { createFileRoute } from '@tanstack/react-router'
import { requireAdminSession } from '../lib/discord.server'
import { refreshRaidHelperEvent } from '../lib/services'
import { publishEventUpdate } from '../lib/realtime.server'

export const Route = createFileRoute('/api/admin/raid-helper/refresh')({
  server: {
    handlers: {
      POST: async () => {
        await requireAdminSession()
        const event = await refreshRaidHelperEvent()
        if (!event) {
          return Response.json({
            ok: true,
            message: 'Raid Helper refreshed, but no current event was found.',
            signups: 0,
          })
        }
        publishEventUpdate(event.id, 'raid-helper.refreshed')

        return Response.json({
          ok: true,
          eventId: event.id,
          raidHelperEventId: event.raidHelperEventId,
          signups: event.players.length,
        })
      },
    },
  },
  component: () => null,
})
