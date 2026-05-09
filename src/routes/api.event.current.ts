import { createFileRoute } from '@tanstack/react-router'
import { checkInCurrentEventParticipant } from '../lib/checkIn.server'
import { getDiscordSessionUser } from '../lib/discord.server'
import { ensureHonuAlertRefresh, ensureHonuPsbAccountRefresh } from '../lib/honu.server'
import { getCurrentEvent } from '../lib/services'

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

        const { event, message } = await checkInCurrentEventParticipant(user.id)

        return Response.json({ ok: true, message, event })
      },
    },
  },
  component: () => null,
})
