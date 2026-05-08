import { createFileRoute } from '@tanstack/react-router'
import { getDiscordSessionUser } from '../lib/discord.server'
import { checkInEventParticipant, getDbEvent } from '../lib/db.server'
import { ensureHonuAlertRefresh, ensureHonuPsbAccountRefresh } from '../lib/honu.server'
import { publishEventUpdate } from '../lib/realtime.server'
import { clearCurrentEventCache, getCurrentEvent, requireCurrentEvent } from '../lib/services'

export const Route = createFileRoute('/api/event/current')({
  server: {
    handlers: {
      GET: async () => {
        ensureHonuAlertRefresh()
        ensureHonuPsbAccountRefresh()
        return Response.json(await getCurrentEvent())
      },
      POST: async () => {
        const user = await getDiscordSessionUser()
        if (!user) throw new Response('Discord login required', { status: 401 })

        const event = await requireCurrentEvent()
        const result = await checkInEventParticipant(event.id, user.id)

        clearCurrentEventCache()
        const updated = await getDbEvent(event.id)
        const message = `${result.player} checked in.`
        publishEventUpdate(event.id, 'event.check-in', { message, tone: 'success' })

        return Response.json({ ok: true, message, event: updated })
      },
    },
  },
  component: () => null,
})
