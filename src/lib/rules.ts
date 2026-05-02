import type { HammaEvent, PlayerSalary, TeamLedger } from './types'

export const TEAM_BUDGET = 125_000_000
export const BONUS_CAP = 25_000_000
export const SALARY_POOL = 250_000_000
export const BONUS_POOL = 50_000_000
export const MAX_PLAYER_BONUS = 10_000_000
export const BID_INCREMENT = 1_000_000

export function isCaptainPlayer(event: HammaEvent, playerId: string) {
  return event.teams.some((team) => team.captainDiscordId === playerId)
}

export function isDraftEligiblePlayer(
  event: HammaEvent,
  player: HammaEvent['players'][number],
) {
  return player.status !== 'disqualified' && !isCaptainPlayer(event, player.id)
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

  return {
    ready: true,
    label: 'Ready to draft',
    tone: 'ready' as const,
    missingRatings,
  }
}

export function calculatePlayerSalaries(event: HammaEvent): PlayerSalary[] {
  const eligiblePlayers = event.players.filter(
    (player) => isDraftEligiblePlayer(event, player),
  )
  const participantIds = new Set(event.players.map((player) => player.id))

  const playerAverages = eligiblePlayers.map((player) => {
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
    }
  })

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

  return event.teams.map((team) => {
    const picks = event.draftPicks
      .filter((pick) => pick.teamId === team.id)
      .sort((a, b) => Date.parse(a.confirmedAt) - Date.parse(b.confirmedAt))
      .flatMap((pick) => {
        const player = playerById.get(pick.playerId)
        if (!player) return []
        return [{
          ...pick,
          player,
          salary: salaryByPlayer.get(pick.playerId) ?? pick.salary,
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
      combinedRemaining: budgetRemaining + bonusRemaining,
    }
  })
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

export function nextDraftSide(event: HammaEvent) {
  if (event.nextPickTeamId) {
    const nextPickLedger = buildTeamLedgers(event).find(
      (ledger) => ledger.team.id === event.nextPickTeamId,
    )
    if (nextPickLedger) return nextPickLedger
  }

  if (!event.draftPicks.length && event.coinflip?.firstPickTeamId) {
    const firstPickLedger = buildTeamLedgers(event).find(
      (ledger) => ledger.team.id === event.coinflip?.firstPickTeamId,
    )
    if (firstPickLedger) return firstPickLedger
  }

  const sorted = buildTeamLedgers(event).sort(
    (a, b) => b.combinedRemaining - a.combinedRemaining,
  )

  return sorted[0]
}
