import { createFileRoute } from '@tanstack/react-router'
import { requireAdminSession } from '../lib/discord.server'
import { getRegisteredPlayerList, renameParticipant } from '../lib/db.server'
import { publishEventUpdate } from '../lib/realtime.server'
import { clearCurrentEventCache } from '../lib/services'

export const Route = createFileRoute('/api/admin/players')({
  server: {
    handlers: {
      GET: async () => {
        await requireAdminSession()
        return Response.json({ players: getRegisteredPlayerList() })
      },
      POST: async ({ request }) => {
        await requireAdminSession()
        const body = await request.json() as {
          discordId?: string
          name?: string
        }
        const players = renameParticipant(String(body.discordId ?? ''), String(body.name ?? ''))
        clearCurrentEventCache()
        publishEventUpdate('current', 'participant.renamed')

        return Response.json({
          ok: true,
          message: 'Player renamed.',
          players,
        })
      },
    },
  },
  component: () => null,
})
