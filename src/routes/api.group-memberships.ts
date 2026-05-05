import { createFileRoute } from '@tanstack/react-router'
import { getDiscordSessionUser } from '../lib/discord.server'
import {
  acceptGroupMember,
  getGroupDetailForUser,
  isGroupAdministrator,
  kickGroupMember,
  requestGroupMembership,
  setGroupAdministrator,
} from '../lib/db.server'
import { clearCurrentEventCache } from '../lib/services'

export const Route = createFileRoute('/api/group-memberships')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await getDiscordSessionUser()
        if (!user) throw new Response('Discord login required', { status: 401 })
        const body = await request.json() as {
          action?: string
          groupId?: string
          discordId?: string
          enabled?: boolean
        }
        const groupId = String(body.groupId ?? '')

        try {
          if (body.action === 'request') {
            const group = requestGroupMembership(groupId, {
              id: user.id,
              name: user.name,
              avatarUrl: user.avatarUrl,
            })
            clearCurrentEventCache()
            return Response.json({
              ok: true,
              group,
            })
          }

          if (body.action === 'accept') {
            await requireGroupManager(groupId, user)
            const group = acceptGroupMember(groupId, String(body.discordId ?? ''))
            clearCurrentEventCache()
            return Response.json({
              ok: true,
              group,
            })
          }

          if (body.action === 'kick') {
            await requireGroupManager(groupId, user)
            if (!user.roles.includes('admin') && isGroupAdministrator(groupId, String(body.discordId ?? ''))) {
              throw new Response('Site admin access required to remove a group administrator.', { status: 403 })
            }
            const group = kickGroupMember(groupId, String(body.discordId ?? ''))
            clearCurrentEventCache()
            return Response.json({
              ok: true,
              group,
            })
          }

          if (body.action === 'leave') {
            kickGroupMember(groupId, user.id)
            clearCurrentEventCache()
            return Response.json({
              ok: true,
              group: getGroupDetailForUser(groupId, user.id, false),
            })
          }

          if (body.action === 'set-admin') {
            if (!user.roles.includes('admin')) {
              throw new Response('Site admin access required', { status: 403 })
            }
            const group = setGroupAdministrator(
              groupId,
              String(body.discordId ?? ''),
              Boolean(body.enabled),
            )
            clearCurrentEventCache()
            return Response.json({
              ok: true,
              group,
            })
          }

          throw new Response('Unknown group membership action.', { status: 400 })
        } catch (error) {
          if (error instanceof Response) throw error
          return errorResponse(error)
        }
      },
    },
  },
  component: () => null,
})

async function requireGroupManager(
  groupId: string,
  user: { id: string; roles: string[] },
) {
  if (user.roles.includes('admin')) return
  if (isGroupAdministrator(groupId, user.id)) return
  throw new Response('Group administrator access required', { status: 403 })
}

function errorResponse(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unable to update group membership.'
  return Response.json({ ok: false, message }, { status: 400 })
}
