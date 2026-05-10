import '@tanstack/react-start/server-only'

import fs from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import Database from 'better-sqlite3'
import { and, desc, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { discordTimestamp } from './discordFormatting'
import { env, envList } from './env'
import { cleanupOrphanedGroupLogoUploads, persistGroupLogoReference } from './groupLogoStorage.server'
import { HONU_DEFAULT_ZONE_ID, normalizeHonuZoneId } from './honu'
import { normalizeProfileBanner } from './profileBanners'
import {
  activeDraftBids,
  appSettings,
  badgeDefinitions,
  coinflips,
  draftPicks,
  eventAvailableFactions,
  eventAvailableSides,
  eventAvailableSpecs,
  eventLinks,
  eventRoundScores,
  eventRounds,
  eventPlayerCharacters,
  eventParticipantSpecs,
  eventParticipants,
  eventSignupOverrides,
  events,
  groupAdministrators,
  groupMembers,
  groups,
  playerCharacters,
  playerBadgeAssignments,
  participantRoleIds,
  playerBadgeDisplayPreferences,
  playerEventStats,
  playerProfiles,
  participants,
  ratings,
  scoreAdjustments,
  teams,
} from './schema'
import {
  BID_INCREMENT,
  BONUS_CAP,
  BONUS_POOL,
  MAX_PLAYER_BONUS,
  SALARY_POOL,
  TEAM_BUDGET,
  acquisitionCost,
  buildTeamLedgers,
  calculatePlayerSalaries,
  canAcquirePlayer,
  getDraftReadiness,
  isDraftAdjustmentPhase,
  isCaptainPlayer,
  oppositeTeamId,
  reachAwardWinner,
  salaryBudgetAdvantageWinner,
  buildDraftAdjustment,
  getCheckInWindow,
} from './rules'
import type {
  AdminBadgeManagerData,
  AdminSignupManagerData,
  AdminPlayerProfileEditorData,
  AdminPlayerCharacterConfig,
  Team,
  DraftPick,
  EventPlayerCharacterAssignment,
  EventLink,
  EventTrophyId,
  Faction,
  GroupDetail,
  GroupMembershipStatus,
  GroupSummary,
  HammaEvent,
  HistoricalEvent,
  Player,
  PlayerBadge,
  PlayerCharacter,
  HonuPsbAccountSuggestion,
  PlayerProfile,
  PlayerProfileSummary,
  Rating,
  RegisteredParticipant,
  Role,
  StartingSide,
} from './types'

const dbPath = env('DATABASE_URL', path.join(process.cwd(), 'data', 'hammabowl.sqlite'))
const ACTIVE_EVENT_SETTING_KEY = 'active_event_id'
const DISCORD_ROLE_REFRESHED_AT_SETTING_KEY = 'discord_role_refreshed_at'
const ADMIN_BADGE_ID = 'system-admin'
const MOD_BADGE_ID = 'system-mod'
const DEFAULT_GROUP_TAG_COLOR = '#47bf8f'
const GROUP_LOGO_CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000
const GROUP_LOGO_ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000
const SYSTEM_BADGES = [
  {
    id: ADMIN_BADGE_ID,
    name: 'Admin',
    description: 'HammaBowl administrator.',
    color: '#ef6461',
  },
  {
    id: MOD_BADGE_ID,
    name: 'Mod',
    description: 'HammaBowl moderator.',
    color: '#61a5ef',
  },
]
const EVENT_LINK_ICONS = new Set([
  'Link',
  'Globe',
  'Calendar',
  'Trophy',
  'Play',
  'MessageCircle',
  'FileText',
  'Map',
  'Siren',
  'Users',
  'ScrollText',
  'Video',
  'ChartColumnIncreasingIcon',
])
fs.mkdirSync(path.dirname(dbPath), { recursive: true })

const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite)

bootstrap()
ensureGroupLogoCleanupJob()

export async function upsertEventFromRaidHelper(event: HammaEvent) {
  const now = new Date().toISOString()
  const existingEvent = db
    .select()
    .from(events)
    .where(eq(events.raidHelperEventId, event.raidHelperEventId))
    .get()

  db.insert(events)
    .values({
      id: event.id,
      raidHelperEventId: event.raidHelperEventId,
      raidHelperChannelId: event.raidHelperChannelId,
      name: event.name,
      server: event.server,
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      closingTime: event.closingTime,
      draftStartMinutesBefore: event.draftStartMinutesBefore,
      roundCount: event.roundCount ?? 3,
      roundDurationSeconds: event.roundDurationSeconds ?? 900,
      phase: event.phase,
      salaryPool: event.salaryPool,
      bonusPool: event.bonusPool,
      maxPlayerBonus: event.maxPlayerBonus,
      bidIncrement: event.bidIncrement,
      pendingSignupCount: event.pendingPlayerCount ?? 0,
      trophyId: event.trophyId ?? 'hammo-bowl-cup',
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: events.raidHelperEventId,
      set: {
        name: event.name,
        raidHelperChannelId: event.raidHelperChannelId,
        startsAt: event.startsAt,
        endsAt: event.endsAt,
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
  if (!existingEvent) {
    replaceEventAvailableFactions(persistedEvent.id, event.availableFactions ?? ['VS', 'NC', 'TR'], now)
    replaceEventAvailableSides(persistedEvent.id, event.availableSides ?? ['north', 'south'], now)
  }
  replaceEventAvailableSpecs(persistedEvent.id, event.availableSpecs ?? [], now)

  const signupOverrides = getEventSignupOverrideMap(persistedEvent.id)
  const forcedAddedIds = new Set(
    Array.from(signupOverrides.entries()).flatMap(([discordId, action]) =>
      action === 'add' ? [discordId] : [],
    ),
  )
  const forcedRemovedIds = new Set(
    Array.from(signupOverrides.entries()).flatMap(([discordId, action]) =>
      action === 'remove' ? [discordId] : [],
    ),
  )
  const syncedPlayers = event.players.filter((player) => !forcedRemovedIds.has(player.id))
  const syncedPlayerIds = new Set(syncedPlayers.map((player) => player.id))
  const acceptedDiscordIds = new Set([...syncedPlayerIds, ...forcedAddedIds])
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
    db.delete(eventParticipantSpecs)
      .where(
        and(
          eq(eventParticipantSpecs.eventId, persistedEvent.id),
          eq(eventParticipantSpecs.discordId, participant.discordId),
        ),
      )
      .run()
  }

  for (const player of syncedPlayers) {
    const forceActive = forcedAddedIds.has(player.id)
    upsertParticipant(player.id, player.name, now)
    db.insert(eventParticipants)
      .values({
        eventId: persistedEvent.id,
        discordId: player.id,
        name: player.name,
        status: forceActive ? 'signed_up' : player.status,
        disqualified: forceActive ? false : player.status === 'disqualified',
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [eventParticipants.eventId, eventParticipants.discordId],
        set: {
          name: player.name,
          status: forceActive ? 'signed_up' : player.status,
          disqualified: forceActive ? false : player.status === 'disqualified',
          updatedAt: now,
        },
    })
      .run()
    replaceEventParticipantSpecs(persistedEvent.id, player.id, player.specs ?? [], now)
  }

  for (const discordId of forcedAddedIds) {
    if (syncedPlayerIds.has(discordId)) continue
    const participant = db
      .select()
      .from(participants)
      .where(eq(participants.discordId, discordId))
      .get()
    if (!participant) continue
    ensureEventParticipant(persistedEvent.id, discordId, participant.name, now)
  }

  return persistedEvent.id
}

function replaceEventParticipantSpecs(
  eventId: string,
  discordId: string,
  specs: string[],
  updatedAt: string,
) {
  db.delete(eventParticipantSpecs)
    .where(
      and(
        eq(eventParticipantSpecs.eventId, eventId),
        eq(eventParticipantSpecs.discordId, discordId),
      ),
    )
    .run()

  for (const [index, specName] of specs.entries()) {
    db.insert(eventParticipantSpecs)
      .values({
        eventId,
        discordId,
        specName,
        position: index + 1,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: [
          eventParticipantSpecs.eventId,
          eventParticipantSpecs.discordId,
          eventParticipantSpecs.specName,
        ],
        set: {
          position: index + 1,
          updatedAt,
        },
      })
      .run()
  }
}

function groupEventParticipantSpecs(
  specRows: Array<{ discordId: string; specName: string; position: number }>,
) {
  const grouped = new Map<string, Array<{ specName: string; position: number }>>()
  for (const row of specRows) {
    const specs = grouped.get(row.discordId) ?? []
    specs.push({ specName: row.specName, position: row.position })
    grouped.set(row.discordId, specs)
  }

  return new Map(
    Array.from(grouped.entries()).map(([discordId, specs]) => [
      discordId,
      specs
        .sort((a, b) => a.position - b.position || a.specName.localeCompare(b.specName))
        .map((spec) => spec.specName),
    ]),
  )
}

export async function getDbEvent(eventId: string): Promise<HammaEvent | null> {
  const event = db.select().from(events).where(eq(events.id, eventId)).get()
  if (!event) return null

  const participantRows = db
    .select()
    .from(eventParticipants)
    .where(eq(eventParticipants.eventId, event.id))
    .all()
  const specRows = db
    .select()
    .from(eventParticipantSpecs)
    .where(eq(eventParticipantSpecs.eventId, event.id))
    .all()
  const specsByParticipant = groupEventParticipantSpecs(specRows)
  const participantNames = getParticipantNameMap(participantRows.map((participant) => participant.discordId))
  const participantGroupBadges = getParticipantGroupBadgeMap(participantRows.map((participant) => participant.discordId))
  const teamRows = db.select().from(teams).where(eq(teams.eventId, event.id)).all()
  const ratingRows = db.select().from(ratings).where(eq(ratings.eventId, event.id)).all()
  const pickRows = db.select().from(draftPicks).where(eq(draftPicks.eventId, event.id)).all()
  const roundRows = db
    .select()
    .from(eventRounds)
    .where(eq(eventRounds.eventId, event.id))
    .all()
    .sort((a, b) => a.roundNumber - b.roundNumber)
  const roundScoresByRound = getRoundScoresByRound(event.id)
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
    groupTag: participantGroupBadges.get(participant.discordId)?.tag,
    groupTagColor: participantGroupBadges.get(participant.discordId)?.color,
    outfit: '',
    faction: 'NS',
    status: 'signed_up',
    checkedInAt: participant.checkedInAt ?? undefined,
    specs: specsByParticipant.get(participant.discordId) ?? [],
  }))

  const eventTeams: Team[] = teamRows.map((team) => ({
    id: team.id,
    captainDiscordId: team.captainDiscordId ?? '',
    teamName: team.name,
    faction: normalizeFaction(team.faction),
    startingSide: normalizeStartingSide(team.startingSide),
    budget: event.salaryPool / 2,
    bonusCap: event.bonusPool / 2,
    score: team.score,
    honuReportUrl: team.honuReportUrl ?? undefined,
    honuReportCreatedAt: team.honuReportCreatedAt ?? undefined,
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
      teamId: pick.teamId,
      openedByTeamId: pick.openedByTeamId ?? undefined,
      salary: pick.salary,
      bonusSpent: pick.bonusSpent,
      contestedByTeamId: pick.contestedByTeamId ?? undefined,
      confirmedAt: pick.confirmedAt,
    }))

  return {
    id: event.id,
    raidHelperEventId: event.raidHelperEventId,
    raidHelperChannelId: event.raidHelperChannelId ?? undefined,
    discordCheckInMessageId: event.discordCheckInMessageId ?? undefined,
    discordCheckInMessageChannelId: event.discordCheckInMessageChannelId ?? undefined,
    name: event.nameOverride || event.name,
    nameOverride: event.nameOverride ?? undefined,
    server: event.server,
    startsAt: event.startsAt,
    endsAt: event.endsAt ?? undefined,
    closingTime: event.closingTime ?? undefined,
    draftStartMinutesBefore: event.draftStartMinutesBefore ?? undefined,
    roundCount: event.roundCount,
    roundDurationSeconds: event.roundDurationSeconds,
    phase: event.phase as HammaEvent['phase'],
    salaryPool: event.salaryPool,
    bonusPool: event.bonusPool,
    maxPlayerBonus: event.maxPlayerBonus,
    bidIncrement: event.bidIncrement,
    pendingPlayerCount: event.pendingSignupCount,
    availableFactions: getEventAvailableFactions(event.id),
    availableSides: getEventAvailableSides(event.id),
    availableSpecs: getEventAvailableSpecs(event.id),
    teams: eventTeams,
    players,
    ratings: eventRatings,
    draftPicks: eventDraftPicks,
    activeDraftBid: activeBidRow && activeParticipantIds.has(activeBidRow.playerDiscordId)
      ? {
          id: activeBidRow.id,
          playerId: activeBidRow.playerDiscordId,
          openedByTeamId: activeBidRow.openedByTeamId,
          highestTeamId: activeBidRow.highestTeamId,
          nextTeamId: activeBidRow.nextTeamId,
          currentBonus: activeBidRow.currentBonus,
          createdAt: activeBidRow.createdAt,
          updatedAt: activeBidRow.updatedAt,
        }
      : undefined,
    nextPickTeamId: event.nextPickTeamId ?? undefined,
    coinflip: coinflipRow
      ? {
          id: coinflipRow.id,
          callingTeamId: coinflipRow.callingTeamId ?? '',
          call: normalizeCoinSide(coinflipRow.callerCall),
          result: normalizeCoinSide(coinflipRow.result),
          winningTeamId: coinflipRow.winningTeamId ?? undefined,
          choiceType: normalizeChoiceType(coinflipRow.winnerChoiceType),
          chosenFaction: normalizeFaction(coinflipRow.winnerFaction),
          chosenStartingSide: normalizeStartingSide(coinflipRow.winnerStartingSide),
          firstPickTeamId: coinflipRow.firstPickTeamId ?? undefined,
          createdAt: coinflipRow.createdAt,
          updatedAt: coinflipRow.updatedAt ?? undefined,
        }
      : undefined,
    rounds: roundRows.map((round) => ({
      eventId: round.eventId,
      roundNumber: round.roundNumber,
      startedAt: round.startedAt,
      durationSeconds: round.durationSeconds,
      teamScores: roundScoresByRound.get(round.roundNumber) ?? {},
      winningTeamId: round.winningTeamId ?? undefined,
      resultNote: round.resultNote ?? undefined,
      updatedAt: round.updatedAt,
    })),
    winningTeamId: event.winningTeamId ?? undefined,
    twitchStreamUrl: event.twitchStreamUrl ?? undefined,
    twitchVodUrl: event.twitchVodUrl ?? undefined,
    eventDescription: event.eventDescription ?? undefined,
    eventLinks: getEventLinks(event.id),
    trophyId: normalizeEventTrophyId(event.trophyId),
    lore: event.lore ?? undefined,
    honuZoneId: normalizeHonuZoneId(event.honuZoneId),
    honuAlertId: event.honuAlertId ?? undefined,
    honuAlertCreatedAt: event.honuAlertCreatedAt ?? undefined,
  }
}

export async function getCurrentDbEvent(): Promise<HammaEvent | null> {
  const selected = await getCurrentDbEventRow()
  return selected ? getDbEvent(selected.id) : null
}

export async function getCurrentDbEvents(): Promise<HammaEvent[]> {
  const eventRows = db.select().from(events).all()
  const currentRows = selectCurrentDbEventRows(eventRows)
  return Promise.all(currentRows.map((event) => getDbEvent(event.id))).then((items) =>
    items.filter((event): event is HammaEvent => Boolean(event)),
  )
}

async function getCurrentDbEventRow() {
  const eventRows = db.select().from(events).all()
  if (!eventRows.length) return null

  const currentRows = selectCurrentDbEventRows(eventRows)
  const activeEventId = getActiveEventId()
  const activeEvent = activeEventId
    ? eventRows.find((event) => event.id === activeEventId)
    : undefined
  if (activeEvent) return activeEvent

  const configuredRaidHelperEventId = env('RAID_HELPER_EVENT_ID')
  const configuredEvent = configuredRaidHelperEventId
    ? currentRows.find((event) => event.raidHelperEventId === configuredRaidHelperEventId)
    : undefined

  const selected = configuredEvent ?? currentRows[0] ?? null
  if (selected) setActiveEventId(selected.id)
  return selected
}

function selectCurrentDbEventRows<T extends { startsAt: string; endsAt: string | null }>(eventRows: T[]) {
  const now = Date.now()
  const byStartsAtAsc = (a: T, b: T) =>
    new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()

  return eventRows
    .filter((event) => {
      const startsAt = new Date(event.startsAt).getTime()
      const endsAt = event.endsAt ? new Date(event.endsAt).getTime() : Number.NaN
      return startsAt > now && endsAt > now
    })
    .sort(byStartsAtAsc)
}

