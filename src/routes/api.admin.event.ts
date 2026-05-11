import { createFileRoute } from '@tanstack/react-router'
import { requireAdminSession } from '../lib/discord.server'
import { deleteEvent, getDbEvent, resetHonuReportState, setActiveEvent, updateEventAdminSettings } from '../lib/db.server'
import { generateHonuLinksForEvent } from '../lib/honu.server'
import { publishEventUpdate } from '../lib/realtime.server'
import { clearCurrentEventCache, getCurrentEvent, getCurrentEvents, requireCurrentEvent } from '../lib/services'

export const Route = createFileRoute('/api/admin/event')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        await requireAdminSession()
        const url = new URL(request.url)
        const eventId = url.searchParams.get('eventId')?.trim()
        const event = eventId ? await getDbEvent(eventId) : await getCurrentEvent()
        const eventOps = event?.source === 'native'
          ? await import('../lib/eventSignups.server')
            .then((module) => module.getNativeEventDetails(event.id))
            .catch(() => null)
          : null
        const discordOptions = await import('../lib/discordGuildOptions.server')
          .then((module) => module.getCachedDiscordGuildOptions())
          .catch((error) => ({
            channels: [],
            roles: [],
            emojis: [],
            error: error instanceof Error ? error.message : 'Unable to load Discord options.',
          }))

        return Response.json({
          event,
          eventOps,
          discordOptions,
          currentEvents: await getCurrentEvents(),
        })
      },
      POST: async ({ request }) => {
        const admin = await requireAdminSession()
        const body = await request.json()

        if (body.action === 'discord-options.refresh') {
          const discordOptions = await import('../lib/discordGuildOptions.server')
            .then((module) => module.getCachedDiscordGuildOptions({ force: true }))
          return Response.json({
            ok: true,
            message: `Discord cache refreshed: ${discordOptions.channels.length} channels, ${discordOptions.roles.length} roles, ${discordOptions.emojis.length} custom emojis.`,
            discordOptions,
          })
        }

        if (typeof body.action === 'string' && body.action.startsWith('native-event.')) {
          const {
            createNativeEvent,
            duplicateNativeEvent,
            getNativeEventDetails,
            reopenNativeEvent,
            removeNativeSignup,
            setNativeEventPhase,
            updateNativeEvent,
            upsertNativeSignup,
          } = await import('../lib/eventSignups.server')
          const {
            publishNativeEventSignupMessage,
            syncDiscordScheduledEvent,
            sendNativeEventTargetedMessage,
            updateExistingNativeEventSignupMessage,
            updateNativeEventSignupMessageSoon,
          } = await import('../lib/eventDiscord.server')
          const actorDiscordId = admin.id

          try {
            if (body.action === 'native-event.create') {
              const event = await createNativeEvent(body, actorDiscordId)
              clearCurrentEventCache()
              publishEventUpdate(event.id, 'native-event.created')
              return Response.json({ ok: true, message: 'Native event created.', event, eventOps: await getNativeEventDetails(event.id) })
            }
            if (body.action === 'native-event.update') {
              const event = await updateNativeEvent(body, actorDiscordId)
              clearCurrentEventCache()
              await updateExistingNativeEventSignupMessage(event.id)
              publishEventUpdate(event.id, 'native-event.updated')
              return Response.json({ ok: true, message: 'Native event updated.', event, eventOps: await getNativeEventDetails(event.id) })
            }
            if (body.action === 'native-event.duplicate') {
              const event = await duplicateNativeEvent(String(body.eventId ?? ''), {
                startsAt: String(body.startsAt ?? ''),
                copySignups: Boolean(body.copySignups),
              }, actorDiscordId)
              clearCurrentEventCache()
              publishEventUpdate(event.id, 'native-event.duplicated')
              return Response.json({ ok: true, message: 'Native event duplicated.', event, eventOps: await getNativeEventDetails(event.id) })
            }
            if (body.action === 'native-event.signup') {
              const eventId = String(body.eventId ?? '')
              const eventOps = await upsertNativeSignup({
                eventId,
                discordId: String(body.discordId ?? ''),
                name: String(body.name ?? ''),
                status: String(body.status ?? 'accepted'),
                specs: body.specs,
                note: String(body.note ?? ''),
                actorDiscordId,
                actorIsAdmin: true,
              })
              clearCurrentEventCache()
              publishEventUpdate(eventId, 'native-event.signup.updated')
              updateNativeEventSignupMessageSoon(eventId)
              return Response.json({ ok: true, message: 'Signup saved.', event: eventOps.event, eventOps })
            }
            if (body.action === 'native-event.signup.remove') {
              const eventId = String(body.eventId ?? '')
              const eventOps = await removeNativeSignup(eventId, String(body.discordId ?? ''), actorDiscordId)
              clearCurrentEventCache()
              publishEventUpdate(eventId, 'native-event.signup.removed')
              updateNativeEventSignupMessageSoon(eventId)
              return Response.json({ ok: true, message: 'Signup removed.', event: eventOps.event, eventOps })
            }
            if (body.action === 'native-event.close') {
              const event = await setNativeEventPhase(String(body.eventId ?? ''), 'rating', actorDiscordId)
              clearCurrentEventCache()
              publishEventUpdate(event.id, 'native-event.closed')
              updateNativeEventSignupMessageSoon(event.id)
              return Response.json({ ok: true, message: 'Signups closed.', event, eventOps: await getNativeEventDetails(event.id) })
            }
            if (body.action === 'native-event.open') {
              const event = await reopenNativeEvent(String(body.eventId ?? ''), actorDiscordId)
              clearCurrentEventCache()
              publishEventUpdate(event.id, 'native-event.opened')
              updateNativeEventSignupMessageSoon(event.id)
              return Response.json({ ok: true, message: 'Signups reopened.', event, eventOps: await getNativeEventDetails(event.id) })
            }
            if (body.action === 'native-event.archive') {
              const event = await setNativeEventPhase(String(body.eventId ?? ''), 'locked', actorDiscordId)
              clearCurrentEventCache()
              publishEventUpdate(event.id, 'native-event.archived')
              updateNativeEventSignupMessageSoon(event.id)
              return Response.json({ ok: true, message: 'Event locked.', event, eventOps: await getNativeEventDetails(event.id) })
            }
            if (body.action === 'native-event.post') {
              const eventId = String(body.eventId ?? '')
              const result = await publishNativeEventSignupMessage(eventId)
              return Response.json({
                ok: true,
                message: result.moved
                  ? 'Event message posted in the selected channel.'
                  : result.posted
                    ? 'Event message posted.'
                    : 'Event message updated.',
                result,
                eventOps: await getNativeEventDetails(eventId),
              })
            }
            if (body.action === 'native-event.scheduled-event') {
              const eventId = String(body.eventId ?? '')
              const result = await syncDiscordScheduledEvent(eventId)
              return Response.json({ ...result, eventOps: await getNativeEventDetails(eventId) })
            }
            if (body.action === 'native-event.message') {
              const result = await sendNativeEventTargetedMessage(String(body.eventId ?? ''), String(body.target ?? 'signed'), String(body.message ?? ''))
              return Response.json(result)
            }
            if (body.action === 'native-event.details') {
              const eventOps = await getNativeEventDetails(String(body.eventId ?? ''))
              return Response.json({ ok: true, event: eventOps.event, eventOps })
            }
          } catch (error) {
            return adminActionError(error)
          }

          throw new Response('Unknown native event action.', { status: 400 })
        }

        if ('activeEventId' in body) {
          const previousEvent = await getCurrentEvent().catch(() => null)
          const event = await setActiveEvent(String(body.activeEventId ?? ''))
          clearCurrentEventCache()
          if (previousEvent?.id && previousEvent.id !== event?.id) {
            publishEventUpdate(previousEvent.id, 'event.active.updated')
          }
          publishEventUpdate(event?.id ?? previousEvent?.id ?? 'active-event', 'event.active.updated')
          return Response.json({
            ok: true,
            message: event ? 'Active event updated.' : 'No active event selected.',
            event,
            currentEvents: await getCurrentEvents(),
          })
        }

        if (body.action === 'event.delete') {
          const eventId = String(body.eventId ?? '')
          const activeEvent = await getCurrentEvent().catch(() => null)
          if (activeEvent?.id === eventId) {
            throw new Response('Cannot delete the active event. Set another active event or choose no active event first.', { status: 400 })
          }
          await import('../lib/eventDiscord.server')
            .then((module) => module.deleteEventDiscordArtifacts(eventId))
          const result = await deleteEvent(eventId)
          clearCurrentEventCache()
          publishEventUpdate(eventId, 'event.deleted', { message: `${result.deletedEventName} deleted.` })
          return Response.json({
            ok: true,
            message: `${result.deletedEventName} deleted.`,
            deletedEventId: result.deletedEventId,
            event: await getCurrentEvent(),
            currentEvents: await getCurrentEvents(),
          })
        }

        const currentEvent = await requireCurrentEvent()
        const eventId = String(body.eventId || currentEvent.id)

        if (body.resetHonuReports) {
          const result = await resetHonuReportState(eventId)
          clearCurrentEventCache()
          const updated = await getDbEvent(eventId)
          publishEventUpdate(eventId, 'event.honu.reset', { message: result.message })

          return Response.json({
            ok: true,
            message: result.message,
            event: updated,
          })
        }

        if (body.generateHonuReports) {
          const result = await generateHonuLinksForEvent(eventId)
          clearCurrentEventCache()
          const updated = await getDbEvent(eventId)
          publishEventUpdate(eventId, 'event.honu.generated', { message: result.message })

          return Response.json({
            ok: true,
            message: result.message,
            event: updated,
          })
        }

        await updateEventAdminSettings(eventId, {
          nameOverride: 'nameOverride' in body ? String(body.nameOverride ?? '') : undefined,
          startsAt: 'startsAt' in body ? String(body.startsAt ?? '') : undefined,
          server: 'server' in body ? String(body.server ?? '') : undefined,
          lore: 'lore' in body ? String(body.lore ?? '') : undefined,
          twitchStreamUrl:
            'twitchStreamUrl' in body ? String(body.twitchStreamUrl ?? '') : undefined,
          twitchVodUrl: 'twitchVodUrl' in body ? String(body.twitchVodUrl ?? '') : undefined,
          eventDescription:
            'eventDescription' in body ? String(body.eventDescription ?? '') : undefined,
          eventLinks: 'eventLinks' in body ? body.eventLinks : undefined,
          trophyId: 'trophyId' in body ? String(body.trophyId ?? '') : undefined,
          draftStartMinutesBefore:
            'draftStartMinutesBefore' in body
              ? String(body.draftStartMinutesBefore ?? '')
              : undefined,
          salaryPool: 'salaryPool' in body ? String(body.salaryPool ?? '') : undefined,
          bonusPool: 'bonusPool' in body ? String(body.bonusPool ?? '') : undefined,
          maxPlayerBonus:
            'maxPlayerBonus' in body ? String(body.maxPlayerBonus ?? '') : undefined,
          bidIncrement: 'bidIncrement' in body ? String(body.bidIncrement ?? '') : undefined,
          honuZoneId: 'honuZoneId' in body ? String(body.honuZoneId ?? '') : undefined,
        })

        clearCurrentEventCache()
        const updated = await getDbEvent(eventId)
        publishEventUpdate(eventId, 'event.admin.updated')

        return Response.json({
          ok: true,
          message: 'Event settings saved.',
          event: updated,
        })
      },
    },
  },
  component: () => null,
})

function adminActionError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Action failed.'
  return Response.json({
    ok: false,
    message,
    fieldErrors: nativeEventFieldErrors(message),
  }, { status: 400 })
}

function nativeEventFieldErrors(message: string) {
  if (message.includes('Event title')) return { title: message }
  if (message.includes('Event time')) return { startsAt: message }
  if (message.includes('Signup close time')) return { signupCloseMinutesBefore: message }
  if (message.includes('Duration')) return { durationMinutes: message }
  return {}
}
