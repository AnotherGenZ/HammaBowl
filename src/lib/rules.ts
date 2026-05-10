import type { HammaEvent, PlayerRatingSummary, PlayerSalary, TeamLedger } from './types'

export const TEAM_BUDGET = 125_000_000
export const BONUS_CAP = 25_000_000
export const SALARY_POOL = 250_000_000
export const BONUS_POOL = 50_000_000
export const MAX_PLAYER_BONUS = 10_000_000
export const BID_INCREMENT = 1_000_000
export const CHECK_IN_LEAD_MINUTES = 15

export function isCaptainPlayer(event: HammaEvent, playerId: string) {
  return event.teams.filter(Boolean).some((team) => team.captainDiscordId === playerId)
}

function hasEventStarted(event: HammaEvent, now = Date.now()) {
  const eventStart = Date.parse(event.startsAt)
  return Number.isFinite(eventStart) && now >= eventStart
}

export function isDraftEligiblePlayer(
  event: HammaEvent,
  player: HammaEvent['players'][number],
  now = Date.now(),
) {
  return (
    player.status !== 'disqualified' &&
    !isCaptainPlayer(event, player.id) &&
    (!hasEventStarted(event, now) || Boolean(player.checkedInAt))
  )
}

export function getDraftStartAt(event: HammaEvent) {
  const eventStart = Date.parse(event.startsAt)
  if (!Number.isFinite(eventStart)) return undefined

  const minutesBefore =
    typeof event.draftStartMinutesBefore === 'number'
      ? event.draftStartMinutesBefore
      : 0
  return new Date(eventStart - minutesBefore * 60_000).toISOString()
}

export function getCheckInWindow(event: HammaEvent, now = Date.now()) {
  const draftStartAt = getDraftStartAt(event)
  const draftStart = draftStartAt ? Date.parse(draftStartAt) : Number.NaN
  const eventStart = Date.parse(event.startsAt)
  const opens = Number.isFinite(draftStart)
    ? draftStart - CHECK_IN_LEAD_MINUTES * 60_000
    : Number.NaN

  return {
    opensAt: Number.isFinite(opens) ? new Date(opens).toISOString() : undefined,
    closesAt: Number.isFinite(eventStart) ? event.startsAt : undefined,
    isOpen: Number.isFinite(opens) && Number.isFinite(eventStart) && now >= opens && now < eventStart,
    hasClosed: Number.isFinite(eventStart) && now >= eventStart,
  }
}

export function isDraftAdjustmentPhase(event: HammaEvent, now = Date.now()) {
  if (!hasEventStarted(event, now) || event.activeDraftBid) return false

  const remainingPlayers = undraftedDraftEligiblePlayers(event)
  if (!remainingPlayers.length) return true

  return !buildTeamLedgers(event).some((ledger) =>
    remainingPlayers.some((player) =>
      acquisitionCost(event, ledger.team.id, player.id, 0)?.affordable,
    ),
  )
}

export function receivedRatingCount(event: HammaEvent, playerId: string) {
  const participantIds = new Set(event.players.map((player) => player.id))
  return event.ratings.filter(
    (rating) =>
      rating.toPlayerId === playerId &&
      rating.fromPlayerId !== playerId &&
      participantIds.has(rating.fromPlayerId) &&
      !rating.disqualified,
  ).length
}

export function unratedDraftEligiblePlayers(event: HammaEvent) {
  return event.players.filter(
    (player) =>
      isDraftEligiblePlayer(event, player) &&
      receivedRatingCount(event, player.id) === 0,
  )
}

export function undraftedDraftEligiblePlayers(event: HammaEvent) {
  const draftedIds = new Set(event.draftPicks.map((pick) => pick.playerId))
  return event.players.filter(
    (player) => isDraftEligiblePlayer(event, player) && !draftedIds.has(player.id),
  )
}

export function getDraftReadiness(event: HammaEvent) {
  if (event.teams.length < 2) {
    return {
      ready: false,
      label: 'Waiting for teams',
      tone: 'blocked' as const,
      missingRatings: [] as HammaEvent['players'],
    }
  }

  const missingRatings = unratedDraftEligiblePlayers(event)
  if (missingRatings.length) {
    return {
      ready: false,
      label: 'Waiting for ratings',
      tone: 'pending' as const,
      missingRatings,
    }
  }

  if (!event.coinflip?.result || !event.coinflip.winningTeamId) {
    return {
      ready: false,
      label: 'Waiting for coinflip',
      tone: 'pending' as const,
      missingRatings,
    }
  }

  return {
    ready: true,
    label: 'Ready to draft',
    tone: 'ready' as const,
    missingRatings,
  }
}

export function calculatePlayerRatingSummaries(event: HammaEvent): PlayerRatingSummary[] {
  return summarizePlayerRatings(event, event.players)
}

