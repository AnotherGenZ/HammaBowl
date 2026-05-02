import { createFileRoute } from '@tanstack/react-router'
import { requireAdminSession } from '../lib/discord.server'
import { getAdminPlayerCharacterConfigs, savePlayerCharacters } from '../lib/db.server'
import { resolveJaegerCharacter } from '../lib/census.server'
import { publishEventUpdate } from '../lib/realtime.server'
import type { Faction } from '../lib/types'

const FACTIONS: Faction[] = ['TR', 'VS', 'NC']

export const Route = createFileRoute('/api/admin/player-jaeger')({
  server: {
    handlers: {
      GET: async () => {
        await requireAdminSession()
        return Response.json({ players: getAdminPlayerCharacterConfigs() })
      },
      POST: async ({ request }) => {
        await requireAdminSession()
        const body = await request.json() as Partial<Record<Faction, string>> & {
          discordId?: string
        }
        const discordId = String(body.discordId ?? '').trim()
        if (!discordId) throw new Response('Player is required.', { status: 400 })

        const resolved = await Promise.all(
          FACTIONS.map((faction) => resolveJaegerCharacter(faction, String(body[faction] ?? ''))),
        )

        savePlayerCharacters(discordId, resolved)
        publishEventUpdate('general', 'player.jaeger.updated')
        return Response.json({
          ok: true,
          message: 'Jaeger characters updated.',
          players: getAdminPlayerCharacterConfigs(),
        })
      },
    },
  },
  component: () => null,
})
