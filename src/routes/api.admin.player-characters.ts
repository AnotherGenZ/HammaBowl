import { createFileRoute } from '@tanstack/react-router'
import { requireAdminSession } from '../lib/discord.server'
import {
  getEventPlayerCharacterAssignments,
  getEventPlayerCharacterExportRows,
  saveEventPlayerCharacterAssignment,
  saveEventPlayerCharacterAssignments,
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
        if (url.searchParams.get('format') === 'csv') {
          const csv = toCharacterCsv(getEventPlayerCharacterExportRows(event.id))
          return new Response(csv, {
            headers: {
              'Content-Type': 'text/csv; charset=utf-8',
              'Content-Disposition': `attachment; filename="${csvFileName(event.name)}-characters.csv"`,
            },
          })
        }
        return Response.json({
          assignments: getEventPlayerCharacterAssignments(event.id),
        })
      },
      POST: async ({ request }) => {
        await requireAdminSession()
        const body = await request.json() as {
          eventId?: string
          discordId?: string
          accountPrefix?: string
          faction?: string
          characterName?: string
        }
        const event = await requireEventByIdOrCurrent(String(body.eventId ?? ''))
        const discordId = String(body.discordId ?? '').trim()
        if (!discordId) throw new Response('Player is required.', { status: 400 })

        const accountPrefix = String(body.accountPrefix ?? '').trim()
        if (accountPrefix) {
          const resolved = await Promise.all(
            FACTIONS.map((faction) => resolveJaegerCharacter(faction, `${accountPrefix}${faction}`)),
          )
          const assignments = saveEventPlayerCharacterAssignments(event.id, discordId, resolved)
          publishEventUpdate(event.id, 'event.jaeger.updated')
          return Response.json({
            ok: true,
            message: `${accountPrefix} TR, VS, and NC characters assigned for this event.`,
            assignments,
          })
        }

        const faction = normalizeFaction(String(body.faction ?? ''))
        const character = await resolveJaegerCharacter(faction, String(body.characterName ?? '').trim())
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

const FACTIONS: Faction[] = ['TR', 'VS', 'NC']

function normalizeFaction(value: string): Faction {
  if (value === 'TR' || value === 'VS' || value === 'NC') return value
  throw new Response('Choose TR, VS, or NC.', { status: 400 })
}

function toCharacterCsv(rows: Array<{ playerName: string; characterId: string }>) {
  return rows.map((row) => [row.playerName, row.characterId].map(csvCell).join(',')).join('\n')
}

function csvCell(value: string) {
  return `"${value.replaceAll('"', '""')}"`
}

function csvFileName(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'event'
}
