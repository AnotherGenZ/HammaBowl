import { createFileRoute } from '@tanstack/react-router'
import { requireAdminSession } from '../lib/discord.server'
import {
  assignManualBadge,
  createManualBadge,
  getAdminBadgeManagerData,
  unassignManualBadge,
  updateManualBadgeColor,
} from '../lib/db.server'

export const Route = createFileRoute('/api/admin/badges')({
  server: {
    handlers: {
      GET: async () => {
        await requireAdminSession()
        return Response.json(getAdminBadgeManagerData())
      },
      POST: async ({ request }) => {
        await requireAdminSession()
        const body = await request.json() as {
          action?: string
          badgeId?: string
          discordId?: string
          name?: string
          description?: string
          color?: string
        }

        if (body.action === 'create') {
          return Response.json({
            ok: true,
            message: 'Badge created.',
            ...createManualBadge({
              name: String(body.name ?? ''),
              description: String(body.description ?? ''),
              color: String(body.color ?? ''),
            }),
          })
        }

        if (body.action === 'update-color') {
          return Response.json({
            ok: true,
            message: 'Badge color updated.',
            ...updateManualBadgeColor(String(body.badgeId ?? ''), String(body.color ?? '')),
          })
        }

        if (body.action === 'assign') {
          return Response.json({
            ok: true,
            message: 'Badge assigned.',
            ...assignManualBadge(String(body.badgeId ?? ''), String(body.discordId ?? '')),
          })
        }

        if (body.action === 'unassign') {
          return Response.json({
            ok: true,
            message: 'Badge assignment removed.',
            ...unassignManualBadge(String(body.badgeId ?? ''), String(body.discordId ?? '')),
          })
        }

        throw new Response('Unknown badge action.', { status: 400 })
      },
    },
  },
  component: () => null,
})
