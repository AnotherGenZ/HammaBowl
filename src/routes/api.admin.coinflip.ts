import { createFileRoute } from '@tanstack/react-router'
import { requireAdminSession } from '../lib/discord.server'
import { clearCurrentEventCache, requireCurrentEvent } from '../lib/services'
import {
  completeCoinflip,
  ensureDefaultTeams,
  getDbEvent,
  recordCoinflipChoice,
  resetCoinflip,
  selectCoinflipCaller,
  updateTeamAssignments,
  updateEventCoinflipOptions,
} from '../lib/db.server'
import { publishEventUpdate } from '../lib/realtime.server'

export const Route = createFileRoute('/api/admin/coinflip')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await requireAdminSession()
        const event = await requireCurrentEvent()
        const body = await request.json().catch(() => ({}))
        const action = String(body.action ?? 'select-caller')

        await ensureDefaultTeams(event)
        let result: Record<string, unknown>
        if (action === 'options') {
          result = await updateEventCoinflipOptions(
            event.id,
            body.availableFactions,
            body.availableSides,
          )
        } else if (action === 'select-caller') {
          result = await selectCoinflipCaller(event.id)
        } else if (action === 'flip') {
          result = await completeCoinflip(event.id, String(body.call ?? ''))
        } else if (action === 'choice') {
          result = await recordCoinflipChoice(event.id, {
            choiceType: String(body.choiceType ?? ''),
            faction: String(body.faction ?? ''),
            startingSide: String(body.startingSide ?? ''),
          })
        } else if (action === 'assignments') {
          result = await updateTeamAssignments(event.id, Array.isArray(body.assignments) ? body.assignments : [])
        } else if (action === 'reset') {
          result = await resetCoinflip(event.id)
        } else {
          throw new Response('Unknown coinflip action', { status: 400 })
        }

        clearCurrentEventCache()
        const updated = await getDbEvent(event.id)
        publishEventUpdate(event.id, `coinflip.${action}`)

        return Response.json({
          ok: true,
          message: summarizeCoinflipAction(action, result),
          ...result,
          event: updated,
        })
      },
    },
  },
  component: () => null,
})

function summarizeCoinflipAction(action: string, result: Record<string, unknown>) {
  if (typeof result.message === 'string') return result.message
  if (action === 'options') return 'Coinflip faction options saved.'
  if (action === 'select-caller') return 'Coinflip caller selected.'
  if (action === 'flip') {
    return `${String(result.winner)} won the ${String(result.result)} coinflip.`
  }
  if (action === 'reset') return 'Coinflip reset.'
  if (action === 'assignments') return 'Team assignments saved.'
  return 'Coinflip updated.'
}
