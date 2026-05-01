import { createFileRoute } from '@tanstack/react-router'
import { requireAdminSession } from '../lib/discord.server'
import {
  assignPlayerManualBadge,
  getAdminPlayerProfileEditorData,
  resetPlayerCatchphrase,
  unassignPlayerManualBadge,
} from '../lib/db.server'

export const Route = createFileRoute('/api/admin/player-profile')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await requireAdminSession()
        const url = new URL(request.url)
        return Response.json(getAdminPlayerProfileEditorData(url.searchParams.get('discordId') ?? ''))
      },
      POST: async ({ request }) => {
        await requireAdminSession()
        const body = await request.json() as {
          action?: string
          discordId?: string
          badgeId?: string
        }
        const discordId = String(body.discordId ?? '')
        const badgeId = String(body.badgeId ?? '')

        if (body.action === 'assign') {
          return Response.json({
            ok: true,
            message: 'Badge assigned.',
            ...assignPlayerManualBadge(discordId, badgeId),
          })
        }

        if (body.action === 'unassign') {
          return Response.json({
            ok: true,
            message: 'Badge removed.',
            ...unassignPlayerManualBadge(discordId, badgeId),
          })
        }

        if (body.action === 'reset-catchphrase') {
          return Response.json({
            ok: true,
            message: 'Catchphrase reset.',
            ...resetPlayerCatchphrase(discordId),
          })
        }

        throw new Response('Unknown profile action.', { status: 400 })
      },
    },
  },
  component: () => null,
})
