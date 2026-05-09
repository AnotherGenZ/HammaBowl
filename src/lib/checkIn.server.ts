import '@tanstack/react-start/server-only'

import { checkInEventParticipant, getDbEvent } from './db.server'
import { publishEventUpdate } from './realtime.server'
import { clearCurrentEventCache, requireCurrentEvent } from './services'

export async function checkInCurrentEventParticipant(discordId: string) {
  const event = await requireCurrentEvent()
  return checkInEventParticipantAndPublish(event.id, discordId)
}

export async function checkInEventParticipantAndPublish(eventId: string, discordId: string) {
  const result = await checkInEventParticipant(eventId, discordId)
  clearCurrentEventCache()
  const updated = await getDbEvent(eventId)
  const message = result.alreadyCheckedIn
    ? `${result.player} is already checked in.`
    : `${result.player} checked in.`

  if (!result.alreadyCheckedIn) {
    publishEventUpdate(eventId, 'event.check-in', { message, tone: 'success' })
  }

  return { event: updated, message, result }
}
