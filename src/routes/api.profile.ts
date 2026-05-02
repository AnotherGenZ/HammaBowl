import { createFileRoute } from '@tanstack/react-router'
import { getDiscordSessionUser } from '../lib/discord.server'
import {
  getPlayerSettings,
  savePlayerCharacters,
  updatePlayerProfile,
} from '../lib/db.server'
import { resolveJaegerCharacter } from '../lib/census.server'
import { isProfileBanner } from '../lib/profileBanners'
import { publishEventUpdate } from '../lib/realtime.server'
import type { Faction } from '../lib/types'

const FACTIONS: Faction[] = ['TR', 'VS', 'NC']

export const Route = createFileRoute('/api/profile')({
  server: {
    handlers: {
      GET: async () => {
        const user = await requireUser()
        return Response.json({ profile: getPlayerSettings(user.id) })
      },
      PATCH: async ({ request }) => {
        const user = await requireUser()
        const body = await request.json() as {
          bannerUrl?: string
          catchphrase?: string
          noPersonalJaegerAccount?: boolean
          badgeDisplayOrder?: string[]
        }
        const current = getPlayerSettings(user.id)
        const updatesCustomization = 'bannerUrl' in body || 'catchphrase' in body || 'badgeDisplayOrder' in body
        const hasAllCharacters = FACTIONS.every((faction) =>
          current.characters.some((character) => character.faction === faction),
        )
        const willBeComplete =
          ('noPersonalJaegerAccount' in body
            ? Boolean(body.noPersonalJaegerAccount)
            : current.noPersonalJaegerAccount) || hasAllCharacters
        if (updatesCustomization && !willBeComplete) {
          throw new Response('Complete Jaeger settings before customizing your profile.', { status: 403 })
        }
        if ('bannerUrl' in body && body.bannerUrl && !isProfileBanner(body.bannerUrl)) {
          throw new Response('Choose one of the available profile banners.', { status: 400 })
        }
        const profile = updatePlayerProfile(user.id, {
            bannerUrl: 'bannerUrl' in body ? String(body.bannerUrl ?? '') : undefined,
            catchphrase: 'catchphrase' in body ? String(body.catchphrase ?? '') : undefined,
            noPersonalJaegerAccount:
              'noPersonalJaegerAccount' in body ? Boolean(body.noPersonalJaegerAccount) : undefined,
            badgeDisplayOrder: Array.isArray(body.badgeDisplayOrder) ? body.badgeDisplayOrder : undefined,
          })
        publishEventUpdate('general', 'player.profile.updated')
        return Response.json({ profile })
      },
      PUT: async ({ request }) => {
        const user = await requireUser()
        const body = await request.json() as Partial<Record<Faction, string>>
        const resolved = await Promise.all(
          FACTIONS.map((faction) => resolveJaegerCharacter(faction, String(body[faction] ?? ''))),
        )
        const profile = savePlayerCharacters(user.id, resolved)
        publishEventUpdate('general', 'player.jaeger.updated')
        return Response.json({ profile, resolved })
      },
    },
  },
  component: () => null,
})

async function requireUser() {
  const user = await getDiscordSessionUser()
  if (!user) throw new Response('Discord login required', { status: 401 })
  return user
}
