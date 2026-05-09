import { createFileRoute } from '@tanstack/react-router'
import {
  exchangeDiscordCode,
  getDiscordIdentity,
  isDiscordGuildMemberNotFound,
} from '../lib/discord'
import { getHammaSession } from '../lib/discord.server'
import {
  hasCompletePlayerCharacters,
  syncSystemBadgeAssignmentsForUser,
  upsertParticipantProfileIdentity,
} from '../lib/db.server'
import { discordInviteUrl } from '../lib/env'

export const Route = createFileRoute('/api/auth/discord/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const code = url.searchParams.get('code')
        const state = url.searchParams.get('state')
        const session = await getHammaSession()

        if (!code || !state || state !== session.data.oauthState) {
          return new Response('Invalid Discord OAuth state', { status: 400 })
        }

        const token = await exchangeDiscordCode(code, request.url)
        const identity = await getDiscordIdentity(token.access_token).catch(async (error) => {
          if (!isDiscordGuildMemberNotFound(error)) {
            throw error
          }

          await session.update({ oauthState: undefined })

          return null
        })

        if (!identity) {
          return new Response(null, {
            status: 302,
            headers: { Location: discordInviteUrl() },
          })
        }

        await session.update({
          oauthState: undefined,
          discordId: identity.discordId,
          username: identity.username,
          displayName: identity.displayName,
          avatar: identity.avatar,
          avatarUrl: identity.avatarUrl,
        })
        upsertParticipantProfileIdentity(
          identity.discordId,
          identity.displayName,
          identity.avatarUrl,
          identity.roleIds,
        )
        syncSystemBadgeAssignmentsForUser(identity.discordId, identity.roles)

        return new Response(null, {
          status: 302,
          headers: { Location: hasCompletePlayerCharacters(identity.discordId) ? '/' : '/settings' },
        })
      },
    },
  },
  component: () => null,
})