function summarizePlayerRatings(
  event: HammaEvent,
  players: HammaEvent['players'],
): PlayerRatingSummary[] {
  const participantIds = new Set(event.players.map((player) => player.id))

  return players.map((player) => {
    const ratings = event.ratings.filter(
      (rating) =>
        rating.toPlayerId === player.id &&
        rating.fromPlayerId !== player.id &&
        participantIds.has(rating.fromPlayerId) &&
        !rating.disqualified,
    )
    const averageRating = ratings.length
      ? ratings.reduce((sum, rating) => sum + rating.score, 0) / ratings.length
      : 0

    return {
      player,
      averageRating,
      ratingCount: ratings.length,
      isCaptain: isCaptainPlayer(event, player.id),
    }
  })
}

export function calculatePlayerSalaries(event: HammaEvent): PlayerSalary[] {
  const eligiblePlayers = event.players.filter(
    (player) => isDraftEligiblePlayer(event, player),
  )
  const playerAverages = summarizePlayerRatings(event, eligiblePlayers)

  const totalPoints = playerAverages.reduce(
    (sum, item) => sum + item.averageRating,
    0,
  )

  return playerAverages
    .map((item) => {
      const pointShare = totalPoints ? item.averageRating / totalPoints : 0
      return {
        ...item,
        pointShare,
        salary: Math.round(event.salaryPool * pointShare),
      }
    })
    .sort((a, b) => b.salary - a.salary)
}

export function buildTeamLedgers(event: HammaEvent): TeamLedger[] {
  const salaries = calculatePlayerSalaries(event)
  const salaryByPlayer = new Map(
    salaries.map((salary) => [salary.player.id, salary.salary]),
  )
  const playerById = new Map(event.players.map((player) => [player.id, player]))

  return event.teams.filter(Boolean).map((team) => {
    const picks = event.draftPicks
      .filter((pick) => pick.teamId === team.id)
      .sort((a, b) => Date.parse(a.confirmedAt) - Date.parse(b.confirmedAt))
      .flatMap((pick) => {
        const player = playerById.get(pick.playerId)
        if (!player) return []
        const adjustedSalary = salaryByPlayer.get(pick.playerId)
        if (adjustedSalary === undefined && !isDraftEligiblePlayer(event, player)) return []
        return [{
          ...pick,
          player,
          salary: adjustedSalary ?? pick.salary,
        }]
      })

    const captainBudget = event.salaryPool / 2
    const captainBonusCap = event.bonusPool / 2
    let salaryRemaining = captainBudget
    let salarySpent = 0
    for (const pick of picks) {
      const salaryFromBudget = Math.min(salaryRemaining, pick.salary)
      salaryRemaining -= salaryFromBudget
      salarySpent += salaryFromBudget
    }
    const bonusSpent = picks.reduce((sum, pick) => sum + pick.bonusSpent, 0)
    const budgetRemaining = salaryRemaining
    const bonusRemaining = captainBonusCap - bonusSpent
    const usableBonusRemaining = Math.min(bonusRemaining, event.maxPlayerBonus)

    return {
      team: {
        ...team,
        budget: captainBudget,
        bonusCap: captainBonusCap,
      },
      captainPlayer: team.captainDiscordId ? playerById.get(team.captainDiscordId) : undefined,
      picks,
      salarySpent,
      bonusSpent,
      budgetRemaining,
      bonusRemaining,
      combinedRemaining: budgetRemaining + usableBonusRemaining,
    }
  })
}

export function buildDraftAdjustment(event: HammaEvent, now = Date.now()) {
  const active = isDraftAdjustmentPhase(event, now)
  const ledgers = buildTeamLedgers(event)
  const teamValues = ledgers.map((ledger) => ({
    team: ledger.team,
    value: ledger.picks.reduce((sum, pick) => sum + pick.salary, 0),
  }))

  if (!active || ledgers.length !== 2) {
    return {
      active,
      teamValues,
      stealBudget: 0,
      needsAdjustment: false,
      stealingTeam: undefined,
      sourceTeam: undefined,
      stealablePicks: [] as Array<TeamLedger['picks'][number]>,
    }
  }

  const sorted = [...teamValues].sort((a, b) => a.value - b.value)
  const [lower, higher] = sorted
  const difference = higher.value - lower.value
  const stealBudget = Math.floor(difference / 2)
  const stealingLedger = ledgers.find((ledger) => ledger.team.id === lower.team.id)
  const sourceLedger = ledgers.find((ledger) => ledger.team.id === higher.team.id)
  const stealablePicks = (sourceLedger?.picks ?? [])
    .filter((pick) => pick.salary <= stealBudget)
    .sort((a, b) => b.salary - a.salary || a.player.name.localeCompare(b.player.name))

  return {
    active,
    teamValues,
    stealBudget,
    needsAdjustment: stealBudget > 0,
    stealingTeam: stealingLedger?.team,
    sourceTeam: sourceLedger?.team,
    stealablePicks,
  }
}

export function canAcquirePlayer(
  event: HammaEvent,
  teamId: string,
  playerId: string,
  bidBonus = 0,
) {
  return acquisitionCost(event, teamId, playerId, bidBonus)?.affordable ?? false
}

