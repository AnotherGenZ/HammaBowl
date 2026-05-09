import { createFileRoute } from '@tanstack/react-router'
import { requireAdminSession } from '../lib/discord.server'
import { addEventSignup, getAdminSignupManagerData, removeEventSignup } from '../lib/db.server'
import { publishEventUpdate } from '../lib/realtime.server'
import { clearCurrentEventCache, requireCurrentEvent } from '../lib/services'

export const Route = createFileRoute('/api/admin/signups')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await requireAdminSession()
        const currentEvent = await requireCurrentEvent()
        const url = new URL(request.url)
        const eventId = url.searchParams.get('eventId')?.trim() || currentEvent.id

        return Response.json(getAdminSignupManagerData(eventId))
      },
      POST: async ({ request }) => {
        await requireAdminSession()
        const currentEvent = await requireCurrentEvent()
        const body = await request.json() as {
          action?: string
          eventId?: string
          discordId?: string
        }
        const eventId = String(body.eventId || currentEvent.id)
        const discordId = String(body.discordId ?? '')
        const action = String(body.action ?? '')

        if (action === 'add') {
          const event = await addEventSignup(eventId, discordId)
          if (!event) throw new Error('Event not found.')
          clearCurrentEventCache()
          publishEventUpdate(eventId, 'event.signup.added')
          return Response.json({
            ok: true,
            message: 'Player added to signups.',
            event,
            ...getAdminSignupManagerData(eventId),
          })
        }

        if (action === 'remove') {
          const event = await removeEventSignup(eventId, discordId)
          if (!event) throw new Error('Event not found.')
          clearCurrentEventCache()
          publishEventUpdate(eventId, 'event.signup.removed')
          return Response.json({
            ok: true,
            message: 'Player removed from signups.',
            event,
            ...getAdminSignupManagerData(eventId),
          })
        }

        throw new Error('Unknown signup action.')
      },
    },
  },
  component: () => null,
})
