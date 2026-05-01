import { createFileRoute } from '@tanstack/react-router'
import {
  exchangeDiscordCode,
  getDiscordIdentity,
} from '../lib/discord'
import { getHammaSession } from '../lib/discord.server'

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

        const token = await exchangeDiscordCode(code)
        const identity = await getDiscordIdentity(token.access_token)

        await session.update({
          oauthState: undefined,
          discordId: identity.discordId,
          username: identity.username,
          displayName: identity.displayName,
          avatar: identity.avatar,
          accessToken: token.access_token,
          refreshToken: token.refresh_token,
          roleIds: identity.roleIds,
          roles: identity.roles,
        })

        return new Response(null, {
          status: 302,
          headers: { Location: '/' },
        })
      },
    },
  },
  component: () => null,
})
