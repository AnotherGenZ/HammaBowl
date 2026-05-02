import '@tanstack/react-start/server-only'

import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { env } from './env'
import { normalizeProfileBanner } from './profileBanners'
import {
  activeDraftBids,
  badgeDefinitions,
  coinflips,
  draftPicks,
  eventPlayerCharacters,
  eventParticipants,
  events,
  playerCharacters,
  playerBadgeAssignments,
  playerEventStats,
  playerProfiles,
  participants,
  ratings,
  scoreAdjustments,
  teams,
} from './schema'
import {
  BONUS_CAP,
  SALARY_POOL,
  TEAM_BUDGET,
  buildTeamLedgers,
  calculatePlayerSalaries,
  canAcquirePlayer,
  isCaptainPlayer,
} from './rules'
import type {
  AdminBadgeManagerData,
  AdminPlayerProfileEditorData,
  AdminPlayerCharacterConfig,
  Captain,
  DraftPick,
  EventPlayerCharacterAssignment,
  Faction,
  HammaEvent,
  HistoricalEvent,
  Player,
  PlayerBadge,
  PlayerCharacter,
  PlayerProfile,
  PlayerProfileSummary,
  Rating,
  RegisteredParticipant,
  StartingSide,
} from './types'

const dbPath = env('DATABASE_URL', path.join(process.cwd(), 'data', 'hammabowl.sqlite'))
const BID_INCREMENT = 1_000_000
fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite)

bootstrap()

export async function upsertEventFromRaidHelper(event: HammaEvent) {
  const now = new Date().toISOString()

  db.insert(events)
    .values({
      id: event.id,
      raidHelperEventId: event.raidHelperEventId,
      name: event.name,
      server: event.server,
      startsAt: event.startsAt,
      closingTime: event.closingTime,
    phase: event.phase,
    salaryPool: event.salaryPool,
    pendingSignupCount: event.pendingPlayerCount ?? 0,
    availableFactions: JSON.stringify(event.availableFactions ?? ['VS', 'NC', 'TR']),
    availableSides: JSON.stringify(event.availableSides ?? ['north', 'south']),
    updatedAt: now,
  })
    .onConflictDoUpdate({
      target: events.raidHelperEventId,
      set: {
        name: event.name,
        startsAt: event.startsAt,
        closingTime: event.closingTime,
        pendingSignupCount: event.pendingPlayerCount ?? 0,
        updatedAt: now,
      },
    })
    .run()

  const persistedEvent = db
    .select()
    .from(events)
    .where(eq(events.raidHelperEventId, event.raidHelperEventId))
    .get()
  if (!persistedEvent) throw new Error('Failed to persist Raid Helper event.')

  const acceptedDiscordIds = new Set(event.players.map((player) => player.id))
  const staleParticipants = db
    .select()
    .from(eventParticipants)
    .where(eq(eventParticipants.eventId, persistedEvent.id))
    .all()
    .filter((participant) => !acceptedDiscordIds.has(participant.discordId))

  for (const participant of staleParticipants) {
    db.update(eventParticipants)
      .set({
        status: 'disqualified',
        disqualified: true,
        updatedAt: now,
      })
      .where(
        and(
          eq(eventParticipants.eventId, persistedEvent.id),
          eq(eventParticipants.discordId, participant.discordId),
        ),
      )
      .run()
  }

  for (const player of event.players) {
    upsertParticipant(player.id, player.name, now)
    db.insert(eventParticipants)
      .values({
        eventId: persistedEvent.id,
        discordId: player.id,
        name: player.name,
        status: player.status,
        disqualified: player.status === 'disqualified',
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [eventParticipants.eventId, eventParticipants.discordId],
        set: {
          name: player.name,
          status: player.status,
          disqualified: player.status === 'disqualified',
          updatedAt: now,
        },
      })
      .run()
  }

  return persistedEvent.id
}

export async function getDbEvent(eventId: string): Promise<HammaEvent | null> {
  const event = db.select().from(events).where(eq(events.id, eventId)).get()
  if (!event) return null

  const participantRows = db
    .select()
    .from(eventParticipants)
    .where(eq(eventParticipants.eventId, event.id))
    .all()
  const participantNames = getParticipantNameMap(participantRows.map((participant) => participant.discordId))
  const teamRows = db.select().from(teams).where(eq(teams.eventId, event.id)).all()
  const ratingRows = db.select().from(ratings).where(eq(ratings.eventId, event.id)).all()
  const pickRows = db.select().from(draftPicks).where(eq(draftPicks.eventId, event.id)).all()
  const activeBidRow = db
    .select()
    .from(activeDraftBids)
    .where(and(eq(activeDraftBids.eventId, event.id), eq(activeDraftBids.status, 'active')))
    .get()
  const coinflipRow = db.select().from(coinflips).where(eq(coinflips.eventId, event.id)).get()

  const activeParticipantRows = participantRows.filter((participant) => !participant.disqualified)
  const activeParticipantIds = new Set(activeParticipantRows.map((participant) => participant.discordId))
  const players: Player[] = activeParticipantRows.map((participant) => ({
    id: participant.discordId,
    name: participantNames.get(participant.discordId) ?? participant.name,
    outfit: '',
    faction: 'NS',
    status: 'signed_up',
  }))

  const captains: Captain[] = teamRows.map((team) => ({
    id: team.id,
    playerId: team.captainDiscordId ?? '',
    teamName: team.name,
    faction: normalizeFaction(team.faction),
    startingSide: normalizeStartingSide(team.startingSide),
    budget: team.budget,
    bonusCap: team.bonusCap,
    score: team.score,
  }))

  const eventRatings: Rating[] = ratingRows.map((rating) => ({
    fromPlayerId: rating.fromDiscordId,
    toPlayerId: rating.toDiscordId,
    score: rating.score,
    note: rating.note ?? undefined,
    disqualified: rating.disqualified,
  }))

  const eventDraftPicks: DraftPick[] = pickRows
    .filter((pick) => activeParticipantIds.has(pick.playerDiscordId))
    .map((pick) => ({
      id: pick.id,
      playerId: pick.playerDiscordId,
      captainId: pick.teamId,
      salary: pick.salary,
      bonusSpent: pick.bonusSpent,
      contestedByCaptainId: pick.contestedByTeamId ?? undefined,
      confirmedAt: pick.confirmedAt,
    }))

  return {
    id: event.id,
    raidHelperEventId: event.raidHelperEventId,
    name: event.nameOverride || event.name,
    nameOverride: event.nameOverride ?? undefined,
    server: event.server,
    startsAt: event.startsAt,
    closingTime: event.closingTime ?? undefined,
    phase: event.phase as HammaEvent['phase'],
    salaryPool: event.salaryPool,
    pendingPlayerCount: event.pendingSignupCount,
    availableFactions: parseAvailableFactions(event.availableFactions),
    availableSides: parseAvailableSides(event.availableSides),
    captains,
    players,
    ratings: eventRatings,
    draftPicks: eventDraftPicks,
    activeDraftBid: activeBidRow && activeParticipantIds.has(activeBidRow.playerDiscordId)
      ? {
          id: activeBidRow.id,
          playerId: activeBidRow.playerDiscordId,
          openedByCaptainId: activeBidRow.openedByTeamId,
          highestCaptainId: activeBidRow.highestTeamId,
          nextCaptainId: activeBidRow.nextTeamId,
          currentBonus: activeBidRow.currentBonus,
          createdAt: activeBidRow.createdAt,
          updatedAt: activeBidRow.updatedAt,
        }
      : undefined,
    nextPickCaptainId: event.nextPickTeamId ?? undefined,
    coinflip: coinflipRow
      ? {
          id: coinflipRow.id,
          callingCaptainId: coinflipRow.callingTeamId ?? '',
          call: normalizeCoinSide(coinflipRow.callerCall),
          result: normalizeCoinSide(coinflipRow.result),
          winningCaptainId: coinflipRow.winningTeamId ?? undefined,
          choiceType: normalizeChoiceType(coinflipRow.winnerChoiceType),
          chosenFaction: normalizeFaction(coinflipRow.winnerFaction),
          chosenStartingSide: normalizeStartingSide(coinflipRow.winnerStartingSide),
          firstPickCaptainId: coinflipRow.firstPickTeamId ?? undefined,
          createdAt: coinflipRow.createdAt,
          updatedAt: coinflipRow.updatedAt ?? undefined,
        }
      : undefined,
    winningCaptainId: event.winningTeamId ?? undefined,
    twitchStreamUrl: event.twitchStreamUrl ?? undefined,
    twitchVodUrl: event.twitchVodUrl ?? undefined,
    lore: event.lore ?? undefined,
  }
}

export async function getCurrentDbEvent(): Promise<HammaEvent | null> {
  const eventRows = db.select().from(events).all()
  if (!eventRows.length) return null

  const configuredRaidHelperEventId = env('RAID_HELPER_EVENT_ID')
  const configuredEvent = configuredRaidHelperEventId
    ? eventRows.find((event) => event.raidHelperEventId === configuredRaidHelperEventId)
    : undefined

  const selected = configuredEvent ?? selectCurrentDbEventRow(eventRows)
  return selected ? getDbEvent(selected.id) : null
}

function selectCurrentDbEventRow<T extends { startsAt: string; updatedAt: string }>(eventRows: T[]) {
  const now = Date.now()
  const byStartsAtAsc = (a: T, b: T) =>
    new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  const byStartsAtDesc = (a: T, b: T) =>
    new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime()
  const byUpdatedAtDesc = (a: T, b: T) =>
    new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()

  return (
    eventRows
      .filter((event) => new Date(event.startsAt).getTime() >= now)
      .sort(byStartsAtAsc)[0] ??
    [...eventRows].sort(byStartsAtDesc)[0] ??
    [...eventRows].sort(byUpdatedAtDesc)[0]
  )
}

