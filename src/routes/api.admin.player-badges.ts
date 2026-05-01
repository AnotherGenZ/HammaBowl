import { createFileRoute } from '@tanstack/react-router'
import { requireAdminSession } from '../lib/discord.server'
import {
  assignPlayerManualBadge,
  getAdminPlayerBadgeEditorData,
  unassignPlayerManualBadge,
} from '../lib/db.server'

export const Route = createFileRoute('/api/admin/player-badges')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await requireAdminSession()
        const url = new URL(request.url)
        return Response.json(getAdminPlayerBadgeEditorData(url.searchParams.get('discordId') ?? ''))
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

        throw new Response('Unknown badge action.', { status: 400 })
      },
    },
  },
  component: () => null,
})
