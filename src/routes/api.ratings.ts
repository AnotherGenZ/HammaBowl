import { createFileRoute } from '@tanstack/react-router'
import { getDiscordSessionUser } from '../lib/discord.server'
import { clearRating, getRatingsByRater, isEventParticipant, saveRating } from '../lib/db.server'
import { clearCurrentEventCache, getCurrentEvent } from '../lib/services'
import { publishEventUpdate } from '../lib/realtime.server'

export const Route = createFileRoute('/api/ratings')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const user = await getDiscordSessionUser()
        if (!user) throw new Response('Discord login required', { status: 401 })
        if (!user.profileComplete) throw new Response('Complete player settings before rating.', { status: 403 })

        const event = await requireCurrentRatingsEvent()
        if (!isEventParticipant(event.id, user.id) && !user.roles.includes('admin')) {
          throw new Response('Current event participant role required', { status: 403 })
        }

        const url = new URL(request.url)
        const requestedFromDiscordId = url.searchParams.get('fromDiscordId')?.trim()
        const fromDiscordId = user.roles.includes('admin') && requestedFromDiscordId
          ? requestedFromDiscordId
          : user.id

        if (!isEventParticipant(event.id, fromDiscordId)) {
          throw new Response('Selected rater is not an active participant for this event.', { status: 400 })
        }

        return Response.json({ ratings: getRatingsByRater(event.id, fromDiscordId) })
      },
      POST: async ({ request }) => {
        const user = await getDiscordSessionUser()
        if (!user) throw new Response('Discord login required', { status: 401 })
        if (!user.profileComplete) throw new Response('Complete player settings before rating.', { status: 403 })

        const event = await requireCurrentRatingsEvent()
        if (!isEventParticipant(event.id, user.id) && !user.roles.includes('admin')) {
          throw new Response('Current event participant role required', { status: 403 })
        }

        const body = await request.json()
        const requestedFromDiscordId = String(body.fromDiscordId ?? '').trim()
        const fromDiscordId = user.roles.includes('admin') && requestedFromDiscordId
          ? requestedFromDiscordId
          : user.id
        if (!isEventParticipant(event.id, fromDiscordId)) {
          throw new Response('Selected rater is not an active participant for this event.', { status: 400 })
        }

        const toDiscordId = String(body.toDiscordId ?? '')
        if (body.score === null) {
          await clearRating(event, fromDiscordId, toDiscordId)
          clearCurrentEventCache()
          publishEventUpdate(event.id, 'ratings.updated')

          return Response.json({ ok: true, message: 'Rating cleared.' })
        }

        await saveRating(event, fromDiscordId, toDiscordId, Number(body.score))
        clearCurrentEventCache()
        publishEventUpdate(event.id, 'ratings.updated')

        return Response.json({ ok: true, message: 'Rating saved.' })
      },
    },
  },
  component: () => null,
})

async function requireCurrentRatingsEvent() {
  const event = await getCurrentEvent()
  if (!event) throw new Response('No current Raid Helper event found.', { status: 404 })
  return event
}