export async function ensureDefaultTeams(event: HammaEvent) {
  const now = new Date().toISOString()
  const existing = db.select().from(teams).where(eq(teams.eventId, event.id)).all()
  if (existing.length >= 2) return existing

  const participants = event.players.slice(0, 2)
  const rows = [
    {
      id: `${event.id}-team-a`,
      eventId: event.id,
      name: 'Team Alpha',
      captainDiscordId: participants[0]?.id,
      budget: TEAM_BUDGET,
      bonusCap: BONUS_CAP,
      score: 0,
    },
    {
      id: `${event.id}-team-b`,
      eventId: event.id,
      name: 'Team Bravo',
      captainDiscordId: participants[1]?.id,
      budget: TEAM_BUDGET,
      bonusCap: BONUS_CAP,
      score: 0,
    },
  ]

  for (const row of rows) {
    db.insert(teams).values(row).onConflictDoNothing().run()
  }

  return db.select().from(teams).where(eq(teams.eventId, event.id)).all()
}

export async function updateTeamSettings(
  eventId: string,
  teamId: string,
  values: {
    name?: string
    captainDiscordId?: string
    faction?: string
    startingSide?: string
    score?: number
  },
) {
  const team = db
    .select()
    .from(teams)
    .where(and(eq(teams.eventId, eventId), eq(teams.id, teamId)))
    .get()
  if (!team) throw new Error('Team not found.')

  db.update(teams)
    .set({
      name: values.name?.trim() || team.name,
      captainDiscordId: values.captainDiscordId || null,
      faction: values.faction === undefined ? team.faction : values.faction || null,
      startingSide:
        values.startingSide === undefined ? team.startingSide : values.startingSide || null,
      score: Number.isFinite(values.score) ? values.score : team.score,
    })
    .where(eq(teams.id, teamId))
    .run()

  return { ok: true }
}

