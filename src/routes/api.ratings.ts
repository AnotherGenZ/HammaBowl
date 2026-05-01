import { createFileRoute } from '@tanstack/react-router'
import { getDiscordSessionUser } from '../lib/discord.server'
import { getRatingsByRater, isEventParticipant, saveRating } from '../lib/db.server'
import { clearCurrentEventCache, requireCurrentEvent } from '../lib/services'
import { publishEventUpdate } from '../lib/realtime.server'

export const Route = createFileRoute('/api/ratings')({
  server: {
    handlers: {
      GET: async () => {
        const user = await getDiscordSessionUser()
        if (!user) throw new Response('Discord login required', { status: 401 })

        const event = await requireCurrentEvent()
        if (!isEventParticipant(event.id, user.id) && !user.roles.includes('admin')) {
          throw new Response('Current event participant role required', { status: 403 })
        }

        return Response.json({ ratings: getRatingsByRater(event.id, user.id) })
      },
      POST: async ({ request }) => {
        const user = await getDiscordSessionUser()
        if (!user) throw new Response('Discord login required', { status: 401 })

        const event = await requireCurrentEvent()
        if (!isEventParticipant(event.id, user.id) && !user.roles.includes('admin')) {
          throw new Response('Current event participant role required', { status: 403 })
        }

        const body = await request.json()
        await saveRating(event, user.id, String(body.toDiscordId ?? ''), Number(body.score))
        clearCurrentEventCache()
        publishEventUpdate(event.id, 'ratings.updated')

        return Response.json({ ok: true, message: 'Rating saved.' })
      },
    },
  },
  component: () => null,
})
