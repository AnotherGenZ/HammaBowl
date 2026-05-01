import { createFileRoute } from '@tanstack/react-router'
import { requireAdminSession } from '../lib/discord.server'
import { clearCurrentEventCache, requireCurrentEvent } from '../lib/services'
import { confirmDraftPick, getDbEvent, resetDraftPick } from '../lib/db.server'
import { publishEventUpdate } from '../lib/realtime.server'

export const Route = createFileRoute('/api/draft/pick')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await requireAdminSession()
        const event = await requireCurrentEvent()
        const body = await request.json()
        const teamId = String(body.teamId ?? '')
        const team = event.captains.find((captain) => captain.id === teamId)

        if (!team) throw new Response('Team not found', { status: 404 })

        const result = await confirmDraftPick(
          event,
          teamId,
          String(body.playerDiscordId ?? ''),
          Number(body.bonusSpent ?? 0),
          body.contestedByTeamId ? String(body.contestedByTeamId) : undefined,
        )

        clearCurrentEventCache()
        const updated = await getDbEvent(event.id)
        publishEventUpdate(event.id, 'draft.pick.confirmed')

        return Response.json({
          ok: true,
          message: `${result.player} added to ${result.team}.`,
          event: updated,
        })
      },
      DELETE: async ({ request }) => {
        await requireAdminSession()
        const event = await requireCurrentEvent()
        const body = await request.json()
        const result = await resetDraftPick(event.id, String(body.pickId ?? ''))

        clearCurrentEventCache()
        const updated = await getDbEvent(event.id)
        publishEventUpdate(event.id, 'draft.pick.reset')

        return Response.json({
          ok: true,
          message: `${result.player} returned to the signup pool.`,
          event: updated,
        })
      },
    },
  },
  component: () => null,
})
