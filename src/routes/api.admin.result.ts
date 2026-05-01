import { createFileRoute } from '@tanstack/react-router'
import { requireAdminSession } from '../lib/discord.server'
import { clearCurrentEventCache, requireCurrentEvent } from '../lib/services'
import { adjustScore, setWinningTeam } from '../lib/db.server'
import { publishEventUpdate } from '../lib/realtime.server'

export const Route = createFileRoute('/api/admin/result')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await requireAdminSession()
        const body = await request.json()
        const event = await requireCurrentEvent()
        const teamId = String(body.teamId ?? '')

        if (!teamId) throw new Response('teamId is required', { status: 400 })

        let message = 'Result saved.'
        if (typeof body.delta === 'number' && body.delta !== 0) {
          const result = await adjustScore(event.id, teamId, body.delta)
          message = `${result.team} score is now ${result.score}.`
        }

        if (body.winner) {
          await setWinningTeam(event.id, teamId)
          message = 'Winning team recorded.'
        }

        clearCurrentEventCache()
        publishEventUpdate(event.id, body.winner ? 'event.result.recorded' : 'event.score.updated')
        return Response.json({ ok: true, message })
      },
    },
  },
  component: () => null,
})
