import { createFileRoute } from '@tanstack/react-router'
import { requireAdminSession } from '../lib/discord.server'
import { clearCurrentEventCache, requireCurrentEvent } from '../lib/services'
import { getDbEvent, updateTeamSettings } from '../lib/db.server'
import { publishEventUpdate } from '../lib/realtime.server'

export const Route = createFileRoute('/api/admin/team/update')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await requireAdminSession()
        const event = await requireCurrentEvent()
        const body = await request.json()

        await updateTeamSettings(event.id, String(body.teamId ?? ''), {
          name: String(body.name ?? ''),
          captainDiscordId: String(body.captainDiscordId ?? ''),
          faction: 'faction' in body ? String(body.faction ?? '') : undefined,
          startingSide: 'startingSide' in body ? String(body.startingSide ?? '') : undefined,
          score: Number(body.score),
        })

        clearCurrentEventCache()
        const updated = await getDbEvent(event.id)
        publishEventUpdate(event.id, 'teams.updated')
        return Response.json({
          ok: true,
          message: 'Team settings saved.',
          event: updated,
        })
      },
    },
  },
  component: () => null,
})
