import { createFileRoute } from '@tanstack/react-router'
import { requireAdminSession } from '../lib/discord.server'
import { clearCurrentEventCache, requireCurrentEvent } from '../lib/services'
import { setRatingDisqualified } from '../lib/db.server'
import { publishEventUpdate } from '../lib/realtime.server'

export const Route = createFileRoute('/api/admin/ratings/disqualify')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await requireAdminSession()
        const body = await request.json()
        const event = await requireCurrentEvent()

        await setRatingDisqualified(
          event.id,
          String(body.fromDiscordId ?? ''),
          String(body.toDiscordId ?? ''),
          Boolean(body.disqualified ?? true),
        )
        clearCurrentEventCache()
        publishEventUpdate(event.id, 'ratings.updated')

        return Response.json({ ok: true, message: 'Rating adjustment saved.' })
      },
    },
  },
  component: () => null,
})
