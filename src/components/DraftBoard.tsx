import { Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { compactMoney, money, shortDate } from '../lib/format'
import {
  acquisitionCost,
  buildDraftAdjustment,
  buildTeamLedgers,
  calculatePlayerSalaries,
  canAcquirePlayer,
  getCheckInWindow,
  getDraftReadiness,
  isDraftEligiblePlayer,
  isCaptainPlayer,
  nextDraftSide,
  salaryBudgetAdvantageWinner,
  salaryBudgetContestWinner,
  undraftedDraftEligiblePlayers,
} from '../lib/rules'
import type { HammaEvent } from '../lib/types'
import { useRealtimeCurrentEvent } from '../lib/useRealtimeCurrentEvent'
import { PlayerName } from './PlayerName'

export function DraftBoard({
  event,
  canBid = false,
  canManageAll = false,
  userId,
}: {
  event: HammaEvent
  canBid?: boolean
  canManageAll?: boolean
  userId?: string
}) {
  const [currentEvent, setCurrentEvent, lastRealtimeUpdate] = useRealtimeCurrentEvent(event)
  const [savingBid, setSavingBid] = useState(false)
  const [checkingIn, setCheckingIn] = useState(false)
  const [pickingPlayerId, setPickingPlayerId] = useState<string>()
  const [resettingPickId, setResettingPickId] = useState<string>()
  const [stealingPlayerId, setStealingPlayerId] = useState<string>()
  const [selectedSpecs, setSelectedSpecs] = useState<string[]>([])
  const [bidMessage, setBidMessage] = useState<{ text: string; tone: 'neutral' | 'success' | 'error' }>()
  const [now, setNow] = useState(Date.now())
  const pickListRefs = useRef<Array<HTMLUListElement | null>>([])
  const syncingPickScroll = useRef(false)
  const prevPickTurnRef = useRef<string | undefined>(undefined)

  if (!currentEvent) {
    return (
      <section className="panel empty-state">
        <h1>No current event</h1>
        <p>The draft will be available once Raid Helper has a current HammaBowl event.</p>
      </section>
    )
  }

  const canCancelBid = canManageAll
  const draftLocked = currentEvent.rounds.length > 0
  const checkInWindow = getCheckInWindow(currentEvent, now)
  const currentUserPlayer = currentEvent.players.find((player) => player.id === userId)
  const canCheckIn = Boolean(userId && currentUserPlayer && !currentUserPlayer.checkedInAt && checkInWindow.isOpen)
  const uncheckedPlayerCount = currentEvent.players.filter(
    (player) => !isCaptainPlayer(currentEvent, player.id) && !player.checkedInAt,
  ).length
  const ledgers = buildTeamLedgers(currentEvent)
  const draftAdjustment = buildDraftAdjustment(currentEvent, now)
  const draftAdjustmentActive = draftAdjustment.active
  const canUseStealBudget = Boolean(
    !draftLocked &&
      draftAdjustment.stealingTeam &&
      (draftAdjustment.stealingTeam.captainDiscordId === userId || canManageAll),
  )
  const latestPickId = [...currentEvent.draftPicks]
    .sort((a, b) => Date.parse(b.confirmedAt) - Date.parse(a.confirmedAt))[0]?.id
  const salaries = calculatePlayerSalaries(currentEvent)
  const salaryByPlayer = new Map(
    salaries.map((salary) => [salary.player.id, salary.salary]),
  )
  const availablePlayers = undraftedDraftEligiblePlayers(currentEvent)
    .sort((a, b) => {
      const salaryDelta =
        (salaryByPlayer.get(b.id) ?? 0) - (salaryByPlayer.get(a.id) ?? 0)
      return salaryDelta || a.name.localeCompare(b.name)
    })
  const availablePlayerSpecs = new Set(availablePlayers.flatMap((player) => player.specs ?? []))
  const orderedEventSpecs = currentEvent.availableSpecs?.filter((spec) => availablePlayerSpecs.has(spec)) ?? []
  const unorderedPlayerSpecs = Array.from(availablePlayerSpecs)
    .filter((spec) => !orderedEventSpecs.includes(spec))
    .sort((a, b) => a.localeCompare(b))
  const specOptions = [...orderedEventSpecs, ...unorderedPlayerSpecs]
  const activeSelectedSpecs = selectedSpecs.filter((spec) => specOptions.includes(spec))
  const available = activeSelectedSpecs.length
    ? availablePlayers.filter((player) =>
        activeSelectedSpecs.some((spec) => player.specs?.includes(spec)),
      )
    : availablePlayers
  const draftEligibleCount = currentEvent.players.filter((player) =>
    isDraftEligiblePlayer(currentEvent, player),
  ).length
  const isCaptain = ledgers.some((ledger) => ledger.team.captainDiscordId === userId)
  const draftReadiness = getDraftReadiness(currentEvent)
  const draftReady = draftReadiness.ready
  const draftStatus = draftLocked
    ? { label: 'Locked', tone: 'blocked' as const }
    : draftAdjustmentActive
      ? { label: 'Adjustment', tone: 'pending' as const }
      : draftReadiness
  const activeBid = currentEvent.activeDraftBid
  const pickTurn = nextDraftSide(currentEvent)
  const myCaptainLedgers = ledgers.filter((ledger) => ledger.team.captainDiscordId === userId)
  const isMyTurn = Boolean(
    isCaptain &&
      pickTurn &&
      !activeBid &&
      myCaptainLedgers.some((l) => l.team.id === pickTurn.team.id),
  )
  const bidPlayer = activeBid
    ? currentEvent.players.find((player) => player.id === activeBid.playerId)
    : undefined
  const highestLedger = activeBid
    ? ledgers.find((ledger) => ledger.team.id === activeBid.highestTeamId)
    : undefined
  const nextLedger = activeBid
    ? ledgers.find((ledger) => ledger.team.id === activeBid.nextTeamId)
    : undefined
  const canActOnBid = Boolean(
    activeBid &&
      nextLedger &&
      nextLedger.team.captainDiscordId === userId,
  )
  const canSeeBidActions = Boolean(activeBid && isCaptain)
  const canRaiseBid = Boolean(
    activeBid &&
      nextLedger &&
      canActOnBid &&
      (salaryBudgetContestWinner(
        currentEvent,
        nextLedger.team.id,
        activeBid.highestTeamId,
        activeBid.playerId,
      ) ||
        (!salaryBudgetAdvantageWinner(
          currentEvent,
          nextLedger.team.id,
          activeBid.highestTeamId,
          activeBid.playerId,
        ) &&
          canAcquirePlayer(
            currentEvent,
            nextLedger.team.id,
            activeBid.playerId,
            activeBid.currentBonus + currentEvent.bidIncrement,
          ))),
  )
  const contestWinsPlayer = Boolean(
    activeBid &&
      nextLedger &&
      salaryBudgetContestWinner(
        currentEvent,
        nextLedger.team.id,
        activeBid.highestTeamId,
        activeBid.playerId,
      ),
  )

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const currentTurnId = pickTurn?.team.id
    if (
      currentTurnId &&
      prevPickTurnRef.current &&
      currentTurnId !== prevPickTurnRef.current &&
      isMyTurn
    ) {
      document.title = '🔔 Your pick! — HammaBowl Draft'
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('HammaBowl Draft', { body: "It's your turn to pick!" })
      }
    }
    prevPickTurnRef.current = currentTurnId
    if (!isMyTurn) {
      document.title = 'Draft — HammaBowl'
    }
  }, [pickTurn?.team.id, isMyTurn])

  useEffect(() => {
    if (isCaptain && 'Notification' in window && Notification.permission === 'default') {
      void Notification.requestPermission()
    }
  }, [isCaptain])

  useEffect(() => {
    if (!lastRealtimeUpdate?.message || !lastRealtimeUpdate.type.startsWith('draft.')) return
    setBidMessage({
      text: lastRealtimeUpdate.message,
      tone: lastRealtimeUpdate.tone ?? 'neutral',
    })
  }, [lastRealtimeUpdate])

  async function checkIn() {
    setCheckingIn(true)
    setBidMessage(undefined)
    try {
      const response = await fetch('/api/event/current', { method: 'POST' })
      if (!response.ok) throw new Error(await response.text())

      const payload = await response.json() as {
        message?: string
        event?: HammaEvent | null
      }
      if (payload.event) setCurrentEvent(payload.event)
      setBidMessage({ text: payload.message ?? 'Checked in.', tone: 'success' })
    } catch (error) {
      setBidMessage({ text: error instanceof Error ? error.message : 'Unable to check in.', tone: 'error' })
    } finally {
      setCheckingIn(false)
    }
  }

  async function runBidAction(action: 'bump' | 'forfeit') {
    const actionTeamId = activeBid?.nextTeamId
    const actionPlayerId = activeBid?.playerId
    if (!actionPlayerId || !actionTeamId) return

    setSavingBid(true)
    setBidMessage(undefined)
    try {
      const response = await fetch('/api/draft/bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          bidId: activeBid?.id,
          playerDiscordId: actionPlayerId,
          teamId: actionTeamId,
        }),
      })
      if (!response.ok) throw new Error(await response.text())

      const payload = await response.json() as {
        message?: string
        event?: HammaEvent | null
      }
      if (payload.event) setCurrentEvent(payload.event)
      setBidMessage({ text: payload.message ?? 'Bid updated.', tone: 'success' })
    } catch (error) {
      setBidMessage({ text: error instanceof Error ? error.message : 'Unable to update bid.', tone: 'error' })
    } finally {
      setSavingBid(false)
    }
  }

  async function pickPlayer(playerId: string) {
    const teamId = pickTurn?.team.id
    if (!teamId) return

    setPickingPlayerId(playerId)
    setBidMessage(undefined)
    try {
      const response = await fetch('/api/draft/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerDiscordId: playerId,
          teamId,
        }),
      })
      if (!response.ok) throw new Error(await response.text())

      const payload = await response.json() as {
        message?: string
        event?: HammaEvent | null
      }
      if (payload.event) setCurrentEvent(payload.event)
      setBidMessage({ text: payload.message ?? 'Pick started.', tone: 'success' })
    } catch (error) {
      setBidMessage({ text: error instanceof Error ? error.message : 'Unable to pick player.', tone: 'error' })
    } finally {
      setPickingPlayerId(undefined)
    }
  }

  async function cancelBid() {
    setSavingBid(true)
    setBidMessage(undefined)
    try {
      const response = await fetch('/api/draft/bid', { method: 'DELETE' })
      if (!response.ok) throw new Error(await response.text())
      const payload = await response.json() as {
        message?: string
        event?: HammaEvent | null
      }
      if (payload.event) setCurrentEvent(payload.event)
      setBidMessage({ text: payload.message ?? 'Bid cancelled.', tone: 'success' })
    } catch (error) {
      setBidMessage({ text: error instanceof Error ? error.message : 'Unable to cancel bid.', tone: 'error' })
    } finally {
      setSavingBid(false)
    }
  }

  async function stealPlayer(playerId: string) {
    const teamId = draftAdjustment.stealingTeam?.id
    if (!teamId) return

    setStealingPlayerId(playerId)
    setBidMessage(undefined)
    try {
      const response = await fetch('/api/draft/bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'steal',
          playerDiscordId: playerId,
          teamId,
        }),
      })
      if (!response.ok) throw new Error(await response.text())

      const payload = await response.json() as {
        message?: string
        event?: HammaEvent | null
      }
      if (payload.event) setCurrentEvent(payload.event)
      setBidMessage({ text: payload.message ?? 'Player stolen.', tone: 'success' })
    } catch (error) {
      setBidMessage({ text: error instanceof Error ? error.message : 'Unable to steal player.', tone: 'error' })
    } finally {
      setStealingPlayerId(undefined)
    }
  }

  async function resetPick(pickId: string) {
    setResettingPickId(pickId)
    setBidMessage(undefined)
    try {
      const response = await fetch('/api/draft/pick', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pickId }),
      })
      if (!response.ok) throw new Error(await response.text())

      const payload = await response.json() as {
        message?: string
        event?: HammaEvent | null
      }
      if (payload.event) setCurrentEvent(payload.event)
      setBidMessage({ text: payload.message ?? 'Pick reset.', tone: 'success' })
    } catch (error) {
      setBidMessage({ text: error instanceof Error ? error.message : 'Unable to reset pick.', tone: 'error' })
    } finally {
      setResettingPickId(undefined)
    }
  }

  function toggleSpecFilter(spec: string) {
    setSelectedSpecs((current) =>
      current.includes(spec)
        ? current.filter((item) => item !== spec)
        : [...current, spec],
    )
  }

  function syncPickListScroll(index: number) {
    if (syncingPickScroll.current) return
    const source = pickListRefs.current[index]
    if (!source) return

    syncingPickScroll.current = true
    for (const [listIndex, list] of pickListRefs.current.entries()) {
      if (listIndex !== index && list) list.scrollTop = source.scrollTop
    }
    window.requestAnimationFrame(() => {
      syncingPickScroll.current = false
    })
  }

  return (
    <div className="draft-layout">
      <section className="panel draft-teams-panel">
        <div className="section-heading">
          <div>
            <h1>Draft</h1>
          </div>
          <span className={`draft-status ${draftStatus.tone}`}>
            {draftStatus.label}
          </span>
        </div>
        <div className="check-in-panel">
          <div>
            <strong>Check-in</strong>
            <small>
              {checkInWindow.hasClosed
                ? `${uncheckedPlayerCount} no-show ${uncheckedPlayerCount === 1 ? 'player' : 'players'} removed from eligibility.`
                : checkInWindow.isOpen
                  ? `Open until ${checkInWindow.closesAt ? shortDate(checkInWindow.closesAt) : 'event start'}.`
                  : `Opens ${checkInWindow.opensAt ? shortDate(checkInWindow.opensAt) : 'before draft'}.`}
            </small>
          </div>
          {currentUserPlayer ? (
            currentUserPlayer.checkedInAt ? (
              <CheckInBadge player={currentUserPlayer} event={currentEvent} now={now} />
            ) : (
              <button type="button" disabled={!canCheckIn || checkingIn} onClick={() => void checkIn()}>
                {checkingIn ? <span className="spinner" aria-label="Checking in" /> : null}
                Check In
              </button>
            )
          ) : null}
        </div>
        {draftLocked ? (
          <div className="toast toast-neutral" role="status">
            The first round has started. Draft is locked.
          </div>
        ) : null}
        {draftAdjustmentActive && !draftLocked ? (
          <div className="toast toast-neutral" role="status">
            Adjustment phase active. {draftAdjustment.needsAdjustment && draftAdjustment.stealingTeam && draftAdjustment.sourceTeam
              ? `${draftAdjustment.stealingTeam.teamName} has ${money(draftAdjustment.stealBudget)} steal budget from ${draftAdjustment.sourceTeam.teamName}.`
              : 'Team values are already balanced.'}
          </div>
        ) : null}
        {ledgers.length ? (
          <div className="team-grid compact">
            {ledgers.map((ledger, ledgerIndex) => {
              const isPickTurn =
                !draftAdjustmentActive && draftReady && !activeBid && pickTurn?.team.id === ledger.team.id
              const teamPlayerCount = ledger.picks.length + (ledger.captainPlayer ? 1 : 0)
              const teamValue = ledger.picks.reduce((sum, pick) => sum + pick.salary, 0)
              return (
                <article className={`team-panel${isPickTurn ? ' team-panel-active' : ''}`} key={ledger.team.id}>
                  <div className="team-title-row">
                    <h2>{ledger.team.teamName}</h2>
                    {isPickTurn ? (
                      <span className="pick-turn-chip pick-turn-pulse">Pick turn</span>
                    ) : null}
                  </div>
                  <div className="team-meta-row">
                    <span className={`faction-field ${ledger.team.faction ? `faction-${ledger.team.faction.toLowerCase()}` : ''}`}>
                      <small>Faction</small>
                      <strong>{ledger.team.faction ?? 'TBD'}</strong>
                    </span>
                    <span>
                      <small>Starting Side</small>
                      <strong>{ledger.team.startingSide ?? 'TBD'}</strong>
                    </span>
                  </div>
                  <dl>
                    <div>
                      <dt>Budget left</dt>
                      <dd title={money(ledger.budgetRemaining)}>{compactMoney(ledger.budgetRemaining)}</dd>
                    </div>
                    <div>
                      <dt>Bonus left</dt>
                      <dd title={money(ledger.bonusRemaining)}>{compactMoney(ledger.bonusRemaining)}</dd>
                    </div>
                    <div>
                      <dt>Total reach</dt>
                      <dd title={money(ledger.combinedRemaining)}>{compactMoney(ledger.combinedRemaining)}</dd>
                    </div>
                  </dl>
                  <ul
                    className="pick-list"
                    ref={(node) => {
                      pickListRefs.current[ledgerIndex] = node
                    }}
                    onScroll={() => syncPickListScroll(ledgerIndex)}
                  >
                    {ledger.captainPlayer ? (
                      <li className="locked-pick">
                        <div className="pick-main">
                          <Link
                            to="/players/$discordId"
                            params={{ discordId: ledger.captainPlayer.id }}
                            className="captain-pick-name"
                          >
                            <PlayerName
                              name={ledger.captainPlayer.name}
                              groupTag={ledger.captainPlayer.groupTag}
                              groupTagColor={ledger.captainPlayer.groupTagColor}
                            />
                            <CheckInBadge player={ledger.captainPlayer} event={currentEvent} now={now} compact />
                            <span className="captain-crown" aria-hidden="true">
                              ♛
                            </span>
                          </Link>
                          <small>Captain</small>
                        </div>
                      </li>
                    ) : null}
                    {ledger.picks.map((pick) => {
                      const canStealPick = Boolean(
                        canUseStealBudget &&
                          draftAdjustment.sourceTeam?.id === ledger.team.id &&
                          draftAdjustment.stealablePicks.some((candidate) => candidate.id === pick.id),
                      )
                      return (
                      <li key={pick.id}>
                        <div className="pick-main">
                          <Link to="/players/$discordId" params={{ discordId: pick.player.id }}>
                            <PlayerName
                              name={pick.player.name}
                              groupTag={pick.player.groupTag}
                              groupTagColor={pick.player.groupTagColor}
                            />
                            <CheckInBadge player={pick.player} event={currentEvent} now={now} compact />
                          </Link>
                          <small>
                            <span title={money(pick.salary)}>{compactMoney(pick.salary)}</span>
                            {pick.bonusSpent ? (
                              <>
                                {' + '}
                                <span title={money(pick.bonusSpent)}>{compactMoney(pick.bonusSpent)}</span>
                              </>
                            ) : null}
                          </small>
                        </div>
                        {canManageAll && !draftLocked && pick.id === latestPickId ? (
                          <button
                            className="text-button danger"
                            type="button"
                            disabled={Boolean(activeBid) || resettingPickId === pick.id}
                            onClick={() => void resetPick(pick.id)}
                          >
                            {resettingPickId === pick.id ? <span className="spinner" aria-label="Resetting" /> : null}
                            Undo
                          </button>
                        ) : null}
                        {canStealPick ? (
                          <button
                            className="text-button steal"
                            type="button"
                            disabled={stealingPlayerId === pick.playerId}
                            onClick={() => void stealPlayer(pick.playerId)}
                          >
                            {stealingPlayerId === pick.playerId ? <span className="spinner" aria-label="Stealing" /> : null}
                            Steal
                          </button>
                        ) : null}
                      </li>
                    )})}
                  </ul>
                  <div className="team-footer-chips">
                    <div className="team-count-chip">
                      {teamPlayerCount} {teamPlayerCount === 1 ? 'player' : 'players'}
                    </div>
                    <div className="team-value-chip" title={money(teamValue)}>
                      Adjusted {compactMoney(teamValue)}
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        ) : (
          <div className="empty-inline">
            Captains and teams have not been configured for this event yet.
          </div>
        )}
      </section>

      <section className="panel signup-pool-panel">
        <div className="section-heading">
          <div>
            <div className="heading-with-chip">
              <h2>Player Pool</h2>
              <span className="count-chip">
                {available.length} undrafted
              </span>
            </div>
          </div>
        </div>
        {bidMessage ? (
          <div className={`toast toast-${bidMessage.tone}`} role="status" aria-live="polite">
            {bidMessage.text}
          </div>
        ) : null}
        {activeBid ? (
          <div className="active-bid-panel">
            <div className="bid-info-grid">
              <div>
                <small>Player</small>
                {bidPlayer ? (
                  <Link to="/players/$discordId" params={{ discordId: bidPlayer.id }}>
                    <strong>
                      <PlayerName
                        name={bidPlayer.name}
                        groupTag={bidPlayer.groupTag}
                        groupTagColor={bidPlayer.groupTagColor}
                      />
                      <CheckInBadge player={bidPlayer} event={currentEvent} now={now} compact />
                    </strong>
                  </Link>
                ) : (
                  <strong>{activeBid.playerId}</strong>
                )}
              </div>
              <div>
                <small>Leading</small>
                <strong>{highestLedger?.team.teamName ?? activeBid.highestTeamId}</strong>
              </div>
              <div>
                <small>Bonus bid</small>
                <strong>{money(activeBid.currentBonus)}</strong>
              </div>
              <div>
                <small>Turn</small>
                <strong>{nextLedger?.team.teamName ?? activeBid.nextTeamId}</strong>
              </div>
            </div>
            {canSeeBidActions || canCancelBid ? (
              <div className="bid-actions">
                {canSeeBidActions ? (
                  <>
                    <button
                      type="button"
                      disabled={draftLocked || draftAdjustmentActive || savingBid || !canRaiseBid}
                      onClick={() => void runBidAction('bump')}
                    >
                      {savingBid ? <span className="spinner" aria-label="Saving" /> : null}
                      {contestWinsPlayer ? 'Contest' : `+${money(currentEvent.bidIncrement)}`}
                    </button>
                    <button
                      className="text-button danger"
                      type="button"
                      disabled={draftLocked || draftAdjustmentActive || savingBid || !canActOnBid}
                      onClick={() => void runBidAction('forfeit')}
                    >
                      Forfeit
                    </button>
                  </>
                ) : null}
                {canCancelBid ? (
                  <button
                    className="text-button danger"
                    type="button"
                    disabled={draftLocked || savingBid}
                    onClick={() => void cancelBid()}
                  >
                    Cancel bid
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        {specOptions.length ? (
          <div className="spec-filter-row" aria-label="Filter signup pool by signed specs">
            <button
              type="button"
              className={!activeSelectedSpecs.length ? 'active' : ''}
              onClick={() => setSelectedSpecs([])}
            >
              All
            </button>
            {specOptions.map((spec) => (
              <button
                key={spec}
                type="button"
                className={selectedSpecs.includes(spec) ? 'active' : ''}
                onClick={() => toggleSpecFilter(spec)}
              >
                {spec}
              </button>
            ))}
          </div>
        ) : null}
        <div className={`available-list${!available.length ? ' available-list-empty' : ''}`}>
          {!draftEligibleCount ? (
            <div className="empty-inline">No draft-eligible signups are available for this event yet.</div>
          ) : activeSelectedSpecs.length && availablePlayers.length && !available.length ? (
            <div className="empty-inline">No undrafted players match the selected specs.</div>
          ) : !available.length ? (
            <div className="empty-inline">Every player has been drafted.</div>
          ) : available.map((player) => {
            const salary = salaryByPlayer.get(player.id) ?? 0
            const pickCost = pickTurn
              ? acquisitionCost(currentEvent, pickTurn.team.id, player.id, 0)
              : undefined
            const canPickPlayer = Boolean(
              canBid &&
                !draftLocked &&
                !draftAdjustmentActive &&
                isMyTurn &&
                draftReady &&
                !activeBid &&
                pickCost?.affordable,
            )
            return (
            <article className="player-card" key={player.id}>
              <div className="player-name">
                <div className="player-name-row">
                  <Link to="/players/$discordId" params={{ discordId: player.id }}>
                    <strong>
                      <PlayerName name={player.name} groupTag={player.groupTag} groupTagColor={player.groupTagColor} />
                    </strong>
                  </Link>
                  <CheckInBadge player={player} event={currentEvent} now={now} compact />
                </div>
                {player.specs?.length ? (
                  <div className="player-specs" aria-label={`${player.name} signed specs`}>
                    {player.specs.map((spec) => (
                      <span key={spec}>{spec}</span>
                    ))}
                  </div>
                ) : null}
              </div>
              <span>{currentEvent.ratings.length ? money(salary) : 'UNRATED'}</span>
              {isCaptain ? (
                <button
                  type="button"
                  disabled={!canPickPlayer || pickingPlayerId === player.id}
                  onClick={() => void pickPlayer(player.id)}
                >
                  {pickingPlayerId === player.id ? <span className="spinner" aria-label="Picking" /> : null}
                  Pick
                </button>
              ) : null}
              {ledgers.length && currentEvent.ratings.length ? (
                <div className="eligibility">
                  {ledgers.map((ledger) => (
                    <EligibilityChip
                      key={ledger.team.id}
                      label={ledger.team.teamName}
                      status={eligibilityStatus(currentEvent, ledger.team.id, player.id)}
                    />
                  ))}
                </div>
              ) : null}
            </article>
          )})}
        </div>
      </section>
    </div>
  )
}

function CheckInBadge({
  player,
  event,
  now,
  compact = false,
}: {
  player: HammaEvent['players'][number]
  event: HammaEvent
  now: number
  compact?: boolean
}) {
  const checkInWindow = getCheckInWindow(event, now)
  const status = player.checkedInAt ? 'checked' : checkInWindow.hasClosed ? 'missing' : 'pending'
  const label = status === 'checked' ? 'Checked in' : status === 'missing' ? 'No-show' : 'Pending'
  const compactLabel = status === 'checked' ? 'Checked in' : status === 'missing' ? 'No check-in' : 'Check-in pending'
  const title = player.checkedInAt
    ? `Check-in status: checked in at ${shortDate(player.checkedInAt)}`
    : `Check-in status: ${status === 'missing' ? 'not checked in' : 'pending'}`

  return (
    <span className={`check-in-badge ${status}${compact ? ' compact' : ''}`} title={title}>
      {compact ? compactLabel : label}
    </span>
  )
}

function EligibilityChip({
  label,
  status,
}: {
  label: string
  status: 'budget' | 'combined' | 'blocked'
}) {
  return (
    <span className={`eligibility-chip ${status}`} title={`${label}: ${status}`}>
      <strong>{initials(label)}</strong>
      <small>{status === 'budget' ? 'Budget' : status === 'combined' ? 'Combo' : 'Blocked'}</small>
    </span>
  )
}

function eligibilityStatus(
  event: HammaEvent,
  teamId: string,
  playerId: string,
): 'budget' | 'combined' | 'blocked' {
  const cost = acquisitionCost(event, teamId, playerId, 0)
  if (!cost?.affordable) return 'blocked'
  return cost.usesReach ? 'combined' : 'budget'
}

function initials(label: string) {
  const parts = label.trim().split(/\s+/)
  return parts.length > 1
    ? parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase()
    : label.slice(0, 2).toUpperCase()
}