export async function updateEventCoinflipOptions(
  eventId: string,
  availableFactions: string[],
  availableSides: string[],
) {
  const factions = normalizeFactionList(availableFactions)
  if (!factions.length) throw new Error('Select at least one available faction.')
  const sides = normalizeSideList(availableSides)
  if (!sides.length) throw new Error('Select at least one available side.')

  db.update(events)
    .set({
      availableFactions: JSON.stringify(factions),
      availableSides: JSON.stringify(sides),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(events.id, eventId))
    .run()

  return { ok: true, availableFactions: factions, availableSides: sides }
}

export async function selectCoinflipCaller(eventId: string) {
  const existing = db.select().from(coinflips).where(eq(coinflips.eventId, eventId)).get()
  if (existing?.result && existing.result !== 'pending') {
    throw new Error('Coinflip has already been completed for this event.')
  }
  if (existing) return coinflipSummary(existing)

  const teamRows = db.select().from(teams).where(eq(teams.eventId, eventId)).all()
  const eligibleTeams = teamRows.filter((team) => team.captainDiscordId)
  if (eligibleTeams.length < 2) throw new Error('Assign two captains before coinflip.')

  const caller = eligibleTeams[Math.floor(Math.random() * eligibleTeams.length)]
  const now = new Date().toISOString()
  const row = {
    id: crypto.randomUUID(),
    eventId,
    callingTeamId: caller.id,
    result: 'pending',
    createdAt: now,
    updatedAt: now,
  }

  db.insert(coinflips).values(row).run()
  return coinflipSummary(row)
}

export async function completeCoinflip(eventId: string, callerCall: string) {
  const call = normalizeRequiredCoinSide(callerCall)
  const coinflip = db.select().from(coinflips).where(eq(coinflips.eventId, eventId)).get()
  if (!coinflip) throw new Error('Select the captain calling heads or tails first.')
  if (coinflip.result && coinflip.result !== 'pending') {
    throw new Error('Coinflip has already been completed for this event.')
  }
  if (!coinflip.callingTeamId) throw new Error('Coinflip caller is missing.')

  const teamRows = db.select().from(teams).where(eq(teams.eventId, eventId)).all()
  const caller = teamRows.find((team) => team.id === coinflip.callingTeamId)
  const otherTeam = teamRows.find((team) => team.id !== coinflip.callingTeamId)
  if (!caller || !otherTeam) throw new Error('Configure two teams before coinflip.')

  const result = Math.random() < 0.5 ? 'heads' : 'tails'
  const winner = result === call ? caller : otherTeam
  const now = new Date().toISOString()

  db.update(coinflips)
    .set({
      callerCall: call,
      result,
      winningTeamId: winner.id,
      choice: 'Winner may choose faction or starting side plus first pick.',
      updatedAt: now,
    })
    .where(eq(coinflips.id, coinflip.id))
    .run()

  return { id: coinflip.id, caller: caller.name, call, result, winner: winner.name }
}

export async function recordCoinflipChoice(
  eventId: string,
  values: { choiceType: string; faction?: string; startingSide?: string },
) {
  const coinflip = db.select().from(coinflips).where(eq(coinflips.eventId, eventId)).get()
  if (!coinflip?.winningTeamId || !coinflip.result || coinflip.result === 'pending') {
    throw new Error('Complete the coinflip before recording the winner choice.')
  }

  const event = db.select().from(events).where(eq(events.id, eventId)).get()
  if (!event) throw new Error('Event not found.')

  const choiceType = values.choiceType === 'faction' || values.choiceType === 'side'
    ? values.choiceType
    : undefined
  if (!choiceType) throw new Error('Choose faction or starting side.')

  const now = new Date().toISOString()
  if (choiceType === 'faction') {
    const faction = normalizeFaction(values.faction ?? '')
    if (!faction) throw new Error('Choose an available faction.')
    const availableFactions = parseAvailableFactions(event.availableFactions)
    if (!availableFactions.includes(faction)) {
      throw new Error(`${faction} is not available for this event.`)
    }

    db.update(teams).set({ faction }).where(eq(teams.id, coinflip.winningTeamId)).run()
    db.update(coinflips)
      .set({
        winnerChoiceType: 'faction',
        winnerFaction: faction,
        winnerStartingSide: null,
        firstPickTeamId: null,
        choice: `Winner chose ${faction}.`,
        updatedAt: now,
      })
      .where(eq(coinflips.id, coinflip.id))
      .run()
    db.update(events)
      .set({ nextPickTeamId: null, updatedAt: now })
      .where(eq(events.id, eventId))
      .run()

    return { ok: true, message: `Coinflip winner chose ${faction}.` }
  }

  const startingSide = normalizeStartingSide(values.startingSide ?? '')
  if (!startingSide) throw new Error('Choose a starting side.')
  const availableSides = parseAvailableSides(event.availableSides)
  if (!availableSides.includes(startingSide)) {
    throw new Error(`${formatSide(startingSide)} side is not available for this event.`)
  }
  const otherAvailableSides = availableSides.filter((side) => side !== startingSide)
  const otherSide = otherAvailableSides.length === 1 ? otherAvailableSides[0] : undefined
  const otherTeam = db
    .select()
    .from(teams)
    .where(eq(teams.eventId, eventId))
    .all()
    .find((team) => team.id !== coinflip.winningTeamId)

  db.update(teams).set({ startingSide }).where(eq(teams.id, coinflip.winningTeamId)).run()
  if (otherTeam && otherSide) {
    db.update(teams).set({ startingSide: otherSide }).where(eq(teams.id, otherTeam.id)).run()
  }
  db.update(coinflips)
    .set({
      winnerChoiceType: 'side',
      winnerFaction: null,
      winnerStartingSide: startingSide,
      firstPickTeamId: coinflip.winningTeamId,
      choice: `Winner chose ${startingSide} side and first pick.`,
      updatedAt: now,
    })
    .where(eq(coinflips.id, coinflip.id))
    .run()
  db.update(events)
    .set({ nextPickTeamId: coinflip.winningTeamId, updatedAt: now })
    .where(eq(events.id, eventId))
    .run()

  return { ok: true, message: `Coinflip winner chose ${startingSide} side and first pick.` }
}

export async function updateTeamAssignments(
  eventId: string,
  assignments: Array<{ teamId: string; faction?: string; startingSide?: string }>,
) {
  const event = db.select().from(events).where(eq(events.id, eventId)).get()
  if (!event) throw new Error('Event not found.')

  const teamRows = db.select().from(teams).where(eq(teams.eventId, eventId)).all()
  const availableFactions = parseAvailableFactions(event.availableFactions)
  const availableSides = parseAvailableSides(event.availableSides)
  const factionSelections: string[] = []
  const sideSelections: string[] = []

  for (const assignment of assignments) {
    const team = teamRows.find((row) => row.id === assignment.teamId)
    if (!team) throw new Error('Team not found.')

    const faction = assignment.faction ? normalizeFaction(assignment.faction) : undefined
    if (assignment.faction && !faction) throw new Error('Choose an available faction.')
    if (faction && !availableFactions.includes(faction)) {
      throw new Error(`${faction} is not available for this event.`)
    }

    const startingSide = assignment.startingSide
      ? normalizeStartingSide(assignment.startingSide)
      : undefined
    if (assignment.startingSide && !startingSide) throw new Error('Choose an available side.')
    if (startingSide && !availableSides.includes(startingSide)) {
      throw new Error(`${formatSide(startingSide)} side is not available for this event.`)
    }

    if (faction) factionSelections.push(faction)
    if (startingSide) sideSelections.push(startingSide)
  }

  if (availableFactions.length > 1 && hasDuplicates(factionSelections)) {
    throw new Error('Teams cannot share the same faction for this event.')
  }
  if (availableSides.length > 1 && hasDuplicates(sideSelections)) {
    throw new Error('Teams cannot share the same side for this event.')
  }

  for (const assignment of assignments) {
    db.update(teams)
      .set({
        faction: assignment.faction || null,
        startingSide: assignment.startingSide || null,
      })
      .where(and(eq(teams.eventId, eventId), eq(teams.id, assignment.teamId)))
      .run()
  }

  db.update(events).set({ updatedAt: new Date().toISOString() }).where(eq(events.id, eventId)).run()
  return { ok: true, message: 'Team assignments saved.' }
}

export async function resetCoinflip(eventId: string) {
  const coinflip = db.select().from(coinflips).where(eq(coinflips.eventId, eventId)).get()
  if (!coinflip) return { ok: true, message: 'Coinflip is already reset.' }

  if (coinflip.winnerChoiceType === 'faction' && coinflip.winningTeamId) {
    db.update(teams).set({ faction: null }).where(eq(teams.id, coinflip.winningTeamId)).run()
  }

  if (coinflip.winnerChoiceType === 'side') {
    db.update(teams).set({ startingSide: null }).where(eq(teams.eventId, eventId)).run()
  }

  db.delete(coinflips).where(eq(coinflips.eventId, eventId)).run()
  db.update(events)
    .set({ nextPickTeamId: null, updatedAt: new Date().toISOString() })
    .where(eq(events.id, eventId))
    .run()

  return { ok: true, message: 'Coinflip reset.' }
}

export async function adjustScore(eventId: string, teamId: string, delta: number) {
  const team = db
    .select()
    .from(teams)
    .where(and(eq(teams.eventId, eventId), eq(teams.id, teamId)))
    .get()
  if (!team) throw new Error('Team not found.')

  db.update(teams).set({ score: team.score + delta }).where(eq(teams.id, teamId)).run()
  db.insert(scoreAdjustments)
    .values({
      id: crypto.randomUUID(),
      eventId,
      teamId,
      delta,
      reason: 'Admin adjustment',
      createdAt: new Date().toISOString(),
    })
    .run()

  return { team: team.name, score: team.score + delta }
}

export async function updateEventLinks(eventId: string, values: { twitchStreamUrl?: string; twitchVodUrl?: string }) {
  const twitchStreamUrl = normalizeOptionalTwitchUrl(values.twitchStreamUrl)
  const twitchVodUrl = normalizeOptionalTwitchUrl(values.twitchVodUrl)

  db.update(events)
    .set({
      twitchStreamUrl,
      twitchVodUrl,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(events.id, eventId))
    .run()

  return { ok: true }
}

export async function updateEventAdminSettings(
  eventId: string,
  values: {
    nameOverride?: string
    startsAt?: string
    server?: string
    lore?: string
    twitchStreamUrl?: string
    twitchVodUrl?: string
  },
) {
  const event = db.select().from(events).where(eq(events.id, eventId)).get()
  if (!event) throw new Error('Event not found.')

  const nextStartsAt = values.startsAt?.trim()
  if (nextStartsAt && Number.isNaN(Date.parse(nextStartsAt))) {
    throw new Error('Event time must be a valid date.')
  }

  db.update(events)
    .set({
      nameOverride:
        values.nameOverride === undefined ? event.nameOverride : values.nameOverride.trim() || null,
      startsAt: nextStartsAt || event.startsAt,
      server: values.server?.trim() || event.server,
      lore: values.lore === undefined ? event.lore : values.lore.trim() || null,
      twitchStreamUrl:
        values.twitchStreamUrl === undefined
          ? event.twitchStreamUrl
          : normalizeOptionalTwitchUrl(values.twitchStreamUrl),
      twitchVodUrl:
        values.twitchVodUrl === undefined
          ? event.twitchVodUrl
          : normalizeOptionalTwitchUrl(values.twitchVodUrl),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(events.id, eventId))
    .run()

  return { ok: true }
}

export async function setWinningTeam(eventId: string, teamId: string) {
  const team = db
    .select()
    .from(teams)
    .where(and(eq(teams.eventId, eventId), eq(teams.id, teamId)))
    .get()
  if (!team) throw new Error('Team not found.')

  const winningMemberIds = new Set<string>()
  if (team.captainDiscordId) winningMemberIds.add(team.captainDiscordId)

  for (const pick of db.select().from(draftPicks).where(eq(draftPicks.teamId, teamId)).all()) {
    winningMemberIds.add(pick.playerDiscordId)
  }

  db.update(eventParticipants)
    .set({ winner: false, updatedAt: new Date().toISOString() })
    .where(eq(eventParticipants.eventId, eventId))
    .run()

  for (const discordId of winningMemberIds) {
    db.update(eventParticipants)
      .set({ winner: true, updatedAt: new Date().toISOString() })
      .where(
        and(
          eq(eventParticipants.eventId, eventId),
          eq(eventParticipants.discordId, discordId),
        ),
      )
      .run()
  }

  db.update(events)
    .set({ winningTeamId: teamId, phase: 'complete', updatedAt: new Date().toISOString() })
    .where(eq(events.id, eventId))
    .run()
  return { ok: true, winnerCount: winningMemberIds.size }
}

export async function getHistoricalEvents(): Promise<HistoricalEvent[]> {
  const eventRows = db.select().from(events).where(eq(events.phase, 'complete')).all()
  return eventRows
    .sort((a, b) => Date.parse(b.startsAt) - Date.parse(a.startsAt))
    .map((event) => buildHistoricalEvent(event))
}

export async function getHistoricalEvent(eventId: string): Promise<HistoricalEvent | null> {
  const event = db.select().from(events).where(eq(events.id, eventId)).get()
  if (!event || event.phase !== 'complete') return null
  return buildHistoricalEvent(event)
}

export async function getAdminHistoricalEvents(): Promise<{
  events: HistoricalEvent[]
  participants: RegisteredParticipant[]
}> {
  return {
    events: await getHistoricalEvents(),
    participants: getRegisteredParticipants(),
  }
}

export async function createManualHistoricalEvent(values: {
  name: string
  startsAt: string
  server?: string
}) {
  const name = values.name.trim()
  if (!name) throw new Error('Event name is required.')
  const startsAt = values.startsAt.trim()
  if (!startsAt || Number.isNaN(Date.parse(startsAt))) {
    throw new Error('Event time must be a valid date.')
  }

  const id = `manual-${crypto.randomUUID()}`
  const now = new Date().toISOString()
  db.insert(events)
    .values({
      id,
      raidHelperEventId: id,
      name,
      server: values.server?.trim() || 'Manual',
      startsAt: new Date(startsAt).toISOString(),
      phase: 'complete',
      salaryPool: SALARY_POOL,
      pendingSignupCount: 0,
      updatedAt: now,
    })
    .run()

  return getHistoricalEvent(id)
}

export async function upsertHistoricalTeam(values: {
  eventId: string
  teamId?: string
  name: string
  score?: number
  captainDiscordId?: string
  captainName?: string
}) {
  const event = db.select().from(events).where(eq(events.id, values.eventId)).get()
  if (!event) throw new Error('Event not found.')

  const name = values.name.trim()
  if (!name) throw new Error('Team name is required.')
  const now = new Date().toISOString()
  const teamId = values.teamId || `${values.eventId}-team-${crypto.randomUUID()}`
  const captainDiscordId = values.captainDiscordId?.trim() || null
  if (captainDiscordId) {
    ensureEventParticipant(
      values.eventId,
      captainDiscordId,
      values.captainName?.trim() || getParticipantName(captainDiscordId) || captainDiscordId,
      now,
    )
  }

  db.insert(teams)
    .values({
      id: teamId,
      eventId: values.eventId,
      name,
      captainDiscordId,
      budget: TEAM_BUDGET,
      bonusCap: BONUS_CAP,
      score: Number.isFinite(values.score) ? Number(values.score) : 0,
    })
    .onConflictDoUpdate({
      target: teams.id,
      set: {
        name,
        captainDiscordId,
        score: Number.isFinite(values.score) ? Number(values.score) : 0,
      },
    })
    .run()

  db.update(events).set({ updatedAt: now }).where(eq(events.id, values.eventId)).run()
  return getHistoricalEvent(values.eventId)
}

export async function addHistoricalTeamMember(values: {
  eventId: string
  teamId: string
  discordId: string
  name?: string
}) {
  const discordId = values.discordId.trim()
  if (!discordId) throw new Error('Discord ID is required.')
  const team = db
    .select()
    .from(teams)
    .where(and(eq(teams.eventId, values.eventId), eq(teams.id, values.teamId)))
    .get()
  if (!team) throw new Error('Team not found.')

  const now = new Date().toISOString()
  ensureEventParticipant(
    values.eventId,
    discordId,
    values.name?.trim() || getParticipantName(discordId) || discordId,
    now,
  )

  const existingPick = db
    .select()
    .from(draftPicks)
    .where(and(eq(draftPicks.eventId, values.eventId), eq(draftPicks.playerDiscordId, discordId)))
    .get()

  if (existingPick) {
    db.update(draftPicks)
      .set({ teamId: values.teamId })
      .where(eq(draftPicks.id, existingPick.id))
      .run()
  } else {
    db.insert(draftPicks)
      .values({
        id: crypto.randomUUID(),
        eventId: values.eventId,
        playerDiscordId: discordId,
        teamId: values.teamId,
        salary: 0,
        bonusSpent: 0,
        confirmedAt: now,
      })
      .run()
  }

  db.update(events).set({ updatedAt: now }).where(eq(events.id, values.eventId)).run()
  return getHistoricalEvent(values.eventId)
}

function buildHistoricalEvent(event: typeof events.$inferSelect): HistoricalEvent {
  const participantRows = db
    .select()
    .from(eventParticipants)
    .where(eq(eventParticipants.eventId, event.id))
    .all()
  const teamRows = db.select().from(teams).where(eq(teams.eventId, event.id)).all()
  const pickRows = db.select().from(draftPicks).where(eq(draftPicks.eventId, event.id)).all()
  const participantName = getParticipantNameMap(participantRows.map((participant) => participant.discordId))

  const historicalTeams = teamRows.map((team) => {
    const memberIds = new Set<string>()
    if (team.captainDiscordId) memberIds.add(team.captainDiscordId)
    for (const pick of pickRows.filter((candidate) => candidate.teamId === team.id)) {
      memberIds.add(pick.playerDiscordId)
    }

    return {
      id: team.id,
      name: team.name,
      captain: team.captainDiscordId ? participantName.get(team.captainDiscordId) : undefined,
      score: team.score,
      members: Array.from(memberIds)
        .map((discordId) => participantName.get(discordId) ?? discordId)
        .sort((a, b) => a.localeCompare(b)),
      winner: team.id === event.winningTeamId,
    }
  })
  const winningTeam = historicalTeams.find((team) => team.winner)

  return {
    id: event.id,
    name: event.nameOverride || event.name,
    nameOverride: event.nameOverride ?? undefined,
    date: event.startsAt,
    server: event.server,
    twitchStreamUrl: event.twitchStreamUrl ?? undefined,
    twitchVodUrl: event.twitchVodUrl ?? undefined,
    lore: event.lore ?? undefined,
    winningTeam: winningTeam
      ? {
          id: winningTeam.id,
          name: winningTeam.name,
          members: participantRows
            .filter((participant) => participant.winner)
            .map((participant) => participantName.get(participant.discordId) ?? participant.name)
            .sort((a, b) => a.localeCompare(b)),
        }
      : undefined,
    teams: historicalTeams,
  }
}

function getRegisteredParticipants(): RegisteredParticipant[] {
  return db
    .select()
    .from(participants)
    .all()
    .map((participant) => ({
      discordId: participant.discordId,
      name: participant.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function confirmDraftPick(
  event: HammaEvent,
  teamId: string,
  playerDiscordId: string,
  bonusSpent: number,
  contestedByTeamId?: string,
) {
  const team = event.captains.find((captain) => captain.id === teamId)
  if (!team) throw new Error('Team not found.')

  const player = event.players.find((candidate) => candidate.id === playerDiscordId)
  if (!player) throw new Error('Player not found.')

  if (event.draftPicks.some((pick) => pick.playerId === playerDiscordId)) {
    throw new Error('Player has already been drafted.')
  }

  if (bonusSpent < 0 || !Number.isFinite(bonusSpent)) {
    throw new Error('Bonus spent must be zero or more.')
  }

  const salaries = calculatePlayerSalaries(event)
  const salary = salaries.find((item) => item.player.id === playerDiscordId)?.salary
  if (salary === undefined) throw new Error('Player is not eligible for the draft.')

  const ledger = buildTeamLedgers(event).find((item) => item.captain.id === teamId)
  if (!ledger) throw new Error('Team ledger not found.')

  if (!Number.isInteger(bonusSpent)) {
    throw new Error('Bonus spent must be a whole dollar amount.')
  }
  if (bonusSpent > ledger.bonusRemaining) {
    throw new Error('That team does not have enough bonus cap remaining.')
  }
  if (salary + bonusSpent > ledger.combinedRemaining) {
    throw new Error('That team does not have enough combined budget remaining.')
  }

  if (!canAcquirePlayer(event, teamId, playerDiscordId, bonusSpent)) {
    throw new Error('That team cannot afford this player.')
  }

  const id = crypto.randomUUID()
  db.insert(draftPicks)
    .values({
      id,
      eventId: event.id,
      playerDiscordId,
      teamId,
      salary,
      bonusSpent,
      contestedByTeamId: contestedByTeamId || null,
      confirmedAt: new Date().toISOString(),
    })
    .run()

  db.update(events).set({ phase: 'draft', updatedAt: new Date().toISOString() }).where(eq(events.id, event.id)).run()

  return { id, player: player.name, team: team.teamName, salary, bonusSpent }
}

export async function openDraftBid(event: HammaEvent, teamId: string, playerDiscordId: string) {
  if (event.activeDraftBid) throw new Error('A bid is already open.')

  const team = event.captains.find((captain) => captain.id === teamId)
  if (!team) throw new Error('Team not found.')

  const opposingTeam = event.captains.find((captain) => captain.id !== teamId)
  if (!opposingTeam) throw new Error('Configure an opposing team before opening bids.')

  const player = event.players.find((candidate) => candidate.id === playerDiscordId)
  if (!player) throw new Error('Player not found.')

  if (event.draftPicks.some((pick) => pick.playerId === playerDiscordId)) {
    throw new Error('Player has already been drafted.')
  }

  const salary = calculatePlayerSalaries(event).find((item) => item.player.id === playerDiscordId)?.salary
  if (salary === undefined) throw new Error('Player is not eligible for the draft.')

  const ledger = buildTeamLedgers(event).find((item) => item.captain.id === teamId)
  if (!ledger) throw new Error('Team ledger not found.')

  const openingBonus = 0
  if (salary > ledger.combinedRemaining) {
    throw new Error('That team does not have enough combined budget remaining.')
  }
  if (!canAcquirePlayer(event, teamId, playerDiscordId, openingBonus)) {
    throw new Error('That team cannot afford to open this bid.')
  }

  const now = new Date().toISOString()
  const id = crypto.randomUUID()
  db.insert(activeDraftBids)
    .values({
      id,
      eventId: event.id,
      playerDiscordId,
      openedByTeamId: teamId,
      highestTeamId: teamId,
      nextTeamId: opposingTeam.id,
      currentBonus: openingBonus,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })
    .run()

  db.update(events).set({ phase: 'draft', updatedAt: now }).where(eq(events.id, event.id)).run()

  return {
    id,
    player: player.name,
    team: team.teamName,
    currentBonus: openingBonus,
    nextTeam: opposingTeam.teamName,
  }
}

export async function bumpDraftBid(event: HammaEvent, bidId: string, teamId: string) {
  const bid = getActiveBid(event.id, bidId)
  if (bid.nextTeamId !== teamId) throw new Error('It is not your turn to raise this bid.')

  const nextBonus = bid.currentBonus + BID_INCREMENT
  const ledger = buildTeamLedgers(event).find((item) => item.captain.id === teamId)
  if (!ledger) throw new Error('Team ledger not found.')
  if (nextBonus > ledger.bonusRemaining) {
    throw new Error('That team does not have enough bonus cap to raise.')
  }
  const salary = calculatePlayerSalaries(event).find((item) => item.player.id === bid.playerDiscordId)?.salary
  if (salary === undefined) throw new Error('Player is not eligible for the draft.')
  if (salary + nextBonus > ledger.combinedRemaining) {
    throw new Error('That team does not have enough combined budget remaining.')
  }
  if (!canAcquirePlayer(event, teamId, bid.playerDiscordId, nextBonus)) {
    throw new Error('That team does not have enough bonus cap to raise.')
  }

  const now = new Date().toISOString()
  db.update(activeDraftBids)
    .set({
      highestTeamId: teamId,
      nextTeamId: bid.highestTeamId,
      currentBonus: nextBonus,
      updatedAt: now,
    })
    .where(eq(activeDraftBids.id, bid.id))
    .run()

  const player = event.players.find((candidate) => candidate.id === bid.playerDiscordId)
  const team = event.captains.find((captain) => captain.id === teamId)
  db.update(events).set({ updatedAt: now }).where(eq(events.id, event.id)).run()

  return {
    player: player?.name ?? bid.playerDiscordId,
    team: team?.teamName ?? teamId,
    currentBonus: nextBonus,
  }
}

export async function forfeitDraftBid(event: HammaEvent, bidId: string, teamId: string) {
  const bid = getActiveBid(event.id, bidId)
  if (bid.nextTeamId !== teamId) throw new Error('It is not your turn to forfeit this bid.')
  const nextPickTeamId = nextPickTeamAfterBidResolution(bid)

  const result = await confirmDraftPick(
    event,
    bid.highestTeamId,
    bid.playerDiscordId,
    bid.currentBonus,
    bid.currentBonus > 0 ? teamId : undefined,
  )

  db.delete(activeDraftBids)
    .where(and(eq(activeDraftBids.eventId, event.id), eq(activeDraftBids.id, bid.id)))
    .run()
  db.update(events)
    .set({ nextPickTeamId, updatedAt: new Date().toISOString() })
    .where(eq(events.id, event.id))
    .run()

  return result
}

function nextPickTeamAfterBidResolution(bid: ReturnType<typeof getActiveBid>) {
  return bid.currentBonus > 0 ? bid.highestTeamId : bid.nextTeamId
}

export async function resetDraftPick(eventId: string, pickId: string) {
  const pick = db
    .select()
    .from(draftPicks)
    .where(and(eq(draftPicks.eventId, eventId), eq(draftPicks.id, pickId)))
    .get()
  if (!pick) throw new Error('Draft pick not found.')

  const player = db
    .select()
    .from(eventParticipants)
    .where(
      and(
        eq(eventParticipants.eventId, eventId),
        eq(eventParticipants.discordId, pick.playerDiscordId),
      ),
    )
    .get()

  db.delete(draftPicks)
    .where(and(eq(draftPicks.eventId, eventId), eq(draftPicks.id, pickId)))
    .run()

  db.update(events).set({ updatedAt: new Date().toISOString() }).where(eq(events.id, eventId)).run()

  return { player: getParticipantName(pick.playerDiscordId) ?? player?.name ?? pick.playerDiscordId }
}

export async function cancelActiveDraftBid(eventId: string) {
  const bid = db
    .select()
    .from(activeDraftBids)
    .where(and(eq(activeDraftBids.eventId, eventId), eq(activeDraftBids.status, 'active')))
    .get()
  if (!bid) throw new Error('No active bid to cancel.')

  db.delete(activeDraftBids)
    .where(and(eq(activeDraftBids.eventId, eventId), eq(activeDraftBids.id, bid.id)))
    .run()
  db.update(events).set({ updatedAt: new Date().toISOString() }).where(eq(events.id, eventId)).run()

  return { ok: true }
}

function getActiveBid(eventId: string, bidId: string) {
  const bid = db
    .select()
    .from(activeDraftBids)
    .where(
      and(
        eq(activeDraftBids.eventId, eventId),
        eq(activeDraftBids.id, bidId),
        eq(activeDraftBids.status, 'active'),
      ),
    )
    .get()
  if (!bid) throw new Error('Active bid not found.')
  return bid
}

export async function setRatingDisqualified(
  eventId: string,
  fromDiscordId: string,
  toDiscordId: string,
  disqualified: boolean,
) {
  db.update(ratings)
    .set({ disqualified, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(ratings.eventId, eventId),
        eq(ratings.fromDiscordId, fromDiscordId),
        eq(ratings.toDiscordId, toDiscordId),
      ),
    )
    .run()

  return { ok: true }
}

export async function resetRatingsFromPlayer(eventId: string, fromDiscordId: string) {
  const rater = db
    .select()
    .from(eventParticipants)
    .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.discordId, fromDiscordId)))
    .get()
  if (!rater) throw new Error('Participant not found for this event.')

  const submittedRatings = db
    .select()
    .from(ratings)
    .where(and(eq(ratings.eventId, eventId), eq(ratings.fromDiscordId, fromDiscordId)))
    .all()

  db.delete(ratings)
    .where(and(eq(ratings.eventId, eventId), eq(ratings.fromDiscordId, fromDiscordId)))
    .run()

  return {
    ok: true,
    player: rater.name,
    count: submittedRatings.length,
  }
}

export async function saveRating(
  event: HammaEvent,
  fromDiscordId: string,
  toDiscordId: string,
  score: number,
) {
  if (fromDiscordId === toDiscordId) throw new Error('You cannot rate yourself.')
  if (!event.players.some((player) => player.id === toDiscordId)) throw new Error('Player is not active for this event.')
  if (isCaptainPlayer(event, toDiscordId)) throw new Error('Captains cannot be rated.')
  if (score < 1 || score > 10) throw new Error('Rating must be between 1 and 10.')

  db.insert(ratings)
    .values({
      eventId: event.id,
      fromDiscordId,
      toDiscordId,
      score,
      updatedAt: new Date().toISOString(),
    })
    .onConflictDoUpdate({
      target: [ratings.eventId, ratings.fromDiscordId, ratings.toDiscordId],
      set: { score, updatedAt: new Date().toISOString() },
    })
    .run()

  return { ok: true }
}

export function getRatingsByRater(eventId: string, fromDiscordId: string) {
  return db
    .select()
    .from(ratings)
    .where(
      and(
        eq(ratings.eventId, eventId),
        eq(ratings.fromDiscordId, fromDiscordId),
        eq(ratings.disqualified, false),
      ),
    )
    .all()
    .map((rating) => ({
      toDiscordId: rating.toDiscordId,
      score: rating.score,
    }))
}

export function isEventParticipant(eventId: string, discordId: string) {
  return Boolean(
    db
      .select()
      .from(eventParticipants)
      .where(
        and(
          eq(eventParticipants.eventId, eventId),
          eq(eventParticipants.discordId, discordId),
          eq(eventParticipants.disqualified, false),
        ),
      )
      .get(),
  )
}

export function isParticipantInAnyEvent(discordId: string) {
  return Boolean(
    db
      .select()
      .from(participants)
      .where(eq(participants.discordId, discordId))
      .get(),
  )
}

export function getRegisteredPlayerList(): RegisteredParticipant[] {
  return getRegisteredParticipants()
}

export function getAdminPlayerCharacterConfigs(): AdminPlayerCharacterConfig[] {
  return getRegisteredPlayerList().map((player) => {
    const profile = db.select().from(playerProfiles).where(eq(playerProfiles.discordId, player.discordId)).get()

    return {
      discordId: player.discordId,
      name: player.name,
      noPersonalJaegerAccount: Boolean(profile?.noPersonalJaegerAccount),
      characters: getPlayerCharacters(player.discordId),
    }
  })
}

export function renameParticipant(discordId: string, name: string) {
  const normalizedId = discordId.trim()
  const normalizedName = name.trim().slice(0, 80)
  if (!normalizedId) throw new Error('Player is required.')
  if (!normalizedName) throw new Error('Player name is required.')

  const participant = db.select().from(participants).where(eq(participants.discordId, normalizedId)).get()
  if (!participant) throw new Error('Player not found.')

  const now = new Date().toISOString()
  db.update(participants)
    .set({
      name: normalizedName,
      nameOverridden: true,
      updatedAt: now,
    })
    .where(eq(participants.discordId, normalizedId))
    .run()

  db.update(eventParticipants)
    .set({
      name: normalizedName,
      updatedAt: now,
    })
    .where(eq(eventParticipants.discordId, normalizedId))
    .run()

  return getRegisteredPlayerList()
}

export function upsertParticipantProfileIdentity(discordId: string, name: string, avatarUrl?: string | null) {
  const now = new Date().toISOString()
  const normalizedId = discordId.trim()
  const normalizedName = name.trim() || normalizedId
  if (!normalizedId) throw new Error('Discord ID is required.')
  const existing = db.select().from(participants).where(eq(participants.discordId, normalizedId)).get()
  const displayName = existing?.nameOverridden ? existing.name : normalizedName

  db.insert(participants)
    .values({
      discordId: normalizedId,
      name: displayName,
      avatarUrl: avatarUrl ?? undefined,
      nameOverridden: existing?.nameOverridden ?? false,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: participants.discordId,
      set: {
        name: displayName,
        avatarUrl: avatarUrl ?? undefined,
        updatedAt: now,
      },
    })
    .run()

  db.insert(playerProfiles)
    .values({
      discordId: normalizedId,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: playerProfiles.discordId,
      set: { updatedAt: now },
    })
    .run()
}

export function hasCompletePlayerCharacters(discordId: string) {
  const profile = db.select().from(playerProfiles).where(eq(playerProfiles.discordId, discordId)).get()
  if (profile?.noPersonalJaegerAccount) return true

  const factions = new Set(
    db
      .select()
      .from(playerCharacters)
      .where(eq(playerCharacters.discordId, discordId))
      .all()
      .map((character) => character.faction),
  )
  return factions.has('TR') && factions.has('VS') && factions.has('NC')
}

export function getPlayerSettings(discordId: string) {
  ensurePlayerProfile(discordId)
  const participant = db.select().from(participants).where(eq(participants.discordId, discordId)).get()
  const profile = db.select().from(playerProfiles).where(eq(playerProfiles.discordId, discordId)).get()
  const badges = getPlayerBadges(discordId)

  return {
    discordId,
    name: participant?.name ?? discordId,
    avatarUrl: participant?.avatarUrl ?? undefined,
    bannerUrl: normalizeProfileBanner(profile?.bannerUrl),
    catchphrase: profile?.catchphrase ?? '',
    noPersonalJaegerAccount: Boolean(profile?.noPersonalJaegerAccount),
    characters: getPlayerCharacters(discordId),
    badges,
    badgeDisplayOrder: getVisibleBadges(badges, profile?.badgeDisplayOrder).map((badge) => badge.id),
    complete: hasCompletePlayerCharacters(discordId),
  }
}

export function updatePlayerProfile(
  discordId: string,
  values: {
    bannerUrl?: string
    catchphrase?: string
    noPersonalJaegerAccount?: boolean
    badgeDisplayOrder?: string[]
  },
) {
  ensurePlayerProfile(discordId)
  const now = new Date().toISOString()
  const current = db.select().from(playerProfiles).where(eq(playerProfiles.discordId, discordId)).get()
  const bannerUrl =
    values.bannerUrl === undefined
      ? normalizeProfileBanner(current?.bannerUrl) || null
      : normalizeProfileBanner(values.bannerUrl) || null
  const catchphrase =
    values.catchphrase === undefined
      ? current?.catchphrase ?? null
      : normalizeOptionalText(values.catchphrase, 140)
  const noPersonalJaegerAccount =
    values.noPersonalJaegerAccount === undefined
      ? Boolean(current?.noPersonalJaegerAccount)
      : Boolean(values.noPersonalJaegerAccount)
  const badgeDisplayOrder =
    values.badgeDisplayOrder === undefined
      ? current?.badgeDisplayOrder ?? null
      : JSON.stringify(normalizeBadgeDisplayPreferences(discordId, values.badgeDisplayOrder))

  db.update(playerProfiles)
    .set({
      bannerUrl,
      catchphrase,
      noPersonalJaegerAccount,
      badgeDisplayOrder,
      updatedAt: now,
    })
    .where(eq(playerProfiles.discordId, discordId))
    .run()

  return getPlayerSettings(discordId)
}

export function savePlayerCharacters(discordId: string, characters: PlayerCharacter[]) {
  const now = new Date().toISOString()
  const seen = new Set<Faction>()
  ensurePlayerProfile(discordId)

  db.update(playerProfiles)
    .set({
      noPersonalJaegerAccount: false,
      updatedAt: now,
    })
    .where(eq(playerProfiles.discordId, discordId))
    .run()

  for (const character of characters) {
    if (seen.has(character.faction)) throw new Error(`Duplicate ${character.faction} character.`)
    seen.add(character.faction)
    db.insert(playerCharacters)
      .values({
        discordId,
        faction: character.faction,
        characterId: character.characterId,
        characterName: character.characterName,
        resolvedAt: now,
      })
      .onConflictDoUpdate({
        target: [playerCharacters.discordId, playerCharacters.faction],
        set: {
          characterId: character.characterId,
          characterName: character.characterName,
          resolvedAt: now,
        },
      })
      .run()
  }

  return getPlayerSettings(discordId)
}

export function getEventPlayerCharacterAssignments(eventId: string): EventPlayerCharacterAssignment[] {
  const rows = sqlite.prepare(`
    SELECT
      ep.event_id AS eventId,
      ep.discord_id AS discordId,
      COALESCE(p.name, ep.name, ep.discord_id) AS playerName,
      COALESCE(pp.no_personal_jaeger_account, 0) AS noPersonalJaegerAccount,
      ec.faction AS faction,
      ec.character_id AS characterId,
      ec.character_name AS characterName,
      ec.assigned_at AS assignedAt
    FROM event_participants ep
    JOIN player_profiles pp ON pp.discord_id = ep.discord_id
    LEFT JOIN participants p ON p.discord_id = ep.discord_id
    LEFT JOIN event_player_characters ec
      ON ec.event_id = ep.event_id AND ec.discord_id = ep.discord_id
    WHERE ep.event_id = ? AND pp.no_personal_jaeger_account = 1 AND ep.disqualified = 0
    ORDER BY playerName COLLATE NOCASE
  `).all(eventId) as Array<{
    eventId: string
    discordId: string
    playerName: string
    noPersonalJaegerAccount: number
    faction: string | null
    characterId: string | null
    characterName: string | null
    assignedAt: string | null
  }>

  return rows.map((row) => ({
    eventId: row.eventId,
    discordId: row.discordId,
    playerName: row.playerName,
    noPersonalJaegerAccount: Boolean(row.noPersonalJaegerAccount),
    assignment: row.faction && row.characterId && row.characterName && row.assignedAt
      ? {
          faction: normalizeRequiredFaction(row.faction),
          characterId: row.characterId,
          characterName: row.characterName,
          resolvedAt: row.assignedAt,
        }
      : undefined,
  }))
}

export function saveEventPlayerCharacterAssignment(
  eventId: string,
  discordId: string,
  character: PlayerCharacter,
) {
  const participant = db
    .select()
    .from(eventParticipants)
    .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.discordId, discordId)))
    .get()
  if (!participant || participant.disqualified) {
    throw new Error('Player must be an active signup for this event.')
  }

  const profile = db.select().from(playerProfiles).where(eq(playerProfiles.discordId, discordId)).get()
  if (!profile?.noPersonalJaegerAccount) {
    throw new Error('Player has not marked that they need an assigned Jaeger character.')
  }

  const assignedAt = new Date().toISOString()
  db.insert(eventPlayerCharacters)
    .values({
      eventId,
      discordId,
      faction: character.faction,
      characterId: character.characterId,
      characterName: character.characterName,
      assignedAt,
    })
    .onConflictDoUpdate({
      target: [eventPlayerCharacters.eventId, eventPlayerCharacters.discordId],
      set: {
        faction: character.faction,
        characterId: character.characterId,
        characterName: character.characterName,
        assignedAt,
      },
    })
    .run()

  return getEventPlayerCharacterAssignments(eventId)
}

export function searchPlayerProfiles(query = ''): PlayerProfileSummary[] {
  const normalized = query.trim().toLowerCase()
  const rows = sqlite.prepare(`
    SELECT
      p.discord_id AS discordId,
      p.name AS name,
      p.avatar_url AS avatarUrl,
      pp.catchphrase AS catchphrase,
      pp.badge_display_order AS badgeDisplayOrder,
      COALESCE(events.eventCount, 0) AS eventCount,
      COALESCE(wins.winCount, 0) AS winCount,
      ratings.averageRating AS averageRating,
      COALESCE(characters.characterCount, 0) AS characterCount
    FROM participants p
    LEFT JOIN player_profiles pp ON pp.discord_id = p.discord_id
    LEFT JOIN (
      SELECT discord_id, COUNT(*) AS eventCount
      FROM event_participants
      WHERE disqualified = 0
      GROUP BY discord_id
    ) events ON events.discord_id = p.discord_id
    LEFT JOIN (
      SELECT discord_id, COUNT(*) AS winCount
      FROM event_participants
      WHERE winner = 1 AND disqualified = 0
      GROUP BY discord_id
    ) wins ON wins.discord_id = p.discord_id
    LEFT JOIN (
      SELECT to_discord_id AS discord_id, AVG(score) AS averageRating
      FROM ratings
      WHERE disqualified = 0 AND from_discord_id != to_discord_id
      GROUP BY to_discord_id
    ) ratings ON ratings.discord_id = p.discord_id
    LEFT JOIN (
      SELECT discord_id, COUNT(*) AS characterCount
      FROM player_characters
      GROUP BY discord_id
    ) characters ON characters.discord_id = p.discord_id
    WHERE ? = '' OR LOWER(p.name) LIKE ? OR LOWER(COALESCE(pp.catchphrase, '')) LIKE ?
    ORDER BY p.name COLLATE NOCASE
    LIMIT 200
  `).all(normalized, `%${normalized}%`, `%${normalized}%`) as Array<{
    discordId: string
    name: string
    avatarUrl: string | null
    catchphrase: string | null
    badgeDisplayOrder: string | null
    eventCount: number
    winCount: number
    averageRating: number | null
    characterCount: number
  }>

  return rows.map((row) => {
    const badges = getPlayerBadges(row.discordId)

    return {
      discordId: row.discordId,
      name: row.name,
      avatarUrl: row.avatarUrl ?? undefined,
      catchphrase: row.catchphrase ?? undefined,
      eventCount: Number(row.eventCount),
      winCount: Number(row.winCount),
      averageRating: row.averageRating === null ? null : Number(row.averageRating),
      characterCount: Number(row.characterCount),
      badges: getVisibleBadges(badges, row.badgeDisplayOrder).slice(0, 3),
    }
  })
}

export function getPlayerProfile(discordId: string): PlayerProfile | null {
  const participant = db.select().from(participants).where(eq(participants.discordId, discordId)).get()
  if (!participant) return null
  const profile = db.select().from(playerProfiles).where(eq(playerProfiles.discordId, discordId)).get()
  const history = getRatingHistory(discordId)
  const hammaStats = getHammaCombatStats(discordId)
  const badges = getPlayerBadges(discordId)
  const averageRating = history.length
    ? history.reduce((sum, item) => sum + item.averageRating, 0) / history.length
    : null

  return {
    discordId,
    name: participant.name,
    avatarUrl: participant.avatarUrl ?? undefined,
    bannerUrl: normalizeProfileBanner(profile?.bannerUrl) || undefined,
    catchphrase: profile?.catchphrase ?? undefined,
    characters: getPlayerCharacters(discordId),
    stats: {
      events: countPlayerEvents(discordId),
      wins: countPlayerWins(discordId),
      averageRating,
      killsOnHamma: hammaStats.killsOnHamma,
      deathsToHamma: hammaStats.deathsToHamma,
      ratingHistory: history,
    },
    badges: getVisibleBadges(badges, profile?.badgeDisplayOrder),
  }
}

export function getAdminBadgeManagerData(): AdminBadgeManagerData {
  const badges = db
    .select()
    .from(badgeDefinitions)
    .all()
    .map((badge) => ({
      id: badge.id,
      name: badge.name,
      description: badge.description,
      color: normalizeBadgeColor(badge.color),
      source: badge.source === 'automatic' ? 'automatic' as const : 'manual' as const,
      createdAt: badge.createdAt,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const players = db
    .select()
    .from(participants)
    .all()
    .map((participant) => ({
      discordId: participant.discordId,
      name: participant.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const assignments = sqlite.prepare(`
    SELECT
      pba.badge_id AS badgeId,
      pba.discord_id AS discordId,
      COALESCE(p.name, pba.discord_id) AS playerName,
      bd.name AS badgeName,
      pba.assigned_at AS assignedAt
    FROM player_badge_assignments pba
    JOIN badge_definitions bd ON bd.id = pba.badge_id
    LEFT JOIN participants p ON p.discord_id = pba.discord_id
    ORDER BY bd.name COLLATE NOCASE, playerName COLLATE NOCASE
  `).all() as AdminBadgeManagerData['assignments']

  return { badges, players, assignments }
}

export function createManualBadge(values: { name: string; description: string; color?: string }) {
  const name = values.name.trim().slice(0, 48)
  const description = values.description.trim().slice(0, 160)
  const color = normalizeBadgeColor(values.color)
  if (!name) throw new Error('Badge name is required.')
  if (!description) throw new Error('Badge description is required.')

  db.insert(badgeDefinitions)
    .values({
      id: `manual-${randomUUID()}`,
      name,
      description,
      color,
      source: 'manual',
      createdAt: new Date().toISOString(),
    })
    .run()

  return getAdminBadgeManagerData()
}

export function updateManualBadgeColor(badgeId: string, color: string) {
  const badge = db.select().from(badgeDefinitions).where(eq(badgeDefinitions.id, badgeId)).get()
  if (!badge) throw new Error('Badge not found.')
  if (badge.source !== 'manual') throw new Error('Only manual badges can be configured here.')

  db.update(badgeDefinitions)
    .set({ color: normalizeBadgeColor(color) })
    .where(eq(badgeDefinitions.id, badgeId))
    .run()

  return getAdminBadgeManagerData()
}

export function assignManualBadge(badgeId: string, discordId: string) {
  const badge = db.select().from(badgeDefinitions).where(eq(badgeDefinitions.id, badgeId)).get()
  if (!badge) throw new Error('Badge not found.')
  if (badge.source !== 'manual') throw new Error('Only manual badges can be assigned here.')
  const participant = db.select().from(participants).where(eq(participants.discordId, discordId)).get()
  if (!participant) throw new Error('Player not found.')

  db.insert(playerBadgeAssignments)
    .values({
      badgeId,
      discordId,
      assignedAt: new Date().toISOString(),
    })
    .onConflictDoNothing()
    .run()

  return getAdminBadgeManagerData()
}

export function unassignManualBadge(badgeId: string, discordId: string) {
  db.delete(playerBadgeAssignments)
    .where(and(eq(playerBadgeAssignments.badgeId, badgeId), eq(playerBadgeAssignments.discordId, discordId)))
    .run()

  return getAdminBadgeManagerData()
}

export function getAdminPlayerProfileEditorData(discordId: string): AdminPlayerProfileEditorData {
  const normalizedId = discordId.trim()
  const participant = db.select().from(participants).where(eq(participants.discordId, normalizedId)).get()
  if (!participant) throw new Error('Player not found.')

  const badges = db
    .select()
    .from(badgeDefinitions)
    .all()
    .map((badge) => ({
      id: badge.id,
      name: badge.name,
      description: badge.description,
      color: normalizeBadgeColor(badge.color),
      source: badge.source === 'automatic' ? 'automatic' as const : 'manual' as const,
      createdAt: badge.createdAt,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const assignedBadgeIds = db
    .select()
    .from(playerBadgeAssignments)
    .where(eq(playerBadgeAssignments.discordId, normalizedId))
    .all()
    .map((assignment) => assignment.badgeId)

  const profile = db.select().from(playerProfiles).where(eq(playerProfiles.discordId, normalizedId)).get()
  const playerBadges = getPlayerBadges(normalizedId)

  return {
    player: {
      discordId: participant.discordId,
      name: participant.name,
    },
    catchphrase: profile?.catchphrase ?? '',
    badges,
    assignedBadgeIds,
    visibleBadges: getVisibleBadges(playerBadges, profile?.badgeDisplayOrder),
  }
}

export function assignPlayerManualBadge(discordId: string, badgeId: string) {
  assignManualBadge(badgeId, discordId)
  return getAdminPlayerProfileEditorData(discordId)
}

export function unassignPlayerManualBadge(discordId: string, badgeId: string) {
  unassignManualBadge(badgeId, discordId)
  return getAdminPlayerProfileEditorData(discordId)
}

export function resetPlayerCatchphrase(discordId: string) {
  updatePlayerProfile(discordId, { catchphrase: '' })
  return getAdminPlayerProfileEditorData(discordId)
}

function upsertParticipant(discordId: string, name: string, updatedAt = new Date().toISOString()) {
  const normalizedId = discordId.trim()
  if (!normalizedId) throw new Error('Discord ID is required.')
  const normalizedName = name.trim() || normalizedId
  const existing = db.select().from(participants).where(eq(participants.discordId, normalizedId)).get()
  const displayName = existing?.nameOverridden ? existing.name : normalizedName

  db.insert(participants)
    .values({
      discordId: normalizedId,
      name: displayName,
      nameOverridden: existing?.nameOverridden ?? false,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: participants.discordId,
      set: {
        name: displayName,
        updatedAt,
      },
    })
    .run()
}

function ensureEventParticipant(eventId: string, discordId: string, name: string, updatedAt = new Date().toISOString()) {
  upsertParticipant(discordId, name, updatedAt)
  db.insert(eventParticipants)
    .values({
      eventId,
      discordId,
      name: name.trim() || discordId,
      status: 'signed_up',
      updatedAt,
    })
    .onConflictDoUpdate({
      target: [eventParticipants.eventId, eventParticipants.discordId],
      set: {
        name: name.trim() || discordId,
        updatedAt,
      },
    })
    .run()
}

function getParticipantNameMap(discordIds: string[]) {
  const wanted = new Set(discordIds)
  return new Map(
    db
      .select()
      .from(participants)
      .all()
      .filter((participant) => wanted.has(participant.discordId))
      .map((participant) => [participant.discordId, participant.name]),
  )
}

function getParticipantName(discordId: string) {
  return db
    .select()
    .from(participants)
    .where(eq(participants.discordId, discordId))
    .get()?.name
}

function ensurePlayerProfile(discordId: string) {
  const now = new Date().toISOString()
  db.insert(playerProfiles)
    .values({ discordId, updatedAt: now })
    .onConflictDoNothing()
    .run()
}

function getPlayerCharacters(discordId: string): PlayerCharacter[] {
  return db
    .select()
    .from(playerCharacters)
    .where(eq(playerCharacters.discordId, discordId))
    .all()
    .map((character) => ({
      faction: normalizeRequiredFaction(character.faction),
      characterId: character.characterId,
      characterName: character.characterName,
      resolvedAt: character.resolvedAt,
    }))
    .sort((a, b) => factionOrder(a.faction) - factionOrder(b.faction))
}

function getRatingHistory(discordId: string): PlayerProfile['stats']['ratingHistory'] {
  const rows = sqlite.prepare(`
    SELECT
      e.id AS eventId,
      COALESCE(e.name_override, e.name) AS eventName,
      e.starts_at AS startsAt,
      AVG(r.score) AS averageRating
    FROM ratings r
    JOIN events e ON e.id = r.event_id
    JOIN event_participants ep ON ep.event_id = r.event_id AND ep.discord_id = r.to_discord_id
    WHERE r.to_discord_id = ? AND r.from_discord_id != ? AND r.disqualified = 0
      AND ep.disqualified = 0
    GROUP BY e.id
    ORDER BY e.starts_at ASC
  `).all(discordId, discordId) as Array<{
    eventId: string
    eventName: string
    startsAt: string
    averageRating: number
  }>

  return rows.map((row) => ({
    eventId: row.eventId,
    eventName: row.eventName,
    startsAt: row.startsAt,
    averageRating: Number(row.averageRating),
  }))
}

function countPlayerEvents(discordId: string) {
  const row = sqlite
    .prepare('SELECT COUNT(*) AS count FROM event_participants WHERE discord_id = ? AND disqualified = 0')
    .get(discordId) as { count: number } | undefined
  return Number(row?.count ?? 0)
}

function countPlayerWins(discordId: string) {
  const row = sqlite
    .prepare('SELECT COUNT(*) AS count FROM event_participants WHERE discord_id = ? AND winner = 1 AND disqualified = 0')
    .get(discordId) as { count: number } | undefined
  return Number(row?.count ?? 0)
}

export function upsertPlayerEventStats(
  eventId: string,
  discordId: string,
  values: {
    killsOnHamma?: number
    deathsToHamma?: number
  },
) {
  const now = new Date().toISOString()
  db.insert(playerEventStats)
    .values({
      eventId,
      discordId,
      killsOnHamma: Math.max(0, Math.trunc(values.killsOnHamma ?? 0)),
      deathsToHamma: Math.max(0, Math.trunc(values.deathsToHamma ?? 0)),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [playerEventStats.eventId, playerEventStats.discordId],
      set: {
        killsOnHamma: Math.max(0, Math.trunc(values.killsOnHamma ?? 0)),
        deathsToHamma: Math.max(0, Math.trunc(values.deathsToHamma ?? 0)),
        updatedAt: now,
      },
    })
    .run()
}

function getHammaCombatStats(discordId: string) {
  const row = sqlite.prepare(`
    SELECT
      COALESCE(SUM(kills_on_hamma), 0) AS killsOnHamma,
      COALESCE(SUM(deaths_to_hamma), 0) AS deathsToHamma
    FROM player_event_stats
    WHERE discord_id = ?
  `).get(discordId) as { killsOnHamma: number; deathsToHamma: number } | undefined

  return {
    killsOnHamma: Number(row?.killsOnHamma ?? 0),
    deathsToHamma: Number(row?.deathsToHamma ?? 0),
  }
}

function getPlayerBadges(discordId: string): PlayerBadge[] {
  const badges: PlayerBadge[] = getManualPlayerBadges(discordId)
  const bigSpend = sqlite.prepare(`
    SELECT 1
    FROM draft_picks dp
    JOIN teams t ON t.id = dp.team_id
    WHERE t.captain_discord_id = ? AND dp.bonus_spent >= t.bonus_cap * 0.6 AND t.bonus_cap > 0
    LIMIT 1
  `).get(discordId)
  const taxCollector = sqlite.prepare(`
    SELECT 1
    FROM draft_picks dp
    JOIN teams t ON t.id = dp.team_id
    WHERE dp.player_discord_id = ? AND dp.bonus_spent >= t.bonus_cap * 0.4 AND t.bonus_cap > 0
    LIMIT 1
  `).get(discordId)

  if (bigSpend) {
    badges.push({
      id: 'big-spender',
      name: 'BIG SPENDER',
      description: 'Captain spent most of a bonus cap on one player.',
      color: '#f0b46b',
      source: 'automatic',
    })
  }
  if (taxCollector) {
    badges.push({
      id: 'tax-collector',
      name: 'Tax Collector',
      description: 'Earned an outsized draft bonus.',
      color: '#7dc7c4',
      source: 'automatic',
    })
  }
  return badges
}

function getManualPlayerBadges(discordId: string): PlayerBadge[] {
  const rows = sqlite.prepare(`
    SELECT
      bd.id AS id,
      bd.name AS name,
      bd.description AS description,
      bd.color AS color,
      bd.source AS source
    FROM player_badge_assignments pba
    JOIN badge_definitions bd ON bd.id = pba.badge_id
    WHERE pba.discord_id = ?
    ORDER BY bd.name COLLATE NOCASE
  `).all(discordId) as Array<{
    id: string
    name: string
    description: string
    color: string | null
    source: string
  }>

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    color: normalizeBadgeColor(row.color),
    source: row.source === 'automatic' ? 'automatic' : 'manual',
  }))
}

function normalizeBadgeDisplayPreferences(discordId: string, badgeIds: string[]) {
  const earnedBadges = getPlayerBadges(discordId)
  const earned = new Set(earnedBadges.map((badge) => badge.id))
  const seen = new Set<string>()
  const order = badgeIds
    .map((badgeId) => badgeId.trim())
    .filter((badgeId) => earned.has(badgeId) && !seen.has(badgeId) && seen.add(badgeId))

  return {
    order,
    hidden: earnedBadges.map((badge) => badge.id).filter((badgeId) => !seen.has(badgeId)),
  }
}

function normalizeLegacyBadgeOrder(badgeIds: string[], badges: PlayerBadge[]) {
  const badgeById = new Map(badges.map((badge) => [badge.id, badge]))
  return badgeIds
    .map((badgeId) => badgeId.trim())
    .flatMap((badgeId) => {
      const badge = badgeById.get(badgeId)
      if (!badge) return []
      badgeById.delete(badgeId)
      return [badge]
    })
}

function getVisibleBadges(badges: PlayerBadge[], persistedOrder?: string | null) {
  if (!persistedOrder) return badges

  let parsed: unknown
  try {
    parsed = JSON.parse(persistedOrder)
  } catch {
    return badges
  }

  if (Array.isArray(parsed)) {
    const badgeIds = parsed.filter((value): value is string => typeof value === 'string')
    return badgeIds.length ? normalizeLegacyBadgeOrder(badgeIds, badges) : badges
  }

  if (!parsed || typeof parsed !== 'object') return badges
  const order = 'order' in parsed && Array.isArray(parsed.order)
    ? parsed.order.filter((value): value is string => typeof value === 'string')
    : []
  const hidden = new Set(
    'hidden' in parsed && Array.isArray(parsed.hidden)
      ? parsed.hidden.filter((value): value is string => typeof value === 'string')
      : [],
  )
  const badgeById = new Map(badges.map((badge) => [badge.id, badge]))
  const ordered = normalizeLegacyBadgeOrder(order, badges).filter((badge) => !hidden.has(badge.id))
  const remaining = badges.filter((badge) => badgeById.has(badge.id) && !order.includes(badge.id) && !hidden.has(badge.id))
  return [...ordered, ...remaining]
}

function normalizeOptionalText(value: string | undefined, maxLength: number) {
  const trimmed = value?.trim() ?? ''
  return trimmed ? trimmed.slice(0, maxLength) : null
}

function normalizeBadgeColor(value?: string | null) {
  const color = String(value ?? '').trim()
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : '#e4b45e'
}

function normalizeRequiredFaction(value: string): Faction {
  const faction = normalizeFaction(value)
  if (!faction) throw new Error(`Invalid faction: ${value}`)
  return faction
}

function factionOrder(faction: Faction) {
  return faction === 'TR' ? 0 : faction === 'VS' ? 1 : 2
}

function bootstrap() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      raid_helper_event_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      name_override TEXT,
      server TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      closing_time TEXT,
      phase TEXT NOT NULL DEFAULT 'signups',
      salary_pool INTEGER NOT NULL DEFAULT ${SALARY_POOL},
      pending_signup_count INTEGER NOT NULL DEFAULT 0,
      available_factions TEXT NOT NULL DEFAULT '["VS","NC","TR"]',
      available_sides TEXT NOT NULL DEFAULT '["north","south"]',
      next_pick_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
      winning_team_id TEXT,
      twitch_stream_url TEXT,
      twitch_vod_url TEXT,
      lore TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS participants (
      discord_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar_url TEXT,
      name_overridden INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS player_profiles (
      discord_id TEXT PRIMARY KEY,
      banner_url TEXT,
      catchphrase TEXT,
      no_personal_jaeger_account INTEGER NOT NULL DEFAULT 0,
      badge_display_order TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS player_characters (
      discord_id TEXT NOT NULL,
      faction TEXT NOT NULL,
      character_id TEXT NOT NULL,
      character_name TEXT NOT NULL,
      resolved_at TEXT NOT NULL,
      PRIMARY KEY (discord_id, faction)
    );
    CREATE TABLE IF NOT EXISTS player_event_stats (
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      discord_id TEXT NOT NULL,
      kills_on_hamma INTEGER NOT NULL DEFAULT 0,
      deaths_to_hamma INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (event_id, discord_id)
    );
    CREATE TABLE IF NOT EXISTS event_player_characters (
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      discord_id TEXT NOT NULL,
      faction TEXT NOT NULL,
      character_id TEXT NOT NULL,
      character_name TEXT NOT NULL,
      assigned_at TEXT NOT NULL,
      PRIMARY KEY (event_id, discord_id)
    );
    CREATE TABLE IF NOT EXISTS badge_definitions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#e4b45e',
      source TEXT NOT NULL DEFAULT 'manual',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS player_badge_assignments (
      badge_id TEXT NOT NULL REFERENCES badge_definitions(id) ON DELETE CASCADE,
      discord_id TEXT NOT NULL,
      assigned_at TEXT NOT NULL,
      PRIMARY KEY (badge_id, discord_id)
    );
    CREATE TABLE IF NOT EXISTS event_participants (
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      discord_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'signed_up',
      disqualified INTEGER NOT NULL DEFAULT 0,
      winner INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (event_id, discord_id)
    );
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      captain_discord_id TEXT,
      faction TEXT,
      starting_side TEXT,
      budget INTEGER NOT NULL DEFAULT ${TEAM_BUDGET},
      bonus_cap INTEGER NOT NULL DEFAULT ${BONUS_CAP},
      score INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS ratings (
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      from_discord_id TEXT NOT NULL,
      to_discord_id TEXT NOT NULL,
      score REAL NOT NULL,
      disqualified INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (event_id, from_discord_id, to_discord_id)
    );
    CREATE TABLE IF NOT EXISTS draft_picks (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      player_discord_id TEXT NOT NULL,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      salary INTEGER NOT NULL DEFAULT 0,
      bonus_spent INTEGER NOT NULL DEFAULT 0,
      contested_by_team_id TEXT,
      confirmed_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS active_draft_bids (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      player_discord_id TEXT NOT NULL,
      opened_by_team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      highest_team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      next_team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      current_bonus INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS score_adjustments (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      delta INTEGER NOT NULL,
      reason TEXT,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS coinflips (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      calling_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
      caller_call TEXT,
      winning_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
      result TEXT,
      choice TEXT,
      winner_choice_type TEXT,
      winner_faction TEXT,
      winner_starting_side TEXT,
      first_pick_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT
    );
  `)
  addColumnIfMissing('events', 'name_override', 'TEXT')
  addColumnIfMissing('events', 'pending_signup_count', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing('events', 'available_factions', `TEXT NOT NULL DEFAULT '["VS","NC","TR"]'`)
  addColumnIfMissing('events', 'available_sides', `TEXT NOT NULL DEFAULT '["north","south"]'`)
  addColumnIfMissing('events', 'next_pick_team_id', 'TEXT REFERENCES teams(id) ON DELETE SET NULL')
  addColumnIfMissing('events', 'winning_team_id', 'TEXT')
  addColumnIfMissing('events', 'twitch_stream_url', 'TEXT')
  addColumnIfMissing('events', 'twitch_vod_url', 'TEXT')
  addColumnIfMissing('events', 'lore', 'TEXT')
  addColumnIfMissing('participants', 'avatar_url', 'TEXT')
  addColumnIfMissing('participants', 'name_overridden', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing('player_profiles', 'no_personal_jaeger_account', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing('player_profiles', 'badge_display_order', 'TEXT')
  addColumnIfMissing('badge_definitions', 'color', "TEXT NOT NULL DEFAULT '#e4b45e'")
  addColumnIfMissing('event_participants', 'winner', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing('coinflips', 'calling_team_id', 'TEXT REFERENCES teams(id) ON DELETE SET NULL')
  addColumnIfMissing('coinflips', 'caller_call', 'TEXT')
  addColumnIfMissing('coinflips', 'winner_choice_type', 'TEXT')
  addColumnIfMissing('coinflips', 'winner_faction', 'TEXT')
  addColumnIfMissing('coinflips', 'winner_starting_side', 'TEXT')
  addColumnIfMissing('coinflips', 'first_pick_team_id', 'TEXT REFERENCES teams(id) ON DELETE SET NULL')
  addColumnIfMissing('coinflips', 'updated_at', 'TEXT')
  sqlite.exec(`
    INSERT INTO participants (discord_id, name, updated_at)
    SELECT discord_id, name, MAX(updated_at)
    FROM event_participants
    GROUP BY discord_id
    ON CONFLICT(discord_id) DO UPDATE SET
      name = excluded.name,
      updated_at = excluded.updated_at
      WHERE participants.name_overridden = 0;
  `)
}

function addColumnIfMissing(table: string, column: string, definition: string) {
  const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  if (columns.some((existing) => existing.name === column)) return
  sqlite.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run()
}

function normalizeFaction(value: string | null): Faction | undefined {
  return value === 'VS' || value === 'NC' || value === 'TR' ? value : undefined
}

function normalizeStartingSide(value: string | null): StartingSide | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function normalizeCoinSide(value: string | null) {
  return value === 'heads' || value === 'tails' ? value : undefined
}

function normalizeRequiredCoinSide(value: string) {
  const side = normalizeCoinSide(value)
  if (!side) throw new Error('Choose heads or tails.')
  return side
}

function normalizeChoiceType(value: string | null) {
  return value === 'faction' || value === 'side' ? value : undefined
}

function parseAvailableFactions(value: string | null | undefined): Faction[] {
  if (!value) return ['VS', 'NC', 'TR']
  try {
    return normalizeFactionList(JSON.parse(value))
  } catch {
    return ['VS', 'NC', 'TR']
  }
}

function parseAvailableSides(value: string | null | undefined): StartingSide[] {
  if (!value) return ['north', 'south']
  try {
    return normalizeSideList(JSON.parse(value))
  } catch {
    return ['north', 'south']
  }
}

function normalizeFactionList(values: unknown): Faction[] {
  if (!Array.isArray(values)) return ['VS', 'NC', 'TR']
  const factions = values
    .map((value) => normalizeFaction(String(value)))
    .filter((value): value is Faction => Boolean(value))
  return Array.from(new Set(factions))
}

function normalizeSideList(values: unknown): StartingSide[] {
  if (!Array.isArray(values)) return ['north', 'south']
  const sides = values
    .map((value) => normalizeStartingSide(String(value)))
    .filter((value): value is StartingSide => Boolean(value))
  return Array.from(new Set(sides))
}

function normalizeOptionalTwitchUrl(value: string | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return null

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error('Twitch links must be valid URLs.')
  }

  const hostname = url.hostname.toLowerCase()
  if (
    url.protocol !== 'https:' ||
    (hostname !== 'twitch.tv' && !hostname.endsWith('.twitch.tv'))
  ) {
    throw new Error('Twitch links must use twitch.tv HTTPS URLs.')
  }

  return url.toString()
}

function formatSide(value: StartingSide) {
  return value
}

function hasDuplicates(values: string[]) {
  return new Set(values).size !== values.length
}

function coinflipSummary(row: {
  id: string
  callingTeamId?: string | null
  callerCall?: string | null
  result?: string | null
  winningTeamId?: string | null
}) {
  return {
    id: row.id,
    callingCaptainId: row.callingTeamId ?? '',
    call: normalizeCoinSide(row.callerCall ?? null),
    result: normalizeCoinSide(row.result ?? null),
    winningCaptainId: row.winningTeamId ?? undefined,
  }
}
