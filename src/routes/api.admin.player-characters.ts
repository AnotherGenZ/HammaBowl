import { createFileRoute } from '@tanstack/react-router'
import { requireAdminSession } from '../lib/discord.server'
import {
  getEventPlayerCharacterAssignments,
  saveEventPlayerCharacterAssignment,
} from '../lib/db.server'
import { resolveJaegerCharacter } from '../lib/census.server'
import { requireCurrentEvent } from '../lib/services'
import type { Faction } from '../lib/types'

export const Route = createFileRoute('/api/admin/player-characters')({
  server: {
    handlers: {
      GET: async () => {
        await requireAdminSession()
        const event = await requireCurrentEvent()
        return Response.json({
          assignments: getEventPlayerCharacterAssignments(event.id),
        })
      },
      POST: async ({ request }) => {
        await requireAdminSession()
        const event = await requireCurrentEvent()
        const body = await request.json() as {
          discordId?: string
          faction?: string
          characterName?: string
        }
        const faction = normalizeFaction(String(body.faction ?? ''))
        const discordId = String(body.discordId ?? '').trim()
        if (!discordId) throw new Response('Player is required.', { status: 400 })

        const character = await resolveJaegerCharacter(faction, String(body.characterName ?? ''))
        return Response.json({
          ok: true,
          message: `${character.characterName} assigned for this event.`,
          assignments: saveEventPlayerCharacterAssignment(event.id, discordId, character),
        })
      },
    },
  },
  component: () => null,
})

function normalizeFaction(value: string): Faction {
  if (value === 'TR' || value === 'VS' || value === 'NC') return value
  throw new Response('Choose TR, VS, or NC.', { status: 400 })
}