function getActiveEventId() {
  return getAppSetting(ACTIVE_EVENT_SETTING_KEY)
}

function getAppSetting(key: string) {
  return db.select().from(appSettings).where(eq(appSettings.key, key)).get()?.value
}

function setAppSetting(key: string, value: string) {
  const now = new Date().toISOString()
  db.insert(appSettings)
    .values({ key, value, updatedAt: now })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value, updatedAt: now },
    })
    .run()
}

function setActiveEventId(eventId: string) {
  setAppSetting(ACTIVE_EVENT_SETTING_KEY, eventId)
}

export async function setActiveEvent(eventId: string): Promise<HammaEvent> {
  const currentRows = selectCurrentDbEventRows(db.select().from(events).all())
  const event = currentRows.find((row) => row.id === eventId)
  if (!event) throw new Error('Active event must be one of the current events.')

  setActiveEventId(event.id)

  const hydrated = await getDbEvent(event.id)
  if (!hydrated) throw new Error('Event not found.')
  return hydrated
}

export async function setEventDiscordCheckInMessage(
  eventId: string,
  channelId: string,
  messageId: string,
) {
  db.update(events)
    .set({
      discordCheckInMessageChannelId: channelId,
      discordCheckInMessageId: messageId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(events.id, eventId))
    .run()
}

export async function ensureDefaultTeams(event: HammaEvent) {
  assertDraftUnlocked(event.id)
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
  assertDraftUnlocked(eventId)
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

  const now = new Date().toISOString()
  replaceEventAvailableFactions(eventId, factions, now)
  replaceEventAvailableSides(eventId, sides, now)
  db.update(events).set({ updatedAt: now }).where(eq(events.id, eventId)).run()

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
  if (eligibleTeams.length < 2) throw new Error('Assign two teams before coinflip.')

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
    const availableFactions = getEventAvailableFactions(eventId)
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
  const availableSides = getEventAvailableSides(eventId)
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
  assertDraftUnlocked(eventId)
  const event = db.select().from(events).where(eq(events.id, eventId)).get()
  if (!event) throw new Error('Event not found.')

  const teamRows = db.select().from(teams).where(eq(teams.eventId, eventId)).all()
  const availableFactions = getEventAvailableFactions(eventId)
  const availableSides = getEventAvailableSides(eventId)
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

  const now = new Date().toISOString()
  db.update(teams).set({ faction: null, startingSide: null }).where(eq(teams.eventId, eventId)).run()
  db.delete(coinflips).where(eq(coinflips.eventId, eventId)).run()
  db.update(events)
    .set({ nextPickTeamId: null, updatedAt: now })
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

export async function saveHonuTeamReports(eventId: string) {
  const event = await getDbEvent(eventId)
  if (!event) throw new Error('Event not found.')

  const reports = getHonuTeamReports(event)
  removeGeneratedHonuReportEventLinks(eventId)
  const reportsByTeamId = new Map(reports.map((report) => [report.teamId, report]))
  const changedTeams = event.teams.flatMap((team) => {
    const nextUrl = reportsByTeamId.get(team.id)?.url ?? null
    const currentUrl = team.honuReportUrl ?? null
    return currentUrl === nextUrl ? [] : [{ teamId: team.id, url: nextUrl }]
  })
  if (!changedTeams.length) return { ok: true, reportCount: 0 }

  const createdAt = new Date().toISOString()
  for (const report of changedTeams) {
    db.update(teams)
      .set({
        honuReportUrl: report.url,
        honuReportCreatedAt: report.url ? createdAt : null,
      })
      .where(and(eq(teams.eventId, eventId), eq(teams.id, report.teamId)))
      .run()
  }

  return { ok: true, reportCount: reports.length }
}

export async function resetHonuReportState(eventId: string) {
  const event = db.select().from(events).where(eq(events.id, eventId)).get()
  if (!event) throw new Error('Event not found.')

  const now = new Date().toISOString()
  db.update(events)
    .set({
      honuAlertId: null,
      honuAlertCreatedAt: null,
      updatedAt: now,
    })
    .where(eq(events.id, eventId))
    .run()
  db.update(teams)
    .set({
      honuReportUrl: null,
      honuReportCreatedAt: null,
    })
    .where(eq(teams.eventId, eventId))
    .run()
  removeGeneratedHonuReportEventLinks(eventId)

  return { ok: true, message: 'Honu alert and team report links reset.' }
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
    eventDescription?: string
    eventLinks?: unknown
    trophyId?: string
    draftStartMinutesBefore?: string
    salaryPool?: string
    bonusPool?: string
    maxPlayerBonus?: string
    bidIncrement?: string
    honuZoneId?: string
    honuAlertId?: string
  },
) {
  const event = db.select().from(events).where(eq(events.id, eventId)).get()
  if (!event) throw new Error('Event not found.')

  const nextStartsAt = values.startsAt?.trim()
  if (nextStartsAt && Number.isNaN(Date.parse(nextStartsAt))) {
    throw new Error('Event time must be a valid date.')
  }
  const nextDraftStartMinutesBefore = normalizeDraftStartMinutesBefore(
    values.draftStartMinutesBefore,
    event.draftStartMinutesBefore,
  )
  const nextSalaryPool = normalizeEvenPool(values.salaryPool, event.salaryPool, 'Salary pool')
  const nextBonusPool = normalizeEvenPool(values.bonusPool, event.bonusPool, 'Bonus pool')
  const nextMaxPlayerBonus = normalizeNonNegativeInteger(
    values.maxPlayerBonus,
    event.maxPlayerBonus,
    'Max player bonus',
  )
  const nextBidIncrement = normalizePositiveInteger(
    values.bidIncrement,
    event.bidIncrement,
    'Bid increment',
  )
  const nextHonuZoneId =
    values.honuZoneId === undefined
      ? normalizeHonuZoneId(event.honuZoneId)
      : normalizeHonuZoneId(values.honuZoneId)
  const nextHonuAlertId =
    values.honuAlertId === undefined
      ? event.honuAlertId
      : normalizeOptionalHonuAlertId(values.honuAlertId)
  const nextHonuAlertCreatedAt =
    nextHonuAlertId === event.honuAlertId
      ? event.honuAlertCreatedAt
      : nextHonuAlertId
        ? new Date().toISOString()
        : null
  const now = new Date().toISOString()

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
      eventDescription:
        values.eventDescription === undefined
          ? event.eventDescription
          : values.eventDescription.trim() || null,
      trophyId:
        values.trophyId === undefined
          ? normalizeEventTrophyId(event.trophyId)
          : normalizeEventTrophyId(values.trophyId),
      draftStartMinutesBefore: nextDraftStartMinutesBefore,
      salaryPool: nextSalaryPool,
      bonusPool: nextBonusPool,
      maxPlayerBonus: nextMaxPlayerBonus,
      bidIncrement: nextBidIncrement,
      honuZoneId: nextHonuZoneId,
      honuAlertId: nextHonuAlertId,
      honuAlertCreatedAt: nextHonuAlertCreatedAt,
      updatedAt: now,
    })
    .where(eq(events.id, eventId))
    .run()
  if (values.eventLinks !== undefined) {
    replaceEventLinks(eventId, normalizeEventLinks(values.eventLinks), now)
  }

  return { ok: true }
}

export async function updateEventRoundSettings(
  eventId: string,
  values: { roundCount?: string; roundDurationMinutes?: string },
) {
  const event = db.select().from(events).where(eq(events.id, eventId)).get()
  if (!event) throw new Error('Event not found.')
  if (isDraftLocked(eventId)) {
    throw new Error('Round settings cannot be changed after the first round starts.')
  }

  const roundCount = normalizeRoundCount(values.roundCount, event.roundCount)
  const roundDurationSeconds = normalizeRoundDurationMinutes(
    values.roundDurationMinutes,
    event.roundDurationSeconds,
  )

  db.update(events)
    .set({
      roundCount,
      roundDurationSeconds,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(events.id, eventId))
    .run()

  return { ok: true, message: 'Round settings saved.' }
}

export async function startNextRound(eventId: string) {
  const event = db.select().from(events).where(eq(events.id, eventId)).get()
  if (!event) throw new Error('Event not found.')

  const activeBid = db
    .select()
    .from(activeDraftBids)
    .where(and(eq(activeDraftBids.eventId, eventId), eq(activeDraftBids.status, 'active')))
    .get()
  if (activeBid) throw new Error('Finish or cancel the active draft bid before starting a round.')

  const existingRounds = db
    .select()
    .from(eventRounds)
    .where(eq(eventRounds.eventId, eventId))
    .all()
  const nextRoundNumber = existingRounds.length
    ? Math.max(...existingRounds.map((round) => round.roundNumber)) + 1
    : 1
  if (nextRoundNumber > event.roundCount) {
    throw new Error('All configured rounds have already been started.')
  }

  const now = new Date().toISOString()
  db.insert(eventRounds)
    .values({
      eventId,
      roundNumber: nextRoundNumber,
      startedAt: now,
      durationSeconds: event.roundDurationSeconds,
      updatedAt: now,
    })
    .run()
  db.update(events)
    .set({ phase: 'locked', updatedAt: now })
    .where(eq(events.id, eventId))
    .run()

  return { ok: true, message: `Round ${nextRoundNumber} started.` }
}

export async function updateRoundResult(
  eventId: string,
  roundNumber: number,
  values: { teamScores?: unknown; resultNote?: string },
) {
  const round = db
    .select()
    .from(eventRounds)
    .where(and(eq(eventRounds.eventId, eventId), eq(eventRounds.roundNumber, roundNumber)))
    .get()
  if (!round) throw new Error('Round not found.')

  const teamScores =
    values.teamScores === undefined
      ? getRoundScoresByRound(eventId).get(roundNumber) ?? {}
      : normalizeRoundTeamScores(eventId, values.teamScores)
  const winningTeamId = getRoundLeadingTeamId(teamScores)

  const now = new Date().toISOString()
  db.update(eventRounds)
    .set({
      winningTeamId,
      resultNote: values.resultNote?.trim() || null,
      updatedAt: now,
    })
    .where(and(eq(eventRounds.eventId, eventId), eq(eventRounds.roundNumber, roundNumber)))
    .run()
  replaceRoundScoreRows(eventId, roundNumber, teamScores, now)
  recalculateScoresFromRounds(eventId)
  db.update(events).set({ updatedAt: now }).where(eq(events.id, eventId)).run()

  return { ok: true, message: `Round ${roundNumber} result saved.` }
}

function normalizeEvenPool(value: string | undefined, current: number, label: string) {
  const amount = normalizeNonNegativeInteger(value, current, label)
  if (amount % 2 !== 0) throw new Error(`${label} must be evenly divisible by 2.`)
  return amount
}

function normalizeNonNegativeInteger(value: string | undefined, current: number, label: string) {
  if (value === undefined) return current
  const trimmed = value.trim()
  if (!trimmed) throw new Error(`${label} is required.`)
  const amount = Number(trimmed)
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error(`${label} must be a non-negative whole-dollar amount.`)
  }
  return amount
}

function normalizePositiveInteger(value: string | undefined, current: number, label: string) {
  const amount = normalizeNonNegativeInteger(value, current, label)
  if (amount <= 0) throw new Error(`${label} must be greater than 0.`)
  return amount
}

function normalizeRoundCount(value: string | undefined, current: number) {
  if (value === undefined) return current
  const trimmed = value.trim()
  if (!trimmed) throw new Error('Round count is required.')
  const count = Number(trimmed)
  if (!Number.isInteger(count) || count < 1 || count > 20) {
    throw new Error('Round count must be a whole number from 1 to 20.')
  }
  return count
}

function normalizeRoundDurationMinutes(value: string | undefined, currentSeconds: number) {
  if (value === undefined) return currentSeconds
  const trimmed = value.trim()
  if (!trimmed) throw new Error('Round duration is required.')
  const minutes = Number(trimmed)
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 240) {
    throw new Error('Round duration must be a whole number from 1 to 240 minutes.')
  }
  return minutes * 60
}

function normalizeDraftStartMinutesBefore(value: string | undefined, current: number | null) {
  if (value === undefined) return current

  const trimmed = value.trim()
  if (!trimmed) return null

  const minutes = Number(trimmed)
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 24 * 60) {
    throw new Error('Draft start offset must be a whole number of minutes from 0 to 1440.')
  }

  return minutes
}

