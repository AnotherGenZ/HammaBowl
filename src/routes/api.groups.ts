import { createFileRoute } from '@tanstack/react-router'
import { getDiscordSessionUser, requireAdminSession } from '../lib/discord.server'
import { createGroup, isGroupAdministrator, updateGroupProperties } from '../lib/db.server'
import { clearCurrentEventCache } from '../lib/services'

export const Route = createFileRoute('/api/groups')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        await requireAdminSession()
        const body = await request.json() as {
          tag?: string
          name?: string
          description?: string
          tagColor?: string | null
          logoUrl?: string | null
        }

        try {
          const groups = createGroup({
            tag: String(body.tag ?? ''),
            name: String(body.name ?? ''),
            description: String(body.description ?? ''),
            tagColor: typeof body.tagColor === 'string' ? body.tagColor : null,
            logoUrl: typeof body.logoUrl === 'string' ? body.logoUrl : null,
          })
          clearCurrentEventCache()
          return Response.json({
            ok: true,
            groups,
          })
        } catch (error) {
          return errorResponse(error)
        }
      },
      PATCH: async ({ request }) => {
        const body = await request.json() as {
          groupId?: string
          tag?: string
          name?: string
          description?: string
          tagColor?: string | null
          logoUrl?: string | null
        }
        const groupId = String(body.groupId ?? '')
        const user = await getDiscordSessionUser()
        const canManage = Boolean(
          user && (user.roles.includes('admin') || isGroupAdministrator(groupId, user.id)),
        )
        if (!canManage) {
          return Response.json({ ok: false, message: 'Admin access required.' }, { status: 403 })
        }

        try {
          const group = updateGroupProperties(groupId, {
            tag: body.tag,
            name: body.name,
            description: body.description,
            tagColor: body.tagColor,
            logoUrl: body.logoUrl,
          })
          clearCurrentEventCache()
          return Response.json({
            ok: true,
            group,
          })
        } catch (error) {
          return errorResponse(error)
        }
      },
    },
  },
  component: () => null,
})

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unable to save group.'
  const status = /UNIQUE constraint failed/i.test(message) ? 409 : 400
  return Response.json({ ok: false, message }, { status })
}