export function acquisitionCost(
  event: HammaEvent,
  teamId: string,
  playerId: string,
  bidBonus = 0,
) {
  const salary = calculatePlayerSalaries(event).find((item) => item.player.id === playerId)?.salary
  const ledger = buildTeamLedgers(event).find((item) => item.team.id === teamId)
  if (salary === undefined || !ledger || bidBonus < 0 || !Number.isFinite(bidBonus)) return undefined

  const salaryShortfall = Math.max(0, salary - ledger.budgetRemaining)
  const usesReach = salaryShortfall > 0
  const bonusSpent = salaryShortfall + bidBonus
  const reachAllowed = !usesReach || canUseTotalReach(event, teamId)
  const affordable =
    Number.isInteger(bidBonus) &&
    reachAllowed &&
    bonusSpent <= ledger.bonusRemaining &&
    bonusSpent <= event.maxPlayerBonus &&
    salary <= ledger.budgetRemaining + ledger.bonusRemaining

  return {
    affordable,
    salary,
    bidBonus,
    bonusSpent,
    salaryShortfall,
    usesReach,
    ledger,
  }
}

export function canUseTotalReach(event: HammaEvent, teamId: string) {
  const ledger = buildTeamLedgers(event).find((item) => item.team.id === teamId)
  if (!ledger) return false

  const draftedIds = new Set(event.draftPicks.map((pick) => pick.playerId))
  const salaries = calculatePlayerSalaries(event).filter(
    (salary) => !draftedIds.has(salary.player.id),
  )
  return salaries.length > 0 && salaries.every((salary) => salary.salary > ledger.budgetRemaining)
}

export function requiresTotalReach(event: HammaEvent, teamId: string, playerId: string) {
  return (acquisitionCost(event, teamId, playerId, 0)?.salaryShortfall ?? 0) > 0
}

export function salaryBudgetContestWinner(
  event: HammaEvent,
  contestingTeamId: string,
  leadingTeamId: string,
  playerId: string,
) {
  const winner = salaryBudgetAdvantageWinner(event, contestingTeamId, leadingTeamId, playerId)
  return winner?.team.id === contestingTeamId ? winner : undefined
}

export function salaryBudgetAdvantageWinner(
  event: HammaEvent,
  firstTeamId: string,
  secondTeamId: string,
  playerId: string,
) {
  const firstCost = acquisitionCost(event, firstTeamId, playerId, 0)
  const secondCost = acquisitionCost(event, secondTeamId, playerId, 0)
  if (!firstCost?.affordable || !secondCost?.affordable) return undefined
  if (firstCost.usesReach === secondCost.usesReach) return undefined

  return firstCost.usesReach ? secondCost.ledger : firstCost.ledger
}

export function reachAwardWinner(event: HammaEvent, initiatingTeamId: string, playerId: string) {
  const ledgers = buildTeamLedgers(event)
  if (ledgers.length !== 2) return undefined
  if (!ledgers.every((ledger) => requiresTotalReach(event, ledger.team.id, playerId))) {
    return undefined
  }

  const affordableLedgers = ledgers.filter(
    (ledger) => acquisitionCost(event, ledger.team.id, playerId, 0)?.affordable,
  )
  if (affordableLedgers.length !== 2) return undefined

  const [first, second] = affordableLedgers
  if (first.combinedRemaining === second.combinedRemaining) {
    return ledgers.find((ledger) => ledger.team.id === initiatingTeamId)
  }

  return first.combinedRemaining > second.combinedRemaining ? first : second
}

export function oppositeTeamId(event: HammaEvent, teamId: string) {
  return event.teams.find((team) => team.id !== teamId)?.id
}

function canAffordAnyDraftEligiblePlayer(event: HammaEvent, teamId: string) {
  return undraftedDraftEligiblePlayers(event).some((player) =>
    acquisitionCost(event, teamId, player.id, 0)?.affordable,
  )
}

export function nextDraftSide(event: HammaEvent) {
  if (event.nextPickTeamId) {
    const nextPickLedger = buildTeamLedgers(event).find(
      (ledger) =>
        ledger.team.id === event.nextPickTeamId &&
        canAffordAnyDraftEligiblePlayer(event, ledger.team.id),
    )
    if (nextPickLedger) return nextPickLedger
  }

  if (!event.draftPicks.length && event.coinflip?.firstPickTeamId) {
    const firstPickLedger = buildTeamLedgers(event).find(
      (ledger) =>
        ledger.team.id === event.coinflip?.firstPickTeamId &&
        canAffordAnyDraftEligiblePlayer(event, ledger.team.id),
    )
    if (firstPickLedger) return firstPickLedger
  }

  const sorted = buildTeamLedgers(event).sort(
    (a, b) => b.combinedRemaining - a.combinedRemaining,
  )

  return sorted.find((ledger) => canAffordAnyDraftEligiblePlayer(event, ledger.team.id))
}