function normalizeEventTrophyId(value: string | null | undefined): EventTrophyId {
  return value === 'hamma-dome-biolab' ? 'hamma-dome-biolab' : 'hammo-bowl-cup'
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
      bonusPool: BONUS_POOL,
      maxPlayerBonus: MAX_PLAYER_BONUS,
      bidIncrement: BID_INCREMENT,
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
  honuReportUrl?: string
}) {
  const event = db.select().from(events).where(eq(events.id, values.eventId)).get()
  if (!event) throw new Error('Event not found.')

  const name = values.name.trim()
  if (!name) throw new Error('Team name is required.')
  const now = new Date().toISOString()
  const teamId = values.teamId || `${values.eventId}-team-${crypto.randomUUID()}`
  const captainDiscordId = values.captainDiscordId?.trim() || null
  const honuReportUrl = normalizeOptionalEventUrl(values.honuReportUrl)
  const existingTeam = db.select().from(teams).where(eq(teams.id, teamId)).get()
  const honuReportCreatedAt =
    existingTeam?.honuReportUrl === honuReportUrl
      ? existingTeam?.honuReportCreatedAt ?? null
      : honuReportUrl
        ? now
        : null
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
      honuReportUrl,
      honuReportCreatedAt,
    })
    .onConflictDoUpdate({
      target: teams.id,
      set: {
        name,
        captainDiscordId,
        score: Number.isFinite(values.score) ? Number(values.score) : 0,
        honuReportUrl,
        honuReportCreatedAt,
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
      .set({ teamId: values.teamId, openedByTeamId: values.teamId })
      .where(eq(draftPicks.id, existingPick.id))
      .run()
  } else {
    db.insert(draftPicks)
      .values({
        id: crypto.randomUUID(),
        eventId: values.eventId,
        playerDiscordId: discordId,
        teamId: values.teamId,
        openedByTeamId: values.teamId,
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
  const specRows = db
    .select()
    .from(eventParticipantSpecs)
    .where(eq(eventParticipantSpecs.eventId, event.id))
    .all()
  const teamRows = db.select().from(teams).where(eq(teams.eventId, event.id)).all()
  const pickRows = db
    .select()
    .from(draftPicks)
    .where(eq(draftPicks.eventId, event.id))
    .all()
    .sort((a, b) => Date.parse(a.confirmedAt) - Date.parse(b.confirmedAt))
  const ratingRows = db.select().from(ratings).where(eq(ratings.eventId, event.id)).all()
  const roundRows = db
    .select()
    .from(eventRounds)
    .where(eq(eventRounds.eventId, event.id))
    .all()
    .sort((a, b) => a.roundNumber - b.roundNumber)
  const roundScoresByRound = getRoundScoresByRound(event.id)
  const participantName = getParticipantNameMap(participantRows.map((participant) => participant.discordId))
  const participantFallbackName = new Map(
    participantRows.map((participant) => [participant.discordId, participant.name]),
  )
  const participantGroupBadges = getParticipantGroupBadgeMap(participantRows.map((participant) => participant.discordId))
  const displayName = (discordId: string) => participantName.get(discordId) ?? participantFallbackName.get(discordId) ?? discordId
  const specsByParticipant = groupEventParticipantSpecs(specRows)

  const historicalTeams = teamRows.map((team) => {
    const memberIds = new Set<string>()
    if (team.captainDiscordId) memberIds.add(team.captainDiscordId)
    for (const pick of pickRows.filter((candidate) => candidate.teamId === team.id)) {
      memberIds.add(pick.playerDiscordId)
    }
    const memberProfiles = Array.from(memberIds)
      .map((discordId) => ({
        discordId,
        name: displayName(discordId),
        groupTag: participantGroupBadges.get(discordId)?.tag,
        groupTagColor: participantGroupBadges.get(discordId)?.color,
      }))
      .sort((a, b) => a.name.localeCompare(b.name))

    return {
      id: team.id,
      name: team.name,
      captainDiscordId: team.captainDiscordId ?? undefined,
      captain: team.captainDiscordId ? displayName(team.captainDiscordId) : undefined,
      score: team.score,
      members: memberProfiles.map((member) => member.name),
      memberProfiles,
      winner: team.id === event.winningTeamId,
      honuReportUrl: team.honuReportUrl ?? undefined,
      honuReportCreatedAt: team.honuReportCreatedAt ?? undefined,
    }
  })
  const winningTeam = historicalTeams.find((team) => team.winner)
  const teamsById = new Map(historicalTeams.map((team) => [team.id, team]))
  const captainIds = new Set(teamRows.flatMap((team) => team.captainDiscordId ? [team.captainDiscordId] : []))
  const activeParticipantIds = new Set(
    participantRows
      .filter((participant) => !participant.disqualified)
      .map((participant) => participant.discordId),
  )
  const pickedTeamByPlayerId = new Map(
    pickRows.map((pick) => [pick.playerDiscordId, pick.teamId]),
  )
  const pickSalaryByPlayerId = new Map(
    pickRows.map((pick) => [pick.playerDiscordId, pick.salary]),
  )
  const ratingSummaries = participantRows.map((participant) => {
    const playerRatings = ratingRows.filter(
      (rating) =>
        rating.toDiscordId === participant.discordId &&
        rating.fromDiscordId !== participant.discordId &&
        activeParticipantIds.has(rating.fromDiscordId) &&
        !rating.disqualified,
    )
    const averageRating = playerRatings.length
      ? playerRatings.reduce((sum, rating) => sum + rating.score, 0) / playerRatings.length
      : null
    const teamId = pickedTeamByPlayerId.get(participant.discordId)

    return {
      discordId: participant.discordId,
      name: displayName(participant.discordId),
      groupTag: participantGroupBadges.get(participant.discordId)?.tag,
      groupTagColor: participantGroupBadges.get(participant.discordId)?.color,
      specs: specsByParticipant.get(participant.discordId) ?? [],
      averageRating,
      ratingCount: playerRatings.length,
      salary: null as number | null,
      teamId,
      teamName: teamId ? teamsById.get(teamId)?.name : undefined,
      isCaptain: captainIds.has(participant.discordId),
      disqualified: participant.disqualified,
    }
  })
  const salaryEligibleRatings = ratingSummaries.filter(
    (summary) =>
      !summary.disqualified &&
      !summary.isCaptain &&
      typeof summary.averageRating === 'number',
  )
  const totalRatingPoints = salaryEligibleRatings.reduce(
    (sum, summary) => sum + (summary.averageRating ?? 0),
    0,
  )
  const salaryByPlayerId = new Map(
    totalRatingPoints > 0
      ? salaryEligibleRatings.map((summary) => [
          summary.discordId,
          Math.round(event.salaryPool * ((summary.averageRating ?? 0) / totalRatingPoints)),
        ])
      : [],
  )
  const playerRatings = ratingSummaries
    .map((summary) => ({
      ...summary,
      salary: pickSalaryByPlayerId.get(summary.discordId) ?? salaryByPlayerId.get(summary.discordId) ?? null,
    }))
    .sort((a, b) => {
      if (a.isCaptain !== b.isCaptain) return a.isCaptain ? -1 : 1
      if (a.disqualified !== b.disqualified) return a.disqualified ? 1 : -1
      const ratingDelta = (b.averageRating ?? -1) - (a.averageRating ?? -1)
      if (ratingDelta) return ratingDelta
      return a.name.localeCompare(b.name)
    })
  const publicDraftPicks = pickRows.flatMap((pick, index) => {
    const team = teamsById.get(pick.teamId)
    if (!team) return []

    return [{
      id: pick.id,
      order: index + 1,
      player: {
        discordId: pick.playerDiscordId,
        name: displayName(pick.playerDiscordId),
        groupTag: participantGroupBadges.get(pick.playerDiscordId)?.tag,
        groupTagColor: participantGroupBadges.get(pick.playerDiscordId)?.color,
      },
      team: {
        id: team.id,
        name: team.name,
      },
      openedByTeam: pick.openedByTeamId && teamsById.has(pick.openedByTeamId)
        ? {
            id: pick.openedByTeamId,
            name: teamsById.get(pick.openedByTeamId)?.name ?? pick.openedByTeamId,
          }
        : undefined,
      contestedByTeam: pick.contestedByTeamId && teamsById.has(pick.contestedByTeamId)
        ? {
            id: pick.contestedByTeamId,
            name: teamsById.get(pick.contestedByTeamId)?.name ?? pick.contestedByTeamId,
          }
        : undefined,
      salary: pick.salary,
      bonusSpent: pick.bonusSpent,
      confirmedAt: pick.confirmedAt,
    }]
  })

  return {
    id: event.id,
    name: event.nameOverride || event.name,
    nameOverride: event.nameOverride ?? undefined,
    date: event.startsAt,
    server: event.server,
    salaryPool: event.salaryPool,
    bonusPool: event.bonusPool,
    trophyId: normalizeEventTrophyId(event.trophyId),
    twitchStreamUrl: event.twitchStreamUrl ?? undefined,
    twitchVodUrl: event.twitchVodUrl ?? undefined,
    lore: event.lore ?? undefined,
    honuAlertId: event.honuAlertId ?? undefined,
    honuAlertCreatedAt: event.honuAlertCreatedAt ?? undefined,
    winningTeam: winningTeam
      ? {
          id: winningTeam.id,
          name: winningTeam.name,
          members: participantRows
            .filter((participant) => participant.winner)
            .map((participant) => displayName(participant.discordId))
            .sort((a, b) => a.localeCompare(b)),
          memberProfiles: participantRows
            .filter((participant) => participant.winner)
            .map((participant) => ({
              discordId: participant.discordId,
              name: displayName(participant.discordId),
              groupTag: participantGroupBadges.get(participant.discordId)?.tag,
              groupTagColor: participantGroupBadges.get(participant.discordId)?.color,
            }))
            .sort((a, b) => a.name.localeCompare(b.name)),
        }
      : undefined,
    rounds: roundRows.map((round) => ({
      eventId: round.eventId,
      roundNumber: round.roundNumber,
      startedAt: round.startedAt,
      durationSeconds: round.durationSeconds,
      teamScores: roundScoresByRound.get(round.roundNumber) ?? {},
      winningTeamId: round.winningTeamId ?? undefined,
      winningTeamName: round.winningTeamId ? teamsById.get(round.winningTeamId)?.name : undefined,
      resultNote: round.resultNote ?? undefined,
      updatedAt: round.updatedAt,
    })),
    teams: historicalTeams,
    playerRatings,
    draftPicks: publicDraftPicks,
  }
}

function getRegisteredParticipants(): RegisteredParticipant[] {
  const participantRows = db.select().from(participants).all()
  const groupBadges = getParticipantGroupBadgeMap(participantRows.map((participant) => participant.discordId))

  return participantRows
    .map((participant) => ({
      discordId: participant.discordId,
      name: participant.name,
      groupTag: groupBadges.get(participant.discordId)?.tag,
      groupTagColor: groupBadges.get(participant.discordId)?.color,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

export async function checkInEventParticipant(eventId: string, discordId: string) {
  const event = await getDbEvent(eventId)
  if (!event) throw new Error('Event not found.')

  const player = event.players.find((candidate) => candidate.id === discordId)
  if (!player) throw new Error('You are not signed up for this event.')
  if (player.checkedInAt) {
    return { player: player.name, checkedInAt: player.checkedInAt, alreadyCheckedIn: true }
  }

  const checkInWindow = getCheckInWindow(event)
  if (!checkInWindow.isOpen) {
    if (!checkInWindow.hasClosed) {
      const opensAt = checkInWindow.opensAt
        ? discordTimestamp(checkInWindow.opensAt, 'R')
        : '15 minutes before draft start'
      throw new Error(`Check-in opens ${opensAt} and closes at event start.`)
    }
    throw new Error('Check-in has already closed.')
  }

  const checkedInAt = new Date().toISOString()
  db.update(eventParticipants)
    .set({ checkedInAt, updatedAt: checkedInAt })
    .where(
      and(
        eq(eventParticipants.eventId, event.id),
        eq(eventParticipants.discordId, discordId),
      ),
    )
    .run()

  return { player: player.name, checkedInAt, alreadyCheckedIn: false }
}

export async function confirmDraftPick(
  event: HammaEvent,
  teamId: string,
  playerDiscordId: string,
  bidBonus: number,
  contestedByTeamId?: string,
  openedByTeamId?: string,
) {
  assertDraftUnlocked(event.id)
  const team = event.teams.find((captain) => captain.id === teamId)
  if (!team) throw new Error('Team not found.')

  const player = event.players.find((candidate) => candidate.id === playerDiscordId)
  if (!player) throw new Error('Player not found.')

  if (event.draftPicks.some((pick) => pick.playerId === playerDiscordId)) {
    throw new Error('Player has already been drafted.')
  }

  if (bidBonus < 0 || !Number.isFinite(bidBonus)) {
    throw new Error('Bonus bid must be zero or more.')
  }

  if (!Number.isInteger(bidBonus)) {
    throw new Error('Bonus bid must be a whole dollar amount.')
  }

  const cost = acquisitionCost(event, teamId, playerDiscordId, bidBonus)
  if (!cost) throw new Error('Player is not eligible for the draft.')
  if (!cost.affordable) {
    throw new Error('That team cannot afford this player.')
  }

  const id = crypto.randomUUID()
  db.insert(draftPicks)
    .values({
      id,
      eventId: event.id,
      playerDiscordId,
      teamId,
      openedByTeamId: openedByTeamId || teamId,
      salary: cost.salary,
      bonusSpent: cost.bonusSpent,
      contestedByTeamId: contestedByTeamId || null,
      confirmedAt: new Date().toISOString(),
    })
    .run()

  db.update(events).set({ phase: 'draft', updatedAt: new Date().toISOString() }).where(eq(events.id, event.id)).run()

  return { id, player: player.name, team: team.teamName, salary: cost.salary, bonusSpent: cost.bonusSpent }
}

export async function openDraftBid(event: HammaEvent, teamId: string, playerDiscordId: string) {
  assertDraftUnlocked(event.id)
  if (isDraftAdjustmentPhase(event)) {
    throw new Error('The draft adjustment phase has started. Use steal budget adjustments instead.')
  }
  if (event.activeDraftBid) throw new Error('A bid is already open.')
  const readiness = getDraftReadiness(event)
  if (!readiness.ready) throw new Error(readiness.label)

  const team = event.teams.find((captain) => captain.id === teamId)
  if (!team) throw new Error('Team not found.')

  const opposingTeam = event.teams.find((captain) => captain.id !== teamId)
  if (!opposingTeam) throw new Error('Configure an opposing team before opening bids.')

  const player = event.players.find((candidate) => candidate.id === playerDiscordId)
  if (!player) throw new Error('Player not found.')

  if (event.draftPicks.some((pick) => pick.playerId === playerDiscordId)) {
    throw new Error('Player has already been drafted.')
  }

  if (!canAcquirePlayer(event, teamId, playerDiscordId, 0)) {
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
      currentBonus: 0,
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
    currentBonus: 0,
    nextTeam: opposingTeam.teamName,
  }
}

export async function pickDraftPlayer(event: HammaEvent, teamId: string, playerDiscordId: string) {
  assertDraftUnlocked(event.id)
  if (isDraftAdjustmentPhase(event)) {
    throw new Error('The draft adjustment phase has started. Use steal budget adjustments instead.')
  }
  const readiness = getDraftReadiness(event)
  if (!readiness.ready) throw new Error(readiness.label)
  if (event.activeDraftBid) throw new Error('A bid is already open.')

  const reachWinner = reachAwardWinner(event, teamId, playerDiscordId)
  if (reachWinner) {
    const result = await confirmDraftPick(event, reachWinner.team.id, playerDiscordId, 0, undefined, teamId)
    db.update(events)
      .set({
        nextPickTeamId: oppositeTeamId(event, teamId) ?? null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(events.id, event.id))
      .run()
    return {
      ...result,
      directAward: true,
    }
  }

  return openDraftBid(event, teamId, playerDiscordId)
}

export async function bumpDraftBid(event: HammaEvent, bidId: string, teamId: string) {
  assertDraftUnlocked(event.id)
  if (isDraftAdjustmentPhase(event)) {
    throw new Error('The draft adjustment phase has started. Cancel the active bid before stealing players.')
  }
  const bid = getActiveBid(event.id, bidId)
  if (bid.nextTeamId !== teamId) throw new Error('It is not your turn to raise this bid.')

  const budgetAdvantageWinner = salaryBudgetAdvantageWinner(
    event,
    teamId,
    bid.highestTeamId,
    bid.playerDiscordId,
  )
  if (budgetAdvantageWinner) {
    const contestedByTeamId =
      budgetAdvantageWinner.team.id === teamId ? bid.highestTeamId : teamId
    const result = await confirmDraftPick(
      event,
      budgetAdvantageWinner.team.id,
      bid.playerDiscordId,
      0,
      contestedByTeamId,
      bid.openedByTeamId,
    )
    db.delete(activeDraftBids)
      .where(and(eq(activeDraftBids.eventId, event.id), eq(activeDraftBids.id, bid.id)))
      .run()
    db.update(events)
      .set({
        nextPickTeamId: oppositeTeamId(event, bid.openedByTeamId) ?? null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(events.id, event.id))
      .run()

    return {
      ...result,
      directAward: true,
    }
  }

  const nextBonus = bid.currentBonus + event.bidIncrement
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
  const team = event.teams.find((captain) => captain.id === teamId)
  db.update(events).set({ updatedAt: now }).where(eq(events.id, event.id)).run()

  return {
    player: player?.name ?? bid.playerDiscordId,
    team: team?.teamName ?? teamId,
    currentBonus: nextBonus,
  }
}

export async function forfeitDraftBid(event: HammaEvent, bidId: string, teamId: string) {
  assertDraftUnlocked(event.id)
  if (isDraftAdjustmentPhase(event)) {
    throw new Error('The draft adjustment phase has started. Cancel the active bid before stealing players.')
  }
  const bid = getActiveBid(event.id, bidId)
  if (bid.nextTeamId !== teamId) throw new Error('It is not your turn to forfeit this bid.')
  const nextPickTeamId = oppositeTeamId(event, bid.openedByTeamId)

  const result = await confirmDraftPick(
    event,
    bid.highestTeamId,
    bid.playerDiscordId,
    bid.currentBonus,
    bid.currentBonus > 0 ? teamId : undefined,
    bid.openedByTeamId,
  )

  db.delete(activeDraftBids)
    .where(and(eq(activeDraftBids.eventId, event.id), eq(activeDraftBids.id, bid.id)))
    .run()
  db.update(events)
    .set({ nextPickTeamId: nextPickTeamId ?? null, updatedAt: new Date().toISOString() })
    .where(eq(events.id, event.id))
    .run()

  return result
}

export async function stealDraftPlayer(event: HammaEvent, teamId: string, playerDiscordId: string) {
  assertDraftUnlocked(event.id)
  if (!isDraftAdjustmentPhase(event)) {
    throw new Error('Steals are only available after the event start time.')
  }
  if (event.activeDraftBid) {
    throw new Error('Cancel or finish the active bid before stealing players.')
  }

  const adjustment = buildDraftAdjustment(event)
  if (!adjustment.needsAdjustment || !adjustment.stealingTeam || !adjustment.sourceTeam) {
    throw new Error('No steal budget is available.')
  }
  if (adjustment.stealingTeam.id !== teamId) {
    throw new Error('Only the lower-value team can use the steal budget.')
  }

  const pick = adjustment.stealablePicks.find((candidate) => candidate.playerId === playerDiscordId)
  if (!pick) {
    throw new Error('That player is not affordable with the current steal budget.')
  }

  const now = new Date().toISOString()
  db.update(draftPicks)
    .set({
      teamId,
      openedByTeamId: teamId,
      bonusSpent: 0,
      contestedByTeamId: null,
      confirmedAt: now,
    })
    .where(and(eq(draftPicks.eventId, event.id), eq(draftPicks.id, pick.id)))
    .run()
  db.update(events).set({ updatedAt: now }).where(eq(events.id, event.id)).run()

  return {
    player: pick.player.name,
    team: adjustment.stealingTeam.teamName,
    sourceTeam: adjustment.sourceTeam.teamName,
    salary: pick.salary,
  }
}

export async function resetDraftPick(eventId: string, pickId: string) {
  assertDraftUnlocked(eventId)
  const activeBid = db
    .select()
    .from(activeDraftBids)
    .where(and(eq(activeDraftBids.eventId, eventId), eq(activeDraftBids.status, 'active')))
    .get()
  if (activeBid) throw new Error('Cancel or finish the active bid before resetting a pick.')

  const pick = db
    .select()
    .from(draftPicks)
    .where(and(eq(draftPicks.eventId, eventId), eq(draftPicks.id, pickId)))
    .get()
  if (!pick) throw new Error('Draft pick not found.')

  const latestPick = db
    .select()
    .from(draftPicks)
    .where(eq(draftPicks.eventId, eventId))
    .orderBy(desc(draftPicks.confirmedAt))
    .limit(1)
    .get()
  if (latestPick?.id !== pick.id) {
    throw new Error('Only the most recent pick can be undone.')
  }

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

  db.update(events)
    .set({
      nextPickTeamId: pick.openedByTeamId ?? pick.teamId,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(events.id, eventId))
    .run()

  return { player: getParticipantName(pick.playerDiscordId) ?? player?.name ?? pick.playerDiscordId }
}

export async function cancelActiveDraftBid(eventId: string) {
  assertDraftUnlocked(eventId)
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

function assertDraftUnlocked(eventId: string) {
  if (isDraftLocked(eventId)) {
    throw new Error('The draft is locked because the first round has started.')
  }
}

function isDraftLocked(eventId: string) {
  return Boolean(
    db.select()
      .from(eventRounds)
      .where(eq(eventRounds.eventId, eventId))
      .limit(1)
      .get(),
  )
}

function recalculateScoresFromRounds(eventId: string) {
  const teamRows = db.select().from(teams).where(eq(teams.eventId, eventId)).all()
  const roundScoreRows = db.select().from(eventRoundScores).where(eq(eventRoundScores.eventId, eventId)).all()
  const adjustments = db.select().from(scoreAdjustments).where(eq(scoreAdjustments.eventId, eventId)).all()
  for (const team of teamRows) {
    const roundScore = roundScoreRows
      .filter((roundScore) => roundScore.teamId === team.id)
      .reduce((total, roundScore) => total + roundScore.score, 0)
    const adjustmentScore = adjustments
      .filter((adjustment) => adjustment.teamId === team.id)
      .reduce((total, adjustment) => total + adjustment.delta, 0)
    const score = roundScore + adjustmentScore
    db.update(teams).set({ score }).where(eq(teams.id, team.id)).run()
  }
}

function getRoundScoresByRound(eventId: string) {
  const grouped = new Map<number, Record<string, number>>()
  const rows = db.select().from(eventRoundScores).where(eq(eventRoundScores.eventId, eventId)).all()
  for (const row of rows) {
    const scores = grouped.get(row.roundNumber) ?? {}
    scores[row.teamId] = row.score
    grouped.set(row.roundNumber, scores)
  }
  return grouped
}

function replaceRoundScoreRows(
  eventId: string,
  roundNumber: number,
  teamScores: Record<string, number>,
  updatedAt: string,
) {
  db.delete(eventRoundScores)
    .where(and(eq(eventRoundScores.eventId, eventId), eq(eventRoundScores.roundNumber, roundNumber)))
    .run()

  for (const [teamId, score] of Object.entries(teamScores)) {
    db.insert(eventRoundScores)
      .values({
        eventId,
        roundNumber,
        teamId,
        score,
        updatedAt,
      })
      .run()
  }
}

function parseLegacyRoundTeamScores(
  value: string | null | undefined,
  fallbackWinningTeamId?: string | null,
): Record<string, number> {
  if (value) {
    try {
      const parsed = JSON.parse(value)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const scores: Record<string, number> = {}
        for (const [teamId, rawScore] of Object.entries(parsed)) {
          const score = Number(rawScore)
          if (!teamId || !Number.isFinite(score)) continue
          scores[teamId] = score
        }
        if (Object.keys(scores).length) return scores
      }
    } catch {
      // Fall through to legacy winner-based scores.
    }
  }

  return fallbackWinningTeamId ? { [fallbackWinningTeamId]: 1 } : {}
}

function normalizeRoundTeamScores(eventId: string, value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Round scores are required.')
  }

  const rawScores = value as Record<string, unknown>
  const teamRows = db.select().from(teams).where(eq(teams.eventId, eventId)).all()
  const scores: Record<string, number> = {}
  for (const team of teamRows) {
    const score = Number(rawScores[team.id] ?? 0)
    if (!Number.isSafeInteger(score) || score < 0) {
      throw new Error('Round scores must be non-negative whole numbers.')
    }
    scores[team.id] = score
  }

  return scores
}

function getRoundLeadingTeamId(scores: Record<string, number>) {
  const highestScore = Math.max(0, ...Object.values(scores))
  if (highestScore <= 0) return null

  const leaders = Object.entries(scores).filter(([, score]) => score === highestScore)
  return leaders.length === 1 ? leaders[0][0] : null
}

function getEventAvailableFactions(eventId: string): Faction[] {
  const values = db
    .select()
    .from(eventAvailableFactions)
    .where(eq(eventAvailableFactions.eventId, eventId))
    .all()
    .sort((a, b) => a.position - b.position)
    .map((row) => normalizeFaction(row.faction))
    .filter((faction): faction is Faction => Boolean(faction))

  return values.length ? values : ['VS', 'NC', 'TR']
}

function getEventAvailableSides(eventId: string): StartingSide[] {
  const values = db
    .select()
    .from(eventAvailableSides)
    .where(eq(eventAvailableSides.eventId, eventId))
    .all()
    .sort((a, b) => a.position - b.position)
    .map((row) => normalizeStartingSide(row.side))
    .filter((side): side is StartingSide => Boolean(side))

  return values.length ? values : ['north', 'south']
}

function getEventAvailableSpecs(eventId: string): string[] {
  return db
    .select()
    .from(eventAvailableSpecs)
    .where(eq(eventAvailableSpecs.eventId, eventId))
    .all()
    .sort((a, b) => a.position - b.position || a.specName.localeCompare(b.specName))
    .map((row) => row.specName)
}

function getEventLinks(eventId: string, options: { includeGeneratedHonuReports?: boolean } = {}): EventLink[] {
  const links = db
    .select()
    .from(eventLinks)
    .where(eq(eventLinks.eventId, eventId))
    .all()
    .sort((a, b) => a.position - b.position)
    .map((row) => ({
      name: row.name,
      icon: EVENT_LINK_ICONS.has(row.icon) ? row.icon : 'Link',
      url: row.url,
    }))

  return options.includeGeneratedHonuReports
    ? links
    : links.filter((link) => !isGeneratedHonuReportLink(link))
}

function replaceEventAvailableFactions(eventId: string, values: string[], updatedAt: string) {
  db.delete(eventAvailableFactions).where(eq(eventAvailableFactions.eventId, eventId)).run()
  normalizeFactionList(values).forEach((faction, index) => {
    db.insert(eventAvailableFactions)
      .values({ eventId, faction, position: index + 1, updatedAt })
      .run()
  })
}

function replaceEventAvailableSides(eventId: string, values: string[], updatedAt: string) {
  db.delete(eventAvailableSides).where(eq(eventAvailableSides.eventId, eventId)).run()
  normalizeSideList(values).forEach((side, index) => {
    db.insert(eventAvailableSides)
      .values({ eventId, side, position: index + 1, updatedAt })
      .run()
  })
}

function replaceEventAvailableSpecs(eventId: string, values: string[], updatedAt: string) {
  db.delete(eventAvailableSpecs).where(eq(eventAvailableSpecs.eventId, eventId)).run()
  normalizeStringList(values).forEach((specName, index) => {
    db.insert(eventAvailableSpecs)
      .values({ eventId, specName, position: index + 1, updatedAt })
      .run()
  })
}

function replaceEventLinks(eventId: string, links: EventLink[], updatedAt: string) {
  db.delete(eventLinks).where(eq(eventLinks.eventId, eventId)).run()
  links.forEach((link, index) => {
    db.insert(eventLinks)
      .values({
        eventId,
        position: index + 1,
        name: link.name,
        icon: link.icon,
        url: link.url,
        updatedAt,
      })
      .run()
  })
}

function getParticipantRoleIds(discordId: string) {
  return db
    .select()
    .from(participantRoleIds)
    .where(eq(participantRoleIds.discordId, discordId))
    .all()
    .map((row) => row.roleId)
}

export function getParticipantDiscordRoleIds(discordId: string) {
  const normalizedId = discordId.trim()
  if (!normalizedId) return []
  return getParticipantRoleIds(normalizedId)
}

function replaceParticipantRoleIds(discordId: string, roleIds: string[], updatedAt: string) {
  const normalized = Array.from(new Set(roleIds.map((roleId) => roleId.trim()).filter(Boolean)))
  db.delete(participantRoleIds).where(eq(participantRoleIds.discordId, discordId)).run()
  for (const roleId of normalized) {
    db.insert(participantRoleIds)
      .values({ discordId, roleId, updatedAt })
      .run()
  }
}

function replaceBadgeDisplayPreferences(
  discordId: string,
  preferences: { order: string[]; hidden: string[] },
  updatedAt: string,
) {
  db.delete(playerBadgeDisplayPreferences)
    .where(eq(playerBadgeDisplayPreferences.discordId, discordId))
    .run()

  preferences.order.forEach((badgeId, index) => {
    db.insert(playerBadgeDisplayPreferences)
      .values({
        discordId,
        badgeId,
        position: index + 1,
        hidden: false,
        updatedAt,
      })
      .run()
  })

  for (const badgeId of preferences.hidden) {
    db.insert(playerBadgeDisplayPreferences)
      .values({
        discordId,
        badgeId,
        position: null,
        hidden: true,
        updatedAt,
      })
      .onConflictDoUpdate({
        target: [
          playerBadgeDisplayPreferences.discordId,
          playerBadgeDisplayPreferences.badgeId,
        ],
        set: {
          position: null,
          hidden: true,
          updatedAt,
        },
      })
      .run()
  }
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

export async function clearRating(
  event: HammaEvent,
  fromDiscordId: string,
  toDiscordId: string,
) {
  if (fromDiscordId === toDiscordId) throw new Error('You cannot rate yourself.')
  if (!event.players.some((player) => player.id === toDiscordId)) throw new Error('Player is not active for this event.')
  if (isCaptainPlayer(event, toDiscordId)) throw new Error('Captains cannot be rated.')

  db.delete(ratings)
    .where(
      and(
        eq(ratings.eventId, event.id),
        eq(ratings.fromDiscordId, fromDiscordId),
        eq(ratings.toDiscordId, toDiscordId),
      ),
    )
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

export function getAdminSignupManagerData(eventId: string): AdminSignupManagerData {
  const normalizedEventId = eventId.trim()
  if (!normalizedEventId) throw new Error('Event is required.')
  if (!db.select().from(events).where(eq(events.id, normalizedEventId)).get()) {
    throw new Error('Event not found.')
  }

  const participantRows = db
    .select()
    .from(eventParticipants)
    .where(eq(eventParticipants.eventId, normalizedEventId))
    .all()
    .filter((participant) => !participant.disqualified)
  const names = getParticipantNameMap(participantRows.map((participant) => participant.discordId))
  const groupBadges = getParticipantGroupBadgeMap(participantRows.map((participant) => participant.discordId))
  const signedUpPlayers = participantRows
    .map((participant) => ({
      discordId: participant.discordId,
      name: names.get(participant.discordId) ?? participant.name,
      groupTag: groupBadges.get(participant.discordId)?.tag,
      groupTagColor: groupBadges.get(participant.discordId)?.color,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  return {
    players: getRegisteredPlayerList(),
    signedUpPlayers,
  }
}

export async function addEventSignup(eventId: string, discordId: string) {
  const normalizedEventId = eventId.trim()
  const normalizedDiscordId = discordId.trim()
  if (!normalizedEventId) throw new Error('Event is required.')
  if (!normalizedDiscordId) throw new Error('Player is required.')

  const event = db.select().from(events).where(eq(events.id, normalizedEventId)).get()
  if (!event) throw new Error('Event not found.')

  const participant = db
    .select()
    .from(participants)
    .where(eq(participants.discordId, normalizedDiscordId))
    .get()
  if (!participant) throw new Error('Player not found.')

  const now = new Date().toISOString()
  setEventSignupOverride(normalizedEventId, normalizedDiscordId, 'add', now)
  db.insert(eventParticipants)
    .values({
      eventId: normalizedEventId,
      discordId: normalizedDiscordId,
      name: participant.name,
      status: 'signed_up',
      disqualified: false,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [eventParticipants.eventId, eventParticipants.discordId],
      set: {
        name: participant.name,
        status: 'signed_up',
        disqualified: false,
        updatedAt: now,
      },
    })
    .run()

  db.update(events).set({ updatedAt: now }).where(eq(events.id, normalizedEventId)).run()
  return getDbEvent(normalizedEventId)
}

export async function removeEventSignup(eventId: string, discordId: string) {
  const normalizedEventId = eventId.trim()
  const normalizedDiscordId = discordId.trim()
  if (!normalizedEventId) throw new Error('Event is required.')
  if (!normalizedDiscordId) throw new Error('Player is required.')

  const event = await getDbEvent(normalizedEventId)
  if (!event) throw new Error('Event not found.')

  const player = event.players.find((candidate) => candidate.id === normalizedDiscordId)
  if (!player) throw new Error('Player is not signed up for this event.')
  if (event.teams.some((team) => team.captainDiscordId === normalizedDiscordId)) {
    throw new Error('Captains cannot be removed from signups.')
  }
  if (event.draftPicks.some((pick) => pick.playerId === normalizedDiscordId)) {
    throw new Error('Drafted players cannot be removed from signups.')
  }

  const now = new Date().toISOString()
  setEventSignupOverride(normalizedEventId, normalizedDiscordId, 'remove', now)
  db.update(eventParticipants)
    .set({
      status: 'disqualified',
      disqualified: true,
      checkedInAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(eventParticipants.eventId, normalizedEventId),
        eq(eventParticipants.discordId, normalizedDiscordId),
      ),
    )
    .run()

  db.delete(eventParticipantSpecs)
    .where(
      and(
        eq(eventParticipantSpecs.eventId, normalizedEventId),
        eq(eventParticipantSpecs.discordId, normalizedDiscordId),
      ),
    )
    .run()
  db.update(events).set({ updatedAt: now }).where(eq(events.id, normalizedEventId)).run()

  return getDbEvent(normalizedEventId)
}

function setEventSignupOverride(
  eventId: string,
  discordId: string,
  action: 'add' | 'remove',
  updatedAt = new Date().toISOString(),
) {
  db.insert(eventSignupOverrides)
    .values({
      eventId,
      discordId,
      action,
      updatedAt,
    })
    .onConflictDoUpdate({
      target: [eventSignupOverrides.eventId, eventSignupOverrides.discordId],
      set: {
        action,
        updatedAt,
      },
    })
    .run()
}

function getEventSignupOverrideMap(eventId: string) {
  return new Map(
    db
      .select()
      .from(eventSignupOverrides)
      .where(eq(eventSignupOverrides.eventId, eventId))
      .all()
      .flatMap((override) =>
        override.action === 'add' || override.action === 'remove'
          ? [[override.discordId, override.action] as const]
          : [],
      ),
  )
}

export function getParticipantGroupTag(discordId: string) {
  return getParticipantGroupBadgeMap([discordId]).get(discordId)?.tag
}

export function getParticipantGroupTagColor(discordId: string) {
  return getParticipantGroupBadgeMap([discordId]).get(discordId)?.color
}

export function getGroupAdministratorCandidateList(groupId: string): RegisteredParticipant[] {
  const normalizedGroupId = groupId.trim()
  return sqlite.prepare(`
    SELECT
      p.discord_id AS discordId,
      p.name AS name,
      currentGroup.tag AS groupTag,
      currentGroup.tag_color AS groupTagColor
    FROM participants p
    LEFT JOIN group_members currentMember
      ON currentMember.discord_id = p.discord_id
      AND currentMember.group_id = ?
      AND currentMember.status = 'member'
    LEFT JOIN groups currentGroup ON currentGroup.id = currentMember.group_id
    WHERE NOT EXISTS (
      SELECT 1
      FROM group_members gm
      WHERE gm.discord_id = p.discord_id
        AND gm.group_id != ?
        AND gm.status = 'member'
    )
    AND NOT EXISTS (
      SELECT 1
      FROM group_administrators ga
      WHERE ga.discord_id = p.discord_id
        AND ga.group_id != ?
    )
    ORDER BY p.name COLLATE NOCASE
  `).all(normalizedGroupId, normalizedGroupId, normalizedGroupId) as RegisteredParticipant[]
}

export function listGroupsForUser(discordId?: string | null): GroupSummary[] {
  const normalizedUserId = discordId?.trim() || null
  const rows = sqlite.prepare(`
    SELECT
      g.id AS id,
      g.tag AS tag,
      g.name AS name,
      g.logo_url AS logoUrl,
      g.tag_color AS tagColor,
      g.description AS description,
      COALESCE(memberCounts.memberCount, 0) AS memberCount,
      COALESCE(pendingCounts.pendingCount, 0) AS pendingCount,
      COALESCE(adminCounts.administratorCount, 0) AS administratorCount,
      currentMember.status AS currentUserStatus,
      CASE WHEN currentAdmin.discord_id IS NULL THEN 0 ELSE 1 END AS currentUserIsAdministrator
    FROM groups g
    LEFT JOIN (
      SELECT group_id, COUNT(*) AS memberCount
      FROM group_members
      WHERE status = 'member'
      GROUP BY group_id
    ) memberCounts ON memberCounts.group_id = g.id
    LEFT JOIN (
      SELECT group_id, COUNT(*) AS pendingCount
      FROM group_members
      WHERE status = 'pending'
      GROUP BY group_id
    ) pendingCounts ON pendingCounts.group_id = g.id
    LEFT JOIN (
      SELECT group_id, COUNT(*) AS administratorCount
      FROM group_administrators
      GROUP BY group_id
    ) adminCounts ON adminCounts.group_id = g.id
    LEFT JOIN group_members currentMember
      ON currentMember.group_id = g.id AND currentMember.discord_id = ?
    LEFT JOIN group_administrators currentAdmin
      ON currentAdmin.group_id = g.id AND currentAdmin.discord_id = ?
    ORDER BY g.name COLLATE NOCASE
  `).all(normalizedUserId, normalizedUserId) as Array<{
    id: string
    tag: string
    name: string
    logoUrl: string | null
    tagColor: string
    description: string
    memberCount: number
    pendingCount: number
    administratorCount: number
    currentUserStatus: string | null
    currentUserIsAdministrator: number
  }>

  return rows.map(mapGroupSummaryRow)
}

export function getGroupDetailForUser(
  groupId: string,
  discordId?: string | null,
  includePending = false,
): GroupDetail | null {
  const normalizedGroupId = groupId.trim()
  if (!normalizedGroupId) return null
  const summary = listGroupsForUser(discordId).find((group) => group.id === normalizedGroupId)
  if (!summary) return null

  return {
    ...summary,
    administrators: getGroupParticipants(normalizedGroupId, 'administrators'),
    members: getGroupParticipants(normalizedGroupId, 'members'),
    pendingMembers: includePending ? getGroupParticipants(normalizedGroupId, 'pending') : [],
  }
}

export function createGroup(values: {
  tag: string
  name: string
  description: string
  tagColor?: string | null
  logoUrl?: string | null
}) {
  const now = new Date().toISOString()
  const tag = normalizeGroupTag(values.tag)
  const name = normalizeGroupName(values.name)
  const description = normalizeGroupDescription(values.description)
  const logoUrl = normalizeGroupLogoUrl(values.logoUrl)
  const tagColor = normalizeGroupTagColor(values.tagColor)

  db.insert(groups)
    .values({
      id: randomUUID(),
      tag,
      name,
      description,
      logoUrl,
      tagColor,
      createdAt: now,
      updatedAt: now,
    })
    .run()

  return listGroupsForUser()
}

export function updateGroupProperties(
  groupId: string,
  values: {
    tag?: string
    name?: string
    description?: string
    tagColor?: string | null
    logoUrl?: string | null
  },
) {
  const group = getGroupRowOrThrow(groupId)
  const tag = values.tag === undefined ? group.tag : normalizeGroupTag(values.tag)
  const name = values.name === undefined ? group.name : normalizeGroupName(values.name)
  const description =
    values.description === undefined ? group.description : normalizeGroupDescription(values.description)
  const logoUrl = values.logoUrl === undefined ? group.logoUrl : normalizeGroupLogoUrl(values.logoUrl)
  const tagColor = values.tagColor === undefined ? group.tagColor : normalizeGroupTagColor(values.tagColor)

  db.update(groups)
    .set({
      tag,
      name,
      description,
      logoUrl,
      tagColor,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(groups.id, group.id))
    .run()

  return getGroupDetailForUser(group.id, null, true)
}

export function requestGroupMembership(groupId: string, player: { id: string; name: string; avatarUrl?: string }) {
  const group = getGroupRowOrThrow(groupId)
  ensureParticipantIdentity(player)
  const now = new Date().toISOString()
  assertPlayerIsNotInAnotherGroup(player.id, group.id)
  const existing = db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.discordId, player.id)))
    .get()

  if (existing?.status === 'member') throw new Error('You are already a member of this group.')
  if (existing?.status === 'pending') throw new Error('Your request is already pending.')

  db.insert(groupMembers)
    .values({
      groupId: group.id,
      discordId: player.id,
      status: 'pending',
      requestedAt: now,
      updatedAt: now,
    })
    .run()

  return getGroupDetailForUser(group.id, player.id, false)
}

export function acceptGroupMember(groupId: string, discordId: string) {
  const group = getGroupRowOrThrow(groupId)
  const normalizedDiscordId = requireKnownParticipant(discordId)
  assertPlayerIsNotInAnotherGroup(normalizedDiscordId, group.id)
  const existing = db
    .select()
    .from(groupMembers)
    .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.discordId, normalizedDiscordId)))
    .get()
  if (!existing) throw new Error('Join request not found.')

  db.update(groupMembers)
    .set({
      status: 'member',
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.discordId, normalizedDiscordId)))
    .run()

  return getGroupDetailForUser(group.id, null, true)
}

export function kickGroupMember(groupId: string, discordId: string) {
  const group = getGroupRowOrThrow(groupId)
  const normalizedDiscordId = discordId.trim()
  if (!normalizedDiscordId) throw new Error('Player is required.')

  db.delete(groupAdministrators)
    .where(and(eq(groupAdministrators.groupId, group.id), eq(groupAdministrators.discordId, normalizedDiscordId)))
    .run()
  db.delete(groupMembers)
    .where(and(eq(groupMembers.groupId, group.id), eq(groupMembers.discordId, normalizedDiscordId)))
    .run()

  return getGroupDetailForUser(group.id, null, true)
}

export function setGroupAdministrator(groupId: string, discordId: string, enabled: boolean) {
  const group = getGroupRowOrThrow(groupId)
  const normalizedDiscordId = requireKnownParticipant(discordId)
  const now = new Date().toISOString()

  if (enabled) {
    assertPlayerIsNotInAnotherGroup(normalizedDiscordId, group.id)
    db.insert(groupMembers)
      .values({
        groupId: group.id,
        discordId: normalizedDiscordId,
        status: 'member',
        requestedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [groupMembers.groupId, groupMembers.discordId],
        set: {
          status: 'member',
          updatedAt: now,
        },
      })
      .run()
    db.insert(groupAdministrators)
      .values({
        groupId: group.id,
        discordId: normalizedDiscordId,
        assignedAt: now,
      })
      .onConflictDoNothing()
      .run()
  } else {
    db.delete(groupAdministrators)
      .where(and(eq(groupAdministrators.groupId, group.id), eq(groupAdministrators.discordId, normalizedDiscordId)))
      .run()
  }

  return getGroupDetailForUser(group.id, null, true)
}

export function isGroupAdministrator(groupId: string, discordId: string) {
  const normalizedGroupId = groupId.trim()
  const normalizedDiscordId = discordId.trim()
  if (!normalizedGroupId || !normalizedDiscordId) return false

  return Boolean(
    db
      .select()
      .from(groupAdministrators)
      .where(
        and(
          eq(groupAdministrators.groupId, normalizedGroupId),
          eq(groupAdministrators.discordId, normalizedDiscordId),
        ),
      )
      .get(),
  )
}

function mapGroupSummaryRow(row: {
  id: string
  tag: string
  name: string
  logoUrl: string | null
  tagColor: string
  description: string
  memberCount: number
  pendingCount: number
  administratorCount: number
  currentUserStatus: string | null
  currentUserIsAdministrator: number
}): GroupSummary {
  return {
    id: row.id,
    tag: row.tag,
    name: row.name,
    logoUrl: row.logoUrl ?? undefined,
    tagColor: normalizeGroupTagColor(row.tagColor),
    description: row.description,
    memberCount: Number(row.memberCount),
    pendingCount: Number(row.pendingCount),
    administratorCount: Number(row.administratorCount),
    currentUserStatus: normalizeGroupMembershipStatus(row.currentUserStatus),
    currentUserIsAdministrator: Boolean(row.currentUserIsAdministrator),
  }
}

function getGroupParticipants(groupId: string, type: 'administrators' | 'members' | 'pending') {
  const query =
    type === 'administrators'
      ? `
        SELECT
          p.discord_id AS discordId,
          p.name AS name,
          p.avatar_url AS avatarUrl,
          g.tag AS groupTag,
          g.tag_color AS groupTagColor
        FROM group_administrators ga
        JOIN groups g ON g.id = ga.group_id
        JOIN participants p ON p.discord_id = ga.discord_id
        WHERE ga.group_id = ?
        ORDER BY p.name COLLATE NOCASE
      `
      : `
        SELECT
          p.discord_id AS discordId,
          p.name AS name,
          p.avatar_url AS avatarUrl,
          g.tag AS groupTag,
          g.tag_color AS groupTagColor
        FROM group_members gm
        JOIN groups g ON g.id = gm.group_id
        JOIN participants p ON p.discord_id = gm.discord_id
        WHERE gm.group_id = ? AND gm.status = ?
          AND NOT EXISTS (
            SELECT 1
            FROM group_administrators ga
            WHERE ga.group_id = gm.group_id
              AND ga.discord_id = gm.discord_id
          )
        ORDER BY p.name COLLATE NOCASE
      `
  const args = type === 'administrators' ? [groupId] : [groupId, type === 'members' ? 'member' : 'pending']
  const rows = sqlite.prepare(query).all(...args) as Array<{
    discordId: string
    name: string
    groupTag: string
    groupTagColor: string
    avatarUrl: string | null
  }>

  return rows.map((row) => ({
    discordId: row.discordId,
    name: row.name,
    groupTag: row.groupTag,
    groupTagColor: normalizeGroupTagColor(row.groupTagColor),
    avatarUrl: row.avatarUrl ?? undefined,
  }))
}

function getGroupRowOrThrow(groupId: string) {
  const normalizedGroupId = groupId.trim()
  if (!normalizedGroupId) throw new Error('Group is required.')
  const group = db.select().from(groups).where(eq(groups.id, normalizedGroupId)).get()
  if (!group) throw new Error('Group not found.')
  return group
}

function normalizeGroupMembershipStatus(status: string | null): GroupMembershipStatus | undefined {
  return status === 'pending' || status === 'member' ? status : undefined
}

function normalizeGroupTag(value: string) {
  const tag = value.trim().toUpperCase()
  if (!/^[A-Z0-9]{2,4}$/.test(tag)) {
    throw new Error('Group tag must be 2-4 letters or numbers.')
  }
  return tag
}

function normalizeGroupName(value: string) {
  const name = value.trim().replace(/\s+/g, ' ').slice(0, 80)
  if (!name) throw new Error('Group name is required.')
  return name
}

function normalizeGroupDescription(value: string) {
  const description = value.trim().slice(0, 2000)
  if (!description) throw new Error('Group description is required.')
  return description
}

function normalizeGroupTagColor(value?: string | null) {
  const color = String(value ?? '').trim()
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color.toLowerCase() : DEFAULT_GROUP_TAG_COLOR
}

function normalizeGroupLogoUrl(value?: string | null) {
  const logoUrl = value?.trim()
  if (!logoUrl) return undefined
  return persistGroupLogoReference(logoUrl)
}

function ensureParticipantIdentity(player: { id: string; name: string; avatarUrl?: string }) {
  const normalizedId = player.id.trim()
  if (!normalizedId) throw new Error('Discord login required.')
  const existing = db.select().from(participants).where(eq(participants.discordId, normalizedId)).get()
  if (existing) return
  upsertParticipantProfileIdentity(normalizedId, player.name, player.avatarUrl)
}

function requireKnownParticipant(discordId: string) {
  const normalizedDiscordId = discordId.trim()
  if (!normalizedDiscordId) throw new Error('Player is required.')
  const participant = db.select().from(participants).where(eq(participants.discordId, normalizedDiscordId)).get()
  if (!participant) throw new Error('Player not found.')
  return normalizedDiscordId
}

function assertPlayerIsNotInAnotherGroup(discordId: string, groupId: string) {
  const normalizedDiscordId = discordId.trim()
  const normalizedGroupId = groupId.trim()
  if (!normalizedDiscordId || !normalizedGroupId) return

  const membership = sqlite.prepare(`
    SELECT g.name AS groupName
    FROM group_members gm
    JOIN groups g ON g.id = gm.group_id
    WHERE gm.discord_id = ?
      AND gm.group_id != ?
      AND gm.status = 'member'
    LIMIT 1
  `).get(normalizedDiscordId, normalizedGroupId) as { groupName: string } | undefined
  if (membership) {
    throw new Error(`Player must leave ${membership.groupName} before joining another group.`)
  }

  const administration = sqlite.prepare(`
    SELECT g.name AS groupName
    FROM group_administrators ga
    JOIN groups g ON g.id = ga.group_id
    WHERE ga.discord_id = ?
      AND ga.group_id != ?
    LIMIT 1
  `).get(normalizedDiscordId, normalizedGroupId) as { groupName: string } | undefined
  if (administration) {
    throw new Error(`Player must leave ${administration.groupName} before joining another group.`)
  }
}

export function getEventParticipantNameOverrides(eventId: string): RegisteredParticipant[] {
  const participantRows = db
    .select()
    .from(eventParticipants)
    .where(and(eq(eventParticipants.eventId, eventId), eq(eventParticipants.disqualified, false)))
    .all()
  const participantIds = new Set(participantRows.map((participant) => participant.discordId))

  return db
    .select()
    .from(participants)
    .all()
    .filter(
      (participant) =>
        participantIds.has(participant.discordId) &&
        Boolean(participant.nameOverridden),
    )
    .map((participant) => ({
      discordId: participant.discordId,
      name: participant.name,
    }))
}

export function getAdminPlayerCharacterConfigs(): AdminPlayerCharacterConfig[] {
  return getRegisteredPlayerList().map((player) => {
    const profile = db.select().from(playerProfiles).where(eq(playerProfiles.discordId, player.discordId)).get()

    return {
      discordId: player.discordId,
      name: player.name,
      groupTag: player.groupTag,
      groupTagColor: player.groupTagColor,
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

export function upsertParticipantProfileIdentity(
  discordId: string,
  name: string,
  avatarUrl?: string | null,
  roleIds?: string[],
) {
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
  replaceParticipantRoleIds(normalizedId, roleIds ?? [], now)

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

export function getLastDiscordGuildMemberRoleRefreshAt() {
  return getAppSetting(DISCORD_ROLE_REFRESHED_AT_SETTING_KEY)
}

export function replaceKnownParticipantDiscordRoleIds(
  memberRoles: Array<{ discordId: string; roleIds: string[] }>,
) {
  const now = new Date().toISOString()
  const rolesByDiscordId = new Map(
    memberRoles
      .map((member) => [member.discordId.trim(), member.roleIds] as const)
      .filter(([discordId]) => Boolean(discordId)),
  )
  const participantIds = db
    .select({ discordId: participants.discordId })
    .from(participants)
    .all()
    .map((participant) => participant.discordId)

  for (const discordId of participantIds) {
    replaceParticipantRoleIds(discordId, rolesByDiscordId.get(discordId) ?? [], now)
    db.update(participants).set({ updatedAt: now }).where(eq(participants.discordId, discordId)).run()
  }

  setAppSetting(DISCORD_ROLE_REFRESHED_AT_SETTING_KEY, now)
  syncSystemBadgeAssignments()

  return {
    refreshedAt: now,
    guildMemberCount: rolesByDiscordId.size,
    updatedParticipantCount: participantIds.length,
  }
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
  const groupBadge = getParticipantGroupBadgeMap([discordId]).get(discordId)

  return {
    discordId,
    name: participant?.name ?? discordId,
    groupTag: groupBadge?.tag,
    groupTagColor: groupBadge?.color,
    avatarUrl: participant?.avatarUrl ?? undefined,
    bannerUrl: normalizeProfileBanner(profile?.bannerUrl),
    catchphrase: profile?.catchphrase ?? '',
    noPersonalJaegerAccount: Boolean(profile?.noPersonalJaegerAccount),
    characters: getPlayerCharacters(discordId),
    badges,
    badgeDisplayOrder: getVisibleBadges(discordId, badges).map((badge) => badge.id),
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

  db.update(playerProfiles)
    .set({
      bannerUrl,
      catchphrase,
      noPersonalJaegerAccount,
      updatedAt: now,
    })
    .where(eq(playerProfiles.discordId, discordId))
    .run()
  if (values.badgeDisplayOrder !== undefined) {
    replaceBadgeDisplayPreferences(
      discordId,
      normalizeBadgeDisplayPreferences(discordId, values.badgeDisplayOrder),
      now,
    )
  }

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
    WITH player_character_counts AS (
      SELECT discord_id, COUNT(*) AS characterCount
      FROM player_characters
      GROUP BY discord_id
    )
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
    LEFT JOIN player_profiles pp ON pp.discord_id = ep.discord_id
    LEFT JOIN player_character_counts pcc ON pcc.discord_id = ep.discord_id
    LEFT JOIN participants p ON p.discord_id = ep.discord_id
    LEFT JOIN event_player_characters ec
      ON ec.event_id = ep.event_id AND ec.discord_id = ep.discord_id
    WHERE
      ep.event_id = ?
      AND ep.disqualified = 0
      AND (
        COALESCE(pp.no_personal_jaeger_account, 0) = 1
        OR COALESCE(pcc.characterCount, 0) = 0
      )
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

  const groupBadges = getParticipantGroupBadgeMap(rows.map((row) => row.discordId))
  const assignments = new Map<string, EventPlayerCharacterAssignment>()
  for (const row of rows) {
    const groupBadge = groupBadges.get(row.discordId)
    const item = assignments.get(row.discordId) ?? {
      eventId: row.eventId,
      discordId: row.discordId,
      playerName: row.playerName,
      groupTag: groupBadge?.tag,
      groupTagColor: groupBadge?.color,
      noPersonalJaegerAccount: Boolean(row.noPersonalJaegerAccount),
      assignments: [],
    }
    if (row.faction && row.characterId && row.characterName && row.assignedAt) {
      item.assignments.push({
        faction: normalizeRequiredFaction(row.faction),
        characterId: row.characterId,
        characterName: row.characterName,
        resolvedAt: row.assignedAt,
      })
    }
    assignments.set(row.discordId, item)
  }

  return Array.from(assignments.values()).map((item) => {
    const sorted = item.assignments.sort((a, b) => factionOrder(a.faction) - factionOrder(b.faction))
    return { ...item, assignments: sorted, assignment: sorted[0] }
  })
}

export function getEventPlayerCharacterExportRows(eventId: string): Array<{
  teamId: string
  teamName: string
  playerName: string
  characterId: string
}> {
  const rows = sqlite.prepare(`
    WITH team_members AS (
      SELECT
        t.event_id AS eventId,
        t.id AS teamId,
        t.name AS teamName,
        t.faction AS currentFaction,
        t.captain_discord_id AS discordId
      FROM teams t
      WHERE
        t.event_id = ?
        AND t.faction IS NOT NULL
        AND t.captain_discord_id IS NOT NULL
        AND t.captain_discord_id != ''
      UNION
      SELECT
        t.event_id AS eventId,
        t.id AS teamId,
        t.name AS teamName,
        t.faction AS currentFaction,
        dp.player_discord_id AS discordId
      FROM draft_picks dp
      JOIN teams t ON t.id = dp.team_id
      WHERE t.event_id = ? AND t.faction IS NOT NULL
    )
    SELECT
      tm.teamId,
      tm.teamName,
      COALESCE(p.name, ep.name, tm.discordId) AS playerName,
      COALESCE(
        CASE
          WHEN (
              COALESCE(pp.no_personal_jaeger_account, 0) = 1
              OR COALESCE(pcc.characterCount, 0) = 0
            )
            AND ec.faction = tm.currentFaction
          THEN ec.character_id
        END,
        CASE
          WHEN COALESCE(pp.no_personal_jaeger_account, 0) = 0
            AND COALESCE(pcc.characterCount, 0) > 0
          THEN pc.character_id
        END,
        ''
      ) AS characterId
    FROM team_members tm
    JOIN event_participants ep
      ON ep.event_id = tm.eventId
      AND ep.discord_id = tm.discordId
      AND ep.disqualified = 0
    LEFT JOIN participants p ON p.discord_id = tm.discordId
    LEFT JOIN player_profiles pp ON pp.discord_id = tm.discordId
    LEFT JOIN (
      SELECT discord_id, COUNT(*) AS characterCount
      FROM player_characters
      GROUP BY discord_id
    ) pcc ON pcc.discord_id = tm.discordId
    LEFT JOIN event_player_characters ec
      ON ec.event_id = tm.eventId
      AND ec.discord_id = tm.discordId
      AND ec.faction = tm.currentFaction
    LEFT JOIN player_characters pc
      ON pc.discord_id = tm.discordId
      AND pc.faction = tm.currentFaction
    ORDER BY tm.teamName COLLATE NOCASE, playerName COLLATE NOCASE
  `).all(eventId, eventId) as Array<{
    teamId: string
    teamName: string
    playerName: string
    characterId: string | null
  }>

  return rows.map((row) => ({
    teamId: row.teamId,
    teamName: row.teamName,
    playerName: row.playerName,
    characterId: row.characterId ?? '',
  }))
}

export function saveEventPlayerCharacterAssignment(
  eventId: string,
  discordId: string,
  character: PlayerCharacter,
) {
  return saveEventPlayerCharacterAssignments(eventId, discordId, [character])
}

export function saveEventPlayerCharacterAssignments(
  eventId: string,
  discordId: string,
  characters: PlayerCharacter[],
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
  if (!profile?.noPersonalJaegerAccount && getPlayerCharacters(discordId).length > 0) {
    throw new Error('Player has configured personal Jaeger characters.')
  }

  const seen = new Set<Faction>()
  const assignedAt = new Date().toISOString()
  for (const character of characters) {
    if (seen.has(character.faction)) throw new Error(`Duplicate ${character.faction} character.`)
    seen.add(character.faction)
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
        target: [
          eventPlayerCharacters.eventId,
          eventPlayerCharacters.discordId,
          eventPlayerCharacters.faction,
        ],
        set: {
          characterId: character.characterId,
          characterName: character.characterName,
          assignedAt,
        },
      })
      .run()
  }

  return getEventPlayerCharacterAssignments(eventId)
}

export function markEventHonuAlertCreated(eventId: string, alertId: number) {
  const now = new Date().toISOString()
  db.update(events)
    .set({
      honuAlertId: alertId,
      honuAlertCreatedAt: now,
      updatedAt: now,
    })
    .where(eq(events.id, eventId))
    .run()
}

export async function saveDueHonuTeamReports(event: HammaEvent) {
  if (!isHonuReportDue(event)) return { ok: true, reportCount: 0 }
  return saveHonuTeamReports(event.id)
}

export async function getPendingHonuAlertEvents(): Promise<HammaEvent[]> {
  const rows = sqlite.prepare(`
    SELECT id
    FROM events
    WHERE
      EXISTS (
        SELECT 1
        FROM event_rounds
        WHERE event_rounds.event_id = events.id
      )
    ORDER BY starts_at DESC
    LIMIT 20
  `).all() as Array<{ id: string }>

  const hydrated = await Promise.all(rows.map((row) => getDbEvent(row.id)))
  return hydrated.filter((event): event is HammaEvent => Boolean(event))
}

export function getHonuPsbAccountCacheUpdatedAt() {
  return getAppSetting('honu_psb_accounts_updated_at')
}

export function replaceHonuPsbAccountCache(accounts: HonuPsbAccountCacheRow[]) {
  const now = new Date().toISOString()
  const insert = sqlite.prepare(`
    INSERT INTO honu_psb_accounts (
      account_id,
      account_type,
      tag,
      name,
      player_name,
      vs_id,
      vs_name,
      nc_id,
      nc_name,
      tr_id,
      tr_name,
      ns_id,
      ns_name,
      deleted_at,
      raw_json,
      updated_at
    ) VALUES (
      @accountId,
      @accountType,
      @tag,
      @name,
      @playerName,
      @vsId,
      @vsName,
      @ncId,
      @ncName,
      @trId,
      @trName,
      @nsId,
      @nsName,
      @deletedAt,
      @rawJson,
      @updatedAt
    )
  `)

  sqlite.transaction(() => {
    sqlite.prepare('DELETE FROM honu_psb_accounts').run()
    for (const account of accounts) {
      insert.run({
        ...account,
        updatedAt: now,
      })
    }
    setAppSetting('honu_psb_accounts_updated_at', now)
  })()
}

export interface HonuPsbAccountCacheRow {
  accountId: number
  accountType: number
  tag: string
  name: string
  playerName: string
  vsId: string | null
  vsName: string | null
  ncId: string | null
  ncName: string | null
  trId: string | null
  trName: string | null
  nsId: string | null
  nsName: string | null
  deletedAt: string | null
  rawJson: string
}

export function searchHonuPsbAccounts(query = '', limit = 10): HonuPsbAccountSuggestion[] {
  const normalized = query.trim().toLowerCase()
  const maxResults = Math.max(1, Math.min(10, Math.floor(limit)))
  const searchLike = `%${normalized.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`
  const rows = normalized
    ? sqlite.prepare(`
        SELECT *
        FROM honu_psb_accounts
        WHERE
          deleted_at IS NULL
          AND (
            lower(player_name) LIKE ? ESCAPE '\\'
            OR lower(name) LIKE ? ESCAPE '\\'
            OR lower(tag) LIKE ? ESCAPE '\\'
            OR lower(tag || 'x' || name) LIKE ? ESCAPE '\\'
            OR lower(coalesce(vs_name, '')) LIKE ? ESCAPE '\\'
            OR lower(coalesce(nc_name, '')) LIKE ? ESCAPE '\\'
            OR lower(coalesce(tr_name, '')) LIKE ? ESCAPE '\\'
          )
        ORDER BY
          CASE
            WHEN lower(player_name) = ? THEN 0
            WHEN lower(name) = ? THEN 1
            WHEN lower(tag || 'x' || name) = ? THEN 2
            WHEN lower(player_name) LIKE ? ESCAPE '\\' THEN 3
            ELSE 4
          END,
          player_name COLLATE NOCASE,
          tag COLLATE NOCASE,
          name COLLATE NOCASE
        LIMIT ?
      `).all(
        searchLike,
        searchLike,
        searchLike,
        searchLike,
        searchLike,
        searchLike,
        searchLike,
        normalized,
        normalized,
        normalized,
        `${normalized.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`,
        maxResults,
      )
    : sqlite.prepare(`
        SELECT *
        FROM honu_psb_accounts
        WHERE deleted_at IS NULL
        ORDER BY player_name COLLATE NOCASE, tag COLLATE NOCASE, name COLLATE NOCASE
        LIMIT ?
      `).all(maxResults)

  return (rows as HonuPsbAccountDbRow[]).map(honuPsbAccountSuggestionFromRow)
}

interface HonuPsbAccountDbRow {
  account_id: number
  tag: string
  name: string
  player_name: string
  vs_id: string | null
  vs_name: string | null
  nc_id: string | null
  nc_name: string | null
  tr_id: string | null
  tr_name: string | null
  updated_at: string
}

function honuPsbAccountSuggestionFromRow(row: HonuPsbAccountDbRow): HonuPsbAccountSuggestion {
  const characters: PlayerCharacter[] = []
  if (row.tr_id && row.tr_name) {
    characters.push({
      faction: 'TR',
      characterId: row.tr_id,
      characterName: row.tr_name,
      resolvedAt: row.updated_at,
    })
  }
  if (row.vs_id && row.vs_name) {
    characters.push({
      faction: 'VS',
      characterId: row.vs_id,
      characterName: row.vs_name,
      resolvedAt: row.updated_at,
    })
  }
  if (row.nc_id && row.nc_name) {
    characters.push({
      faction: 'NC',
      characterId: row.nc_id,
      characterName: row.nc_name,
      resolvedAt: row.updated_at,
    })
  }

  return {
    accountId: row.account_id,
    tag: row.tag,
    name: row.name,
    playerName: row.player_name,
    label: `${row.tag}x${row.name}`,
    characters,
    updatedAt: row.updated_at,
  }
}

export function searchPlayerProfiles(query = ''): PlayerProfileSummary[] {
  const normalized = query.trim().toLowerCase()
  const rows = sqlite.prepare(`
    SELECT
      p.discord_id AS discordId,
      p.name AS name,
      p.avatar_url AS avatarUrl,
      pp.catchphrase AS catchphrase,
      pp.banner_url AS bannerUrl,
      COALESCE(events.eventCount, 0) AS eventCount,
      COALESCE(wins.winCount, 0) AS winCount,
      ratings.averageRating AS averageRating,
      COALESCE(characters.characterCount, 0) AS characterCount
    FROM participants p
    LEFT JOIN player_profiles pp ON pp.discord_id = p.discord_id
    LEFT JOIN (
      SELECT ep.discord_id, COUNT(*) AS eventCount
      FROM event_participants ep
      JOIN events e ON e.id = ep.event_id
      WHERE ep.disqualified = 0 AND e.phase = 'complete'
      GROUP BY ep.discord_id
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
    bannerUrl: string | null
    eventCount: number
    winCount: number
    averageRating: number | null
    characterCount: number
  }>

  const groupBadges = getParticipantGroupBadgeMap(rows.map((row) => row.discordId))

  return rows.map((row) => {
    const badges = getPlayerBadges(row.discordId)
    const groupBadge = groupBadges.get(row.discordId)

    return {
      discordId: row.discordId,
      name: row.name,
      groupTag: groupBadge?.tag,
      groupTagColor: groupBadge?.color,
      avatarUrl: row.avatarUrl ?? undefined,
      bannerUrl: row.bannerUrl ?? undefined,
      catchphrase: row.catchphrase ?? undefined,
      eventCount: Number(row.eventCount),
      winCount: Number(row.winCount),
      averageRating: row.averageRating === null ? null : Number(row.averageRating),
      characterCount: Number(row.characterCount),
      badges: getVisibleBadges(row.discordId, badges).slice(0, 3),
      events: getPlayerProfileEvents(row.discordId),
    }
  })
}

function getPlayerProfileEvents(discordId: string) {
  return sqlite.prepare(`
    SELECT
      e.id AS id,
      COALESCE(e.name_override, e.name) AS name,
      e.starts_at AS startsAt
    FROM event_participants ep
    JOIN events e ON e.id = ep.event_id
    WHERE ep.discord_id = ? AND ep.disqualified = 0 AND e.phase = 'complete'
    ORDER BY e.starts_at DESC
  `).all(discordId) as Array<{
    id: string
    name: string
    startsAt: string
  }>
}

export function getPlayerProfile(discordId: string): PlayerProfile | null {
  const participant = db.select().from(participants).where(eq(participants.discordId, discordId)).get()
  if (!participant) return null
  const profile = db.select().from(playerProfiles).where(eq(playerProfiles.discordId, discordId)).get()
  const groupBadge = getParticipantGroupBadgeMap([discordId]).get(discordId)
  const history = getRatingHistory(discordId)
  const hammaStats = getHammaCombatStats(discordId)
  const badges = getPlayerBadges(discordId)
  const averageRating = history.length
    ? history.reduce((sum, item) => sum + item.averageRating, 0) / history.length
    : null

  return {
    discordId,
    name: participant.name,
    groupId: groupBadge?.id,
    groupName: groupBadge?.name,
    groupTag: groupBadge?.tag,
    groupTagColor: groupBadge?.color,
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
    badges: getVisibleBadges(discordId, badges),
  }
}

export function getAdminBadgeManagerData(): AdminBadgeManagerData {
  syncSystemBadgeAssignments()
  const badges = db
    .select()
    .from(badgeDefinitions)
    .all()
    .map((badge) => ({
      id: badge.id,
      name: badge.name,
      description: badge.description,
      color: normalizeBadgeColor(badge.color),
      source: badge.source === 'system' ? 'system' as const : 'manual' as const,
      createdAt: badge.createdAt,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const participantRows = db.select().from(participants).all()
  const playerGroupBadges = getParticipantGroupBadgeMap(participantRows.map((participant) => participant.discordId))
  const players = participantRows
    .map((participant) => {
      const groupBadge = playerGroupBadges.get(participant.discordId)
      return {
        discordId: participant.discordId,
        name: participant.name,
        groupTag: groupBadge?.tag,
        groupTagColor: groupBadge?.color,
      }
    })
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
  const assignmentGroupBadges = getParticipantGroupBadgeMap(assignments.map((assignment) => assignment.discordId))
  for (const assignment of assignments) {
    const groupBadge = assignmentGroupBadges.get(assignment.discordId)
    assignment.groupTag = groupBadge?.tag
    assignment.groupTagColor = groupBadge?.color
  }

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

export function updateBadgeDefinition(
  badgeId: string,
  values: { name?: string; description?: string; color?: string },
) {
  const badge = db.select().from(badgeDefinitions).where(eq(badgeDefinitions.id, badgeId)).get()
  if (!badge) throw new Error('Badge not found.')
  const name = normalizeOptionalBadgeField(values.name, 48) ?? badge.name
  const description = normalizeOptionalBadgeField(values.description, 160) ?? badge.description
  if (!name) throw new Error('Badge name is required.')
  if (!description) throw new Error('Badge description is required.')

  db.update(badgeDefinitions)
    .set({
      name,
      description,
      color: normalizeBadgeColor(values.color ?? badge.color),
    })
    .where(eq(badgeDefinitions.id, badgeId))
    .run()

  return getAdminBadgeManagerData()
}

export function deleteManualBadge(badgeId: string) {
  const badge = db.select().from(badgeDefinitions).where(eq(badgeDefinitions.id, badgeId)).get()
  if (!badge) throw new Error('Badge not found.')
  if (badge.source !== 'manual') throw new Error('System badges cannot be deleted.')

  db.delete(badgeDefinitions)
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
      source: badge.source === 'system' ? 'system' as const : 'manual' as const,
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

  const groupBadge = getParticipantGroupBadgeMap([normalizedId]).get(normalizedId)

  return {
    player: {
      discordId: participant.discordId,
      name: participant.name,
      groupTag: groupBadge?.tag,
      groupTagColor: groupBadge?.color,
    },
    catchphrase: profile?.catchphrase ?? '',
    badges,
    assignedBadgeIds,
    visibleBadges: getVisibleBadges(normalizedId, playerBadges),
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

export function syncSystemBadgeAssignmentsForUser(discordId: string, roles: Role[]) {
  ensureSystemBadges()
  const normalizedId = discordId.trim()
  if (!normalizedId) return

  const roleSet = new Set(roles)
  setSystemBadgeAssignment(normalizedId, ADMIN_BADGE_ID, roleSet.has('admin'))
  setSystemBadgeAssignment(normalizedId, MOD_BADGE_ID, roleSet.has('mod'))
}

function syncSystemBadgeAssignments() {
  ensureSystemBadges()
  const adminIds = new Set(envList('DISCORD_ADMIN_USER_IDS'))
  const modRoleId = env('DISCORD_MOD_ROLE_ID')
  const adminAssignments = db
    .select()
    .from(playerBadgeAssignments)
    .where(eq(playerBadgeAssignments.badgeId, ADMIN_BADGE_ID))
    .all()
  const modAssignments = db
    .select()
    .from(playerBadgeAssignments)
    .where(eq(playerBadgeAssignments.badgeId, MOD_BADGE_ID))
    .all()
  const modIds = new Set(
    modRoleId
      ? db.select()
        .from(participants)
        .all()
        .filter((participant) => getParticipantRoleIds(participant.discordId).includes(modRoleId))
        .map((participant) => participant.discordId)
      : [],
  )

  for (const discordId of adminIds) {
    setSystemBadgeAssignment(discordId, ADMIN_BADGE_ID, true)
  }
  for (const assignment of adminAssignments) {
    if (!adminIds.has(assignment.discordId)) {
      setSystemBadgeAssignment(assignment.discordId, ADMIN_BADGE_ID, false)
    }
  }
  for (const discordId of modIds) {
    setSystemBadgeAssignment(discordId, MOD_BADGE_ID, true)
  }
  for (const assignment of modAssignments) {
    if (!modIds.has(assignment.discordId)) {
      setSystemBadgeAssignment(assignment.discordId, MOD_BADGE_ID, false)
    }
  }
}

function setSystemBadgeAssignment(discordId: string, badgeId: string, assigned: boolean) {
  const normalizedId = discordId.trim()
  if (!normalizedId) return

  if (!assigned) {
    db.delete(playerBadgeAssignments)
      .where(and(eq(playerBadgeAssignments.badgeId, badgeId), eq(playerBadgeAssignments.discordId, normalizedId)))
      .run()
    return
  }

  db.insert(playerBadgeAssignments)
    .values({
      badgeId,
      discordId: normalizedId,
      assignedAt: new Date().toISOString(),
    })
    .onConflictDoNothing()
    .run()
}

function ensureSystemBadges() {
  const now = new Date().toISOString()
  for (const badge of SYSTEM_BADGES) {
    const existing = db.select().from(badgeDefinitions).where(eq(badgeDefinitions.id, badge.id)).get()
    if (existing) {
      if (existing.source !== 'system') {
        db.update(badgeDefinitions)
          .set({ source: 'system' })
          .where(eq(badgeDefinitions.id, badge.id))
          .run()
      }
      continue
    }

    db.insert(badgeDefinitions)
      .values({
        ...badge,
        source: 'system',
        createdAt: now,
      })
      .run()
  }
}

function parseLegacyRoleIds(value?: string | null) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed.filter((roleId): roleId is string => typeof roleId === 'string') : []
  } catch {
    return []
  }
}

function parseLegacyBadgeDisplayPreferences(value?: string | null) {
  if (!value) return { order: [], hidden: [] }

  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) {
      return {
        order: parsed.filter((item): item is string => typeof item === 'string'),
        hidden: [],
      }
    }
    if (parsed && typeof parsed === 'object') {
      const record = parsed as { order?: unknown; hidden?: unknown }
      return {
        order: Array.isArray(record.order)
          ? record.order.filter((item): item is string => typeof item === 'string')
          : [],
        hidden: Array.isArray(record.hidden)
          ? record.hidden.filter((item): item is string => typeof item === 'string')
          : [],
      }
    }
  } catch {
    return { order: [], hidden: [] }
  }

  return { order: [], hidden: [] }
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

function getParticipantGroupBadgeMap(discordIds: string[]) {
  const wanted = Array.from(new Set(discordIds.map((id) => id.trim()).filter(Boolean)))
  if (!wanted.length) return new Map<string, { id: string; name: string; tag: string; color: string }>()

  const rows = sqlite.prepare(`
    SELECT
      gm.discord_id AS discordId,
      g.id AS groupId,
      g.name AS groupName,
      g.tag AS groupTag,
      g.tag_color AS groupTagColor
    FROM group_members gm
    JOIN groups g ON g.id = gm.group_id
    WHERE gm.status = 'member'
  `).all() as Array<{
    discordId: string
    groupId: string
    groupName: string
    groupTag: string
    groupTagColor: string | null
  }>

  const wantedIds = new Set(wanted)
  return new Map(
    rows
      .filter((row) => wantedIds.has(row.discordId))
      .map((row) => [
        row.discordId,
        {
          id: row.groupId,
          name: row.groupName,
          tag: row.groupTag,
          color: normalizeGroupTagColor(row.groupTagColor),
        },
      ]),
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
    .prepare(`
      SELECT COUNT(*) AS count
      FROM event_participants ep
      JOIN events e ON e.id = ep.event_id
      WHERE ep.discord_id = ? AND ep.disqualified = 0 AND e.phase = 'complete'
    `)
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
      description: 'Team spent most of a bonus cap on one player.',
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
    source: row.source === 'system' ? 'system' : 'manual',
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

function getVisibleBadges(discordId: string, badges: PlayerBadge[]) {
  const preferences = db
    .select()
    .from(playerBadgeDisplayPreferences)
    .where(eq(playerBadgeDisplayPreferences.discordId, discordId))
    .all()
  if (!preferences.length) return badges

  const order = preferences
    .filter((preference) => !preference.hidden && typeof preference.position === 'number')
    .sort((a, b) => Number(a.position) - Number(b.position) || a.badgeId.localeCompare(b.badgeId))
    .map((preference) => preference.badgeId)
  const hidden = new Set(
    preferences
      .filter((preference) => preference.hidden)
      .map((preference) => preference.badgeId),
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

function normalizeOptionalBadgeField(value: string | undefined, maxLength: number) {
  if (value === undefined) return null
  return value.trim().slice(0, maxLength)
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
      raid_helper_channel_id TEXT,
      discord_check_in_message_id TEXT,
      discord_check_in_message_channel_id TEXT,
      name TEXT NOT NULL,
      name_override TEXT,
      server TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      ends_at TEXT,
      closing_time TEXT,
      draft_start_minutes_before INTEGER,
      round_count INTEGER NOT NULL DEFAULT 3,
      round_duration_seconds INTEGER NOT NULL DEFAULT 900,
      phase TEXT NOT NULL DEFAULT 'signups',
      salary_pool INTEGER NOT NULL DEFAULT ${SALARY_POOL},
      bonus_pool INTEGER NOT NULL DEFAULT ${BONUS_POOL},
      max_player_bonus INTEGER NOT NULL DEFAULT ${MAX_PLAYER_BONUS},
      bid_increment INTEGER NOT NULL DEFAULT ${BID_INCREMENT},
      pending_signup_count INTEGER NOT NULL DEFAULT 0,
      next_pick_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
      winning_team_id TEXT,
      twitch_stream_url TEXT,
      twitch_vod_url TEXT,
      event_description TEXT,
      trophy_id TEXT NOT NULL DEFAULT 'hammo-bowl-cup',
      lore TEXT,
      honu_zone_id INTEGER NOT NULL DEFAULT ${HONU_DEFAULT_ZONE_ID},
      honu_alert_id INTEGER,
      honu_alert_created_at TEXT,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS event_available_factions (
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      faction TEXT NOT NULL,
      position INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (event_id, faction)
    );
    CREATE TABLE IF NOT EXISTS event_available_sides (
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      side TEXT NOT NULL,
      position INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (event_id, side)
    );
    CREATE TABLE IF NOT EXISTS event_available_specs (
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      spec_name TEXT NOT NULL,
      position INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (event_id, spec_name)
    );
    CREATE TABLE IF NOT EXISTS event_links (
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      position INTEGER NOT NULL,
      name TEXT NOT NULL,
      icon TEXT NOT NULL,
      url TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (event_id, position)
    );
    CREATE TABLE IF NOT EXISTS participants (
      discord_id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar_url TEXT,
      name_overridden INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS groups (
      id TEXT PRIMARY KEY,
      tag TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      logo_url TEXT,
      tag_color TEXT NOT NULL DEFAULT '${DEFAULT_GROUP_TAG_COLOR}',
      description TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS group_members (
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      discord_id TEXT NOT NULL REFERENCES participants(discord_id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending',
      requested_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (group_id, discord_id)
    );
    CREATE INDEX IF NOT EXISTS idx_group_members_status
      ON group_members(group_id, status);
    CREATE TABLE IF NOT EXISTS group_administrators (
      group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
      discord_id TEXT NOT NULL REFERENCES participants(discord_id) ON DELETE CASCADE,
      assigned_at TEXT NOT NULL,
      PRIMARY KEY (group_id, discord_id)
    );
    CREATE TABLE IF NOT EXISTS participant_role_ids (
      discord_id TEXT NOT NULL REFERENCES participants(discord_id) ON DELETE CASCADE,
      role_id TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (discord_id, role_id)
    );
    CREATE TABLE IF NOT EXISTS player_profiles (
      discord_id TEXT PRIMARY KEY,
      banner_url TEXT,
      catchphrase TEXT,
      no_personal_jaeger_account INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS player_badge_display_preferences (
      discord_id TEXT NOT NULL REFERENCES player_profiles(discord_id) ON DELETE CASCADE,
      badge_id TEXT NOT NULL,
      position INTEGER,
      hidden INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (discord_id, badge_id)
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
      PRIMARY KEY (event_id, discord_id, faction)
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
      checked_in_at TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (event_id, discord_id)
    );
    CREATE TABLE IF NOT EXISTS event_signup_overrides (
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      discord_id TEXT NOT NULL,
      action TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (event_id, discord_id)
    );
    CREATE TABLE IF NOT EXISTS event_participant_specs (
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      discord_id TEXT NOT NULL,
      spec_name TEXT NOT NULL,
      position INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (event_id, discord_id, spec_name)
    );
    CREATE INDEX IF NOT EXISTS idx_event_participant_specs_event_spec
      ON event_participant_specs(event_id, spec_name);
    CREATE TABLE IF NOT EXISTS teams (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      captain_discord_id TEXT,
      faction TEXT,
      starting_side TEXT,
      budget INTEGER NOT NULL DEFAULT ${TEAM_BUDGET},
      bonus_cap INTEGER NOT NULL DEFAULT ${BONUS_CAP},
      score INTEGER NOT NULL DEFAULT 0,
      honu_report_url TEXT,
      honu_report_created_at TEXT
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
      opened_by_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
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
    CREATE TABLE IF NOT EXISTS event_rounds (
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      round_number INTEGER NOT NULL,
      started_at TEXT NOT NULL,
      duration_seconds INTEGER NOT NULL,
      winning_team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
      result_note TEXT,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (event_id, round_number)
    );
    CREATE TABLE IF NOT EXISTS event_round_scores (
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      round_number INTEGER NOT NULL,
      team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      score INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (event_id, round_number, team_id)
    );
    CREATE TABLE IF NOT EXISTS honu_psb_accounts (
      account_id INTEGER PRIMARY KEY,
      account_type INTEGER NOT NULL,
      tag TEXT NOT NULL,
      name TEXT NOT NULL,
      player_name TEXT NOT NULL,
      vs_id TEXT,
      vs_name TEXT,
      nc_id TEXT,
      nc_name TEXT,
      tr_id TEXT,
      tr_name TEXT,
      ns_id TEXT,
      ns_name TEXT,
      deleted_at TEXT,
      raw_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_honu_psb_accounts_search
      ON honu_psb_accounts(player_name, tag, name);
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
  addColumnIfMissing('events', 'raid_helper_channel_id', 'TEXT')
  addColumnIfMissing('events', 'discord_check_in_message_id', 'TEXT')
  addColumnIfMissing('events', 'discord_check_in_message_channel_id', 'TEXT')
  addColumnIfMissing('events', 'ends_at', 'TEXT')
  addColumnIfMissing('events', 'draft_start_minutes_before', 'INTEGER')
  addColumnIfMissing('events', 'round_count', 'INTEGER NOT NULL DEFAULT 3')
  addColumnIfMissing('events', 'round_duration_seconds', 'INTEGER NOT NULL DEFAULT 900')
  addColumnIfMissing('events', 'pending_signup_count', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing('events', 'bonus_pool', `INTEGER NOT NULL DEFAULT ${BONUS_POOL}`)
  addColumnIfMissing('events', 'max_player_bonus', `INTEGER NOT NULL DEFAULT ${MAX_PLAYER_BONUS}`)
  addColumnIfMissing('events', 'bid_increment', `INTEGER NOT NULL DEFAULT ${BID_INCREMENT}`)
  addColumnIfMissing('events', 'next_pick_team_id', 'TEXT REFERENCES teams(id) ON DELETE SET NULL')
  addColumnIfMissing('events', 'winning_team_id', 'TEXT')
  addColumnIfMissing('events', 'twitch_stream_url', 'TEXT')
  addColumnIfMissing('events', 'twitch_vod_url', 'TEXT')
  addColumnIfMissing('events', 'event_description', 'TEXT')
  addColumnIfMissing('events', 'trophy_id', "TEXT NOT NULL DEFAULT 'hammo-bowl-cup'")
  addColumnIfMissing('events', 'lore', 'TEXT')
  addColumnIfMissing('events', 'honu_zone_id', `INTEGER NOT NULL DEFAULT ${HONU_DEFAULT_ZONE_ID}`)
  addColumnIfMissing('events', 'honu_alert_id', 'INTEGER')
  addColumnIfMissing('events', 'honu_alert_created_at', 'TEXT')
  addColumnIfMissing('teams', 'honu_report_url', 'TEXT')
  addColumnIfMissing('teams', 'honu_report_created_at', 'TEXT')
  addColumnIfMissing('participants', 'avatar_url', 'TEXT')
  addColumnIfMissing('participants', 'name_overridden', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing('groups', 'tag_color', `TEXT NOT NULL DEFAULT '${DEFAULT_GROUP_TAG_COLOR}'`)
  addColumnIfMissing('player_profiles', 'no_personal_jaeger_account', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing('badge_definitions', 'color', "TEXT NOT NULL DEFAULT '#e4b45e'")
  addColumnIfMissing('badge_definitions', 'source', "TEXT NOT NULL DEFAULT 'manual'")
  addColumnIfMissing('event_participants', 'winner', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing('event_participants', 'checked_in_at', 'TEXT')
  addColumnIfMissing('coinflips', 'calling_team_id', 'TEXT REFERENCES teams(id) ON DELETE SET NULL')
  addColumnIfMissing('coinflips', 'caller_call', 'TEXT')
  addColumnIfMissing('coinflips', 'winner_choice_type', 'TEXT')
  addColumnIfMissing('coinflips', 'winner_faction', 'TEXT')
  addColumnIfMissing('coinflips', 'winner_starting_side', 'TEXT')
  addColumnIfMissing('coinflips', 'first_pick_team_id', 'TEXT REFERENCES teams(id) ON DELETE SET NULL')
  addColumnIfMissing('coinflips', 'updated_at', 'TEXT')
  addColumnIfMissing('draft_picks', 'opened_by_team_id', 'TEXT REFERENCES teams(id) ON DELETE SET NULL')
  migrateEventPlayerCharactersPrimaryKey()
  migrateEventRoundScores()
  migrateEventConfigurationTables()
  migrateParticipantRoleIds()
  migratePlayerBadgeDisplayPreferences()
  migrateGroupLogoDataUrls()
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
  ensureSystemBadges()
  syncSystemBadgeAssignments()
}

function ensureGroupLogoCleanupJob() {
  runGroupLogoCleanup()
  const timer = setInterval(runGroupLogoCleanup, GROUP_LOGO_CLEANUP_INTERVAL_MS)
  timer.unref?.()
}

function runGroupLogoCleanup() {
  try {
    const logoUrls = sqlite.prepare(`
      SELECT logo_url AS logoUrl
      FROM groups
      WHERE logo_url IS NOT NULL
    `).all() as Array<{ logoUrl: string | null }>
    const result = cleanupOrphanedGroupLogoUploads(
      logoUrls.map((row) => row.logoUrl),
      { olderThanMs: GROUP_LOGO_ORPHAN_GRACE_MS },
    )
    if (result.deleted.length) {
      console.info(`Cleaned up ${result.deleted.length} orphaned group logo upload(s).`)
    }
  } catch (error) {
    console.warn(
      `Unable to clean up orphaned group logo uploads: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    )
  }
}

function migrateGroupLogoDataUrls() {
  const rows = sqlite.prepare(`
    SELECT id, logo_url AS logoUrl
    FROM groups
    WHERE logo_url LIKE 'data:image/%;base64,%'
  `).all() as Array<{ id: string; logoUrl: string }>
  if (!rows.length) return

  const updateLogo = sqlite.prepare('UPDATE groups SET logo_url = ?, updated_at = ? WHERE id = ?')
  for (const row of rows) {
    try {
      const logoUrl = persistGroupLogoReference(row.logoUrl)
      if (logoUrl) updateLogo.run(logoUrl, new Date().toISOString(), row.id)
    } catch (error) {
      console.warn(
        `Unable to migrate inline group logo for group ${row.id}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
      )
    }
  }
}

function migrateEventPlayerCharactersPrimaryKey() {
  const columns = sqlite.prepare('PRAGMA table_info(event_player_characters)').all() as Array<{
    name: string
    pk: number
  }>
  const primaryKey = columns
    .filter((column) => column.pk > 0)
    .sort((a, b) => a.pk - b.pk)
    .map((column) => column.name)
  if (primaryKey.join(',') === 'event_id,discord_id,faction') return

  sqlite.exec(`
    ALTER TABLE event_player_characters RENAME TO event_player_characters_old;
    CREATE TABLE event_player_characters (
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      discord_id TEXT NOT NULL,
      faction TEXT NOT NULL,
      character_id TEXT NOT NULL,
      character_name TEXT NOT NULL,
      assigned_at TEXT NOT NULL,
      PRIMARY KEY (event_id, discord_id, faction)
    );
    INSERT OR REPLACE INTO event_player_characters (
      event_id,
      discord_id,
      faction,
      character_id,
      character_name,
      assigned_at
    )
    SELECT
      event_id,
      discord_id,
      faction,
      character_id,
      character_name,
      assigned_at
    FROM event_player_characters_old;
    DROP TABLE event_player_characters_old;
  `)
}

function migrateEventRoundScores() {
  const roundColumns = tableColumnNames('event_rounds')
  const hasLegacyTeamScores = roundColumns.has('team_scores')
  const rounds = sqlite.prepare(`
    SELECT
      event_id AS eventId,
      round_number AS roundNumber,
      winning_team_id AS winningTeamId,
      ${hasLegacyTeamScores ? 'team_scores' : 'NULL'} AS teamScores,
      updated_at AS updatedAt
    FROM event_rounds
  `).all() as Array<{
    eventId: string
    roundNumber: number
    winningTeamId: string | null
    teamScores: string | null
    updatedAt: string
  }>

  const existingRows = sqlite.prepare(`
    SELECT event_id AS eventId, round_number AS roundNumber
    FROM event_round_scores
  `).all() as Array<{ eventId: string; roundNumber: number }>
  const migratedRounds = new Set(
    existingRows.map((row) => `${row.eventId}:${row.roundNumber}`),
  )

  const insertScore = sqlite.prepare(`
    INSERT OR IGNORE INTO event_round_scores (
      event_id,
      round_number,
      team_id,
      score,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?)
  `)
  const eventIds = new Set<string>()

  for (const round of rounds) {
    if (migratedRounds.has(`${round.eventId}:${round.roundNumber}`)) continue

    const scores = parseLegacyRoundTeamScores(round.teamScores, round.winningTeamId)
    for (const [teamId, score] of Object.entries(scores)) {
      insertScore.run(round.eventId, round.roundNumber, teamId, score, round.updatedAt)
      eventIds.add(round.eventId)
    }
  }

  for (const eventId of eventIds) {
    recalculateScoresFromRounds(eventId)
  }
}

function migrateEventConfigurationTables() {
  const columns = tableColumnNames('events')
  const hasAvailableFactions = columns.has('available_factions')
  const hasAvailableSides = columns.has('available_sides')
  const hasAvailableSpecs = columns.has('available_specs')
  const hasEventLinks = columns.has('event_links')
  const rows = sqlite.prepare(`
    SELECT
      id,
      updated_at AS updatedAt,
      ${hasAvailableFactions ? 'available_factions' : 'NULL'} AS availableFactions,
      ${hasAvailableSides ? 'available_sides' : 'NULL'} AS availableSides,
      ${hasAvailableSpecs ? 'available_specs' : 'NULL'} AS availableSpecs,
      ${hasEventLinks ? 'event_links' : 'NULL'} AS eventLinks
    FROM events
  `).all() as Array<{
    id: string
    updatedAt: string
    availableFactions: string | null
    availableSides: string | null
    availableSpecs: string | null
    eventLinks: string | null
  }>

  for (const row of rows) {
    if (!hasRows('event_available_factions', 'event_id', row.id)) {
      replaceEventAvailableFactions(row.id, parseAvailableFactions(row.availableFactions), row.updatedAt)
    }
    if (!hasRows('event_available_sides', 'event_id', row.id)) {
      replaceEventAvailableSides(row.id, parseAvailableSides(row.availableSides), row.updatedAt)
    }
    if (!hasRows('event_available_specs', 'event_id', row.id)) {
      replaceEventAvailableSpecs(row.id, parseStringList(row.availableSpecs), row.updatedAt)
    }
    if (hasEventLinks && row.eventLinks && !hasRows('event_links', 'event_id', row.id)) {
      replaceEventLinks(row.id, parseEventLinks(row.eventLinks, { includeGeneratedHonuReports: true }), row.updatedAt)
    }
  }
}

function migrateParticipantRoleIds() {
  const columns = tableColumnNames('participants')
  if (!columns.has('role_ids')) return

  const rows = sqlite.prepare(`
    SELECT discord_id AS discordId, role_ids AS roleIds, updated_at AS updatedAt
    FROM participants
    WHERE role_ids IS NOT NULL AND role_ids != ''
  `).all() as Array<{ discordId: string; roleIds: string | null; updatedAt: string }>

  for (const row of rows) {
    if (hasRows('participant_role_ids', 'discord_id', row.discordId)) continue
    replaceParticipantRoleIds(row.discordId, parseLegacyRoleIds(row.roleIds), row.updatedAt)
  }
}

function migratePlayerBadgeDisplayPreferences() {
  const columns = tableColumnNames('player_profiles')
  if (!columns.has('badge_display_order')) return

  const rows = sqlite.prepare(`
    SELECT discord_id AS discordId, badge_display_order AS badgeDisplayOrder, updated_at AS updatedAt
    FROM player_profiles
    WHERE badge_display_order IS NOT NULL AND badge_display_order != ''
  `).all() as Array<{ discordId: string; badgeDisplayOrder: string | null; updatedAt: string }>

  for (const row of rows) {
    if (hasRows('player_badge_display_preferences', 'discord_id', row.discordId)) continue
    const preferences = parseLegacyBadgeDisplayPreferences(row.badgeDisplayOrder)
    replaceBadgeDisplayPreferences(row.discordId, preferences, row.updatedAt)
  }
}

function addColumnIfMissing(table: string, column: string, definition: string) {
  const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  if (columns.some((existing) => existing.name === column)) return
  sqlite.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run()
}

function tableColumnNames(table: string) {
  const columns = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
  return new Set(columns.map((column) => column.name))
}

function hasRows(table: string, column: string, value: string) {
  const row = sqlite.prepare(`SELECT 1 FROM ${table} WHERE ${column} = ? LIMIT 1`).get(value)
  return Boolean(row)
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

function parseStringList(value: string | null | undefined): string[] {
  if (!value) return []
  try {
    return normalizeStringList(JSON.parse(value))
  } catch {
    return []
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

function normalizeStringList(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  const seen = new Set<string>()
  const items: string[] = []
  for (const value of values) {
    const item = String(value).trim()
    if (!item || seen.has(item.toLowerCase())) continue
    seen.add(item.toLowerCase())
    items.push(item)
  }
  return items
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

function parseEventLinks(value: string | null, options: { includeGeneratedHonuReports?: boolean } = {}): EventLink[] {
  if (!value) return []

  try {
    return normalizeEventLinks(JSON.parse(value), options)
  } catch {
    return []
  }
}

function normalizeEventLinks(value: unknown, options: { includeGeneratedHonuReports?: boolean } = {}): EventLink[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const name = String(record.name ?? '').trim()
      const icon = EVENT_LINK_ICONS.has(String(record.icon ?? ''))
        ? String(record.icon)
        : 'Link'
      const url = normalizeOptionalEventUrl(String(record.url ?? ''))
      if (!name || !url) return null
      return { name: name.slice(0, 64), url, icon }
    })
    .filter((link): link is EventLink => Boolean(link))
    .filter((link) => options.includeGeneratedHonuReports || !isGeneratedHonuReportLink(link))
    .slice(0, 12)
}

interface HonuTeamReport {
  teamId: string
  url: string
}

function getHonuTeamReports(event: HammaEvent): HonuTeamReport[] {
  const firstRound = event.rounds.find((round) => round.roundNumber === 1)
  const lastRound = getLastConfiguredRound(event)
  if (!firstRound || !lastRound) return []

  const start = Math.floor(new Date(firstRound.startedAt).getTime() / 1000)
  const end = Math.floor(getRoundEndMs(lastRound) / 1000)
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return []

  return event.teams.flatMap((team) => {
    const characterIds = getHonuTeamReportCharacterIds(event.id, team.id)
    if (!characterIds.length) return []

    return [{ teamId: team.id, url: buildHonuReportUrl(start, end, characterIds) }]
  })
}

function removeGeneratedHonuReportEventLinks(eventId: string) {
  const currentLinks = getEventLinks(eventId, { includeGeneratedHonuReports: true })
  const manualLinks = currentLinks.filter((link) => !isGeneratedHonuReportLink(link))
  if (manualLinks.length === currentLinks.length) return

  const now = new Date().toISOString()
  replaceEventLinks(eventId, manualLinks, now)
  db.update(events).set({ updatedAt: now }).where(eq(events.id, eventId)).run()
}

function getHonuTeamReportCharacterIds(eventId: string, teamId: string) {
  const rows = sqlite.prepare(`
    WITH team_members AS (
      SELECT
        t.event_id AS eventId,
        t.id AS teamId,
        t.faction AS currentFaction,
        t.captain_discord_id AS discordId
      FROM teams t
      WHERE
        t.event_id = ?
        AND t.id = ?
        AND t.faction IS NOT NULL
        AND t.captain_discord_id IS NOT NULL
        AND t.captain_discord_id != ''
      UNION
      SELECT
        t.event_id AS eventId,
        t.id AS teamId,
        t.faction AS currentFaction,
        dp.player_discord_id AS discordId
      FROM draft_picks dp
      JOIN teams t ON t.id = dp.team_id
      WHERE
        t.event_id = ?
        AND t.id = ?
        AND t.faction IS NOT NULL
    )
    SELECT DISTINCT characterId
    FROM (
      SELECT
        COALESCE(
          CASE
            WHEN (
                COALESCE(pp.no_personal_jaeger_account, 0) = 1
                OR COALESCE(pcc.characterCount, 0) = 0
              )
              AND ec.faction = tm.currentFaction
            THEN ec.character_id
          END,
          CASE
            WHEN COALESCE(pp.no_personal_jaeger_account, 0) = 0
              AND COALESCE(pcc.characterCount, 0) > 0
            THEN pc.character_id
          END
        ) AS characterId
      FROM team_members tm
      JOIN event_participants ep
        ON ep.event_id = tm.eventId
        AND ep.discord_id = tm.discordId
        AND ep.disqualified = 0
      LEFT JOIN player_profiles pp ON pp.discord_id = tm.discordId
      LEFT JOIN (
        SELECT discord_id, COUNT(*) AS characterCount
        FROM player_characters
        GROUP BY discord_id
      ) pcc ON pcc.discord_id = tm.discordId
      LEFT JOIN event_player_characters ec
        ON ec.event_id = tm.eventId
        AND ec.discord_id = tm.discordId
        AND ec.faction = tm.currentFaction
      LEFT JOIN player_characters pc
        ON pc.discord_id = tm.discordId
        AND pc.faction = tm.currentFaction
    )
    WHERE characterId IS NOT NULL AND characterId != ''
    ORDER BY characterId
  `).all(eventId, teamId, eventId, teamId) as Array<{ characterId: string }>

  return rows.map((row) => row.characterId)
}

function buildHonuReportUrl(start: number, end: number, characterIds: string[]) {
  const entities = characterIds.map((characterId) => `+${characterId};`).join('')
  const options = `${start},${end},;${entities}`
  const encodedOptions = encodeURIComponent(Buffer.from(options, 'utf8').toString('base64url'))
  return `https://wt.honu.pw/report/${encodedOptions}`
}

function isGeneratedHonuReportLink(link: EventLink) {
  return link.name.startsWith('Honu report: ') && link.url.startsWith('https://wt.honu.pw/report/')
}

function isHonuReportDue(event: HammaEvent) {
  const lastRound = getLastConfiguredRound(event)
  if (!lastRound) return false

  const lastRoundEnd = getRoundEndMs(lastRound)
  return Number.isFinite(lastRoundEnd) && Date.now() >= lastRoundEnd
}

function getLastConfiguredRound(event: HammaEvent) {
  if (event.rounds.length < event.roundCount) return null
  return event.rounds.find((round) => round.roundNumber === event.roundCount) ?? null
}

function getRoundEndMs(round: HammaEvent['rounds'][number]) {
  return new Date(round.startedAt).getTime() + round.durationSeconds * 1000
}

function normalizeOptionalEventUrl(value: string | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return null

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error('Event links must be valid URLs.')
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Event links must use HTTP or HTTPS URLs.')
  }

  return url.toString()
}

function normalizeOptionalHonuAlertId(value: string | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return null

  const id = trimmed.match(/(?:^|\/)alert\/(\d+)(?:$|[/?#])/)?.[1] ?? trimmed
  if (!/^\d+$/.test(id)) throw new Error('Honu alert ID must be a number or alert URL.')

  const alertId = Number(id)
  if (!Number.isSafeInteger(alertId) || alertId <= 0) {
    throw new Error('Honu alert ID must be a positive number.')
  }

  return alertId
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
    callingTeamId: row.callingTeamId ?? '',
    call: normalizeCoinSide(row.callerCall ?? null),
    result: normalizeCoinSide(row.result ?? null),
    winningTeamId: row.winningTeamId ?? undefined,
  }
}
