import '@tanstack/react-start/server-only'

import fs from 'node:fs'
import path from 'node:path'
import Database from 'better-sqlite3'
import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { env } from './env'
import {
  activeDraftBids,
  coinflips,
  draftPicks,
  eventParticipants,
  events,
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
} from './rules'
import type { Captain, DraftPick, Faction, HammaEvent, Player, Rating, StartingSide } from './types'

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

  for (const player of event.players) {
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
  const teamRows = db.select().from(teams).where(eq(teams.eventId, event.id)).all()
  const ratingRows = db.select().from(ratings).where(eq(ratings.eventId, event.id)).all()
  const pickRows = db.select().from(draftPicks).where(eq(draftPicks.eventId, event.id)).all()
  const activeBidRow = db
    .select()
    .from(activeDraftBids)
    .where(and(eq(activeDraftBids.eventId, event.id), eq(activeDraftBids.status, 'active')))
    .get()
  const coinflipRow = db.select().from(coinflips).where(eq(coinflips.eventId, event.id)).get()

  const players: Player[] = participantRows.map((participant) => ({
    id: participant.discordId,
    name: participant.name,
    outfit: '',
    faction: 'NS',
    status: participant.disqualified ? 'disqualified' : 'signed_up',
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

  const eventDraftPicks: DraftPick[] = pickRows.map((pick) => ({
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
    name: event.name,
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
    activeDraftBid: activeBidRow
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
  }
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

export async function setWinningTeam(eventId: string, teamId: string) {
  db.update(events).set({ winningTeamId: teamId, phase: 'complete' }).where(eq(events.id, eventId)).run()
  return { ok: true }
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

  return { player: player?.name ?? pick.playerDiscordId }
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
  eventId: string,
  fromDiscordId: string,
  toDiscordId: string,
  score: number,
) {
  if (fromDiscordId === toDiscordId) throw new Error('You cannot rate yourself.')
  if (score < 1 || score > 10) throw new Error('Rating must be between 1 and 10.')

  db.insert(ratings)
    .values({
      eventId,
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
        ),
      )
      .get(),
  )
}

export function isParticipantInAnyEvent(discordId: string) {
  return Boolean(
    db
      .select()
      .from(eventParticipants)
      .where(eq(eventParticipants.discordId, discordId))
      .get(),
  )
}

function bootstrap() {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      raid_helper_event_id TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
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
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS event_participants (
      event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
      discord_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'signed_up',
      disqualified INTEGER NOT NULL DEFAULT 0,
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
  addColumnIfMissing('events', 'pending_signup_count', 'INTEGER NOT NULL DEFAULT 0')
  addColumnIfMissing('events', 'available_factions', `TEXT NOT NULL DEFAULT '["VS","NC","TR"]'`)
  addColumnIfMissing('events', 'available_sides', `TEXT NOT NULL DEFAULT '["north","south"]'`)
  addColumnIfMissing('events', 'next_pick_team_id', 'TEXT REFERENCES teams(id) ON DELETE SET NULL')
  addColumnIfMissing('coinflips', 'calling_team_id', 'TEXT REFERENCES teams(id) ON DELETE SET NULL')
  addColumnIfMissing('coinflips', 'caller_call', 'TEXT')
  addColumnIfMissing('coinflips', 'winner_choice_type', 'TEXT')
  addColumnIfMissing('coinflips', 'winner_faction', 'TEXT')
  addColumnIfMissing('coinflips', 'winner_starting_side', 'TEXT')
  addColumnIfMissing('coinflips', 'first_pick_team_id', 'TEXT REFERENCES teams(id) ON DELETE SET NULL')
  addColumnIfMissing('coinflips', 'updated_at', 'TEXT')
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
