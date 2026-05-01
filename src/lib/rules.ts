import type { HammaEvent, PlayerSalary, TeamLedger } from './types'

export const TEAM_BUDGET = 125_000_000
export const BONUS_CAP = 25_000_000
export const SALARY_POOL = 250_000_000

export function isCaptainPlayer(event: HammaEvent, playerId: string) {
  return event.captains.some((captain) => captain.playerId === playerId)
}

export function isDraftEligiblePlayer(
  event: HammaEvent,
  player: HammaEvent['players'][number],
) {
  return player.status !== 'disqualified' && !isCaptainPlayer(event, player.id)
}

export function calculatePlayerSalaries(event: HammaEvent): PlayerSalary[] {
  const eligiblePlayers = event.players.filter(
    (player) => isDraftEligiblePlayer(event, player),
  )

  const playerAverages = eligiblePlayers.map((player) => {
    const ratings = event.ratings.filter(
      (rating) =>
        rating.toPlayerId === player.id &&
        rating.fromPlayerId !== player.id &&
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

  return event.captains.map((captain) => {
    const picks = event.draftPicks
      .filter((pick) => pick.captainId === captain.id)
      .flatMap((pick) => {
        const player = playerById.get(pick.playerId)
        if (!player) return []
        return [{
          ...pick,
          player,
          salary: salaryByPlayer.get(pick.playerId) ?? pick.salary,
        }]
      })

    const salarySpent = picks.reduce((sum, pick) => sum + pick.salary, 0)
    const bonusSpent = picks.reduce((sum, pick) => sum + pick.bonusSpent, 0)
    const budgetRemaining = captain.budget - salarySpent
    const bonusRemaining = captain.bonusCap - bonusSpent

    return {
      captain,
      captainPlayer: captain.playerId ? playerById.get(captain.playerId) : undefined,
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
  captainId: string,
  playerId: string,
  bonusBid = 0,
) {
  const salary = calculatePlayerSalaries(event).find(
    (item) => item.player.id === playerId,
  )?.salary
  const ledger = buildTeamLedgers(event).find(
    (item) => item.captain.id === captainId,
  )

  if (salary === undefined || !ledger) return false
  if (bonusBid > ledger.bonusRemaining) return false

  return salary + bonusBid <= ledger.combinedRemaining
}

export function nextDraftSide(event: HammaEvent) {
  if (event.nextPickCaptainId) {
    const nextPickLedger = buildTeamLedgers(event).find(
      (ledger) => ledger.captain.id === event.nextPickCaptainId,
    )
    if (nextPickLedger) return nextPickLedger
  }

  if (!event.draftPicks.length && event.coinflip?.firstPickCaptainId) {
    const firstPickLedger = buildTeamLedgers(event).find(
      (ledger) => ledger.captain.id === event.coinflip?.firstPickCaptainId,
    )
    if (firstPickLedger) return firstPickLedger
  }

  const sorted = buildTeamLedgers(event).sort(
    (a, b) => b.combinedRemaining - a.combinedRemaining,
  )

  return sorted[0]
}
