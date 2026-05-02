import { createFileRoute } from '@tanstack/react-router'
import { requireAdminSession } from '../lib/discord.server'
import {
  getEventPlayerCharacterAssignments,
  saveEventPlayerCharacterAssignment,
} from '../lib/db.server'
import { resolveJaegerCharacter } from '../lib/census.server'
import { requireEventByIdOrCurrent } from '../lib/services'
import { publishEventUpdate } from '../lib/realtime.server'
import type { Faction } from '../lib/types'

export const Route = createFileRoute('/api/admin/player-characters')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await requireAdminSession()
        const url = new URL(request.url)
        const event = await requireEventByIdOrCurrent(url.searchParams.get('eventId') ?? '')
        return Response.json({
          assignments: getEventPlayerCharacterAssignments(event.id),
        })
      },
      POST: async ({ request }) => {
        await requireAdminSession()
        const body = await request.json() as {
          eventId?: string
          discordId?: string
          faction?: string
          characterName?: string
        }
        const event = await requireEventByIdOrCurrent(String(body.eventId ?? ''))
        const faction = normalizeFaction(String(body.faction ?? ''))
        const discordId = String(body.discordId ?? '').trim()
        if (!discordId) throw new Response('Player is required.', { status: 400 })

        const character = await resolveJaegerCharacter(faction, String(body.characterName ?? ''))
        const assignments = saveEventPlayerCharacterAssignment(event.id, discordId, character)
        publishEventUpdate(event.id, 'event.jaeger.updated')
        return Response.json({
          ok: true,
          message: `${character.characterName} assigned for this event.`,
          assignments,
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
