import { createFileRoute } from '@tanstack/react-router'
import { requireAdminSession } from '../lib/discord.server'
import {
  assignManualBadge,
  createManualBadge,
  deleteManualBadge,
  getAdminBadgeManagerData,
  unassignManualBadge,
  updateBadgeDefinition,
} from '../lib/db.server'
import { publishEventUpdate } from '../lib/realtime.server'

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
          const result = {
            ok: true,
            message: 'Badge created.',
            ...createManualBadge({
              name: String(body.name ?? ''),
              description: String(body.description ?? ''),
              color: String(body.color ?? ''),
            }),
          }
          publishEventUpdate('general', 'badges.updated')
          return Response.json(result)
        }

        if (body.action === 'update') {
          const result = {
            ok: true,
            message: 'Badge updated.',
            ...updateBadgeDefinition(String(body.badgeId ?? ''), {
              name: body.name,
              description: body.description,
              color: body.color,
            }),
          }
          publishEventUpdate('general', 'badges.updated')
          return Response.json(result)
        }

        if (body.action === 'delete') {
          const result = {
            ok: true,
            message: 'Badge deleted.',
            ...deleteManualBadge(String(body.badgeId ?? '')),
          }
          publishEventUpdate('general', 'badges.updated')
          return Response.json(result)
        }

        if (body.action === 'assign') {
          const result = {
            ok: true,
            message: 'Badge assigned.',
            ...assignManualBadge(String(body.badgeId ?? ''), String(body.discordId ?? '')),
          }
          publishEventUpdate('general', 'badges.updated')
          return Response.json(result)
        }

        if (body.action === 'unassign') {
          const result = {
            ok: true,
            message: 'Badge assignment removed.',
            ...unassignManualBadge(String(body.badgeId ?? ''), String(body.discordId ?? '')),
          }
          publishEventUpdate('general', 'badges.updated')
          return Response.json(result)
        }

        throw new Response('Unknown badge action.', { status: 400 })
      },
    },
  },
  component: () => null,
})
