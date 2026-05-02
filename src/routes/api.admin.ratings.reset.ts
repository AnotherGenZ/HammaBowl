import { createFileRoute } from '@tanstack/react-router'
import { requireAdminSession } from '../lib/discord.server'
import { getDbEvent, resetRatingsFromPlayer } from '../lib/db.server'
import { publishEventUpdate } from '../lib/realtime.server'
import { clearCurrentEventCache, requireEventByIdOrCurrent } from '../lib/services'

export const Route = createFileRoute('/api/admin/ratings/reset')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await requireAdminSession()
        const body = await request.json()
        const event = await requireEventByIdOrCurrent(String(body.eventId ?? ''))
        const result = await resetRatingsFromPlayer(event.id, String(body.fromDiscordId ?? ''))

        clearCurrentEventCache()
        const updated = await getDbEvent(event.id)
        publishEventUpdate(event.id, 'ratings.reset')

        return Response.json({
          ok: true,
          message: `Reset ${result.count} rating${result.count === 1 ? '' : 's'} from ${result.player}.`,
          event: updated,
        })
      },
    },
  },
  component: () => null,
})
