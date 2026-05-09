import { createFileRoute } from '@tanstack/react-router'
import { requireAdminSession } from '../lib/discord.server'
import { getCurrentEvents, refreshRaidHelperEvent } from '../lib/services'
import { publishEventUpdate } from '../lib/realtime.server'
import { postDiscordCheckInPrompt } from '../lib/discordCheckIn.server'

export const Route = createFileRoute('/api/admin/raid-helper/refresh')({
  server: {
    handlers: {
      POST: async () => {
        await requireAdminSession()
        const event = await refreshRaidHelperEvent()
        const currentEvents = await getCurrentEvents()
        if (!event) {
          return Response.json({
            ok: true,
            message: 'Raid Helper refreshed, but no current event was found.',
            signups: 0,
            currentEvents,
          })
        }
        const discordCheckIn = await postDiscordCheckInPrompt(event).catch((error) => ({
          posted: false,
          reason: error instanceof Error ? error.message : 'Unable to post Discord check-in prompt.',
        }))
        publishEventUpdate(event.id, 'raid-helper.refreshed')

        return Response.json({
          ok: true,
          eventId: event.id,
          raidHelperEventId: event.raidHelperEventId,
          signups: event.players.length,
          discordCheckIn,
          event,
          currentEvents,
        })
      },
    },
  },
  component: () => null,
})
