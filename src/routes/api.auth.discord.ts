import { createFileRoute } from '@tanstack/react-router'
import { discordAuthorizeUrl } from '../lib/discord'
import { getHammaSession } from '../lib/discord.server'

export const Route = createFileRoute('/api/auth/discord')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const session = await getHammaSession()
        const state = crypto.randomUUID()

        await session.update({ oauthState: state })

        return new Response(null, {
          status: 302,
          headers: {
            Location: discordAuthorizeUrl(state, request.url),
          },
        })
      },
    },
  },
  component: () => null,
})
