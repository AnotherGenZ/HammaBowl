import { createFileRoute } from '@tanstack/react-router'
import { requireAdminSession } from '../lib/discord.server'
import { getRegisteredPlayerList, renameParticipant } from '../lib/db.server'
import { publishEventUpdate } from '../lib/realtime.server'
import { clearCurrentEventCache, syncParticipantNameOverrideToRaidHelper } from '../lib/services'

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
        const discordId = String(body.discordId ?? '')
        const name = String(body.name ?? '').trim().slice(0, 80)
        const players = renameParticipant(discordId, name)
        const raidHelperSync = await syncParticipantNameOverrideToRaidHelper(discordId, name)
        clearCurrentEventCache()
        publishEventUpdate('current', 'participant.renamed')

        return Response.json({
          ok: true,
          message: raidHelperSync.synced
            ? `Player renamed and synced to ${raidHelperSync.synced} Raid Helper event${raidHelperSync.synced === 1 ? '' : 's'}.`
            : 'Player renamed.',
          players,
        })
      },
    },
  },
  component: () => null,
})
