import { useEffect, useRef, useState } from 'react'
import { money } from '../lib/format'
import {
  acquisitionCost,
  buildTeamLedgers,
  calculatePlayerSalaries,
  canAcquirePlayer,
  getDraftReadiness,
  isDraftEligiblePlayer,
  nextDraftSide,
} from '../lib/rules'
import type { HammaEvent } from '../lib/types'
import { useRealtimeCurrentEvent } from '../lib/useRealtimeCurrentEvent'

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
  const [currentEvent, setCurrentEvent] = useRealtimeCurrentEvent(event)
  const [savingBid, setSavingBid] = useState(false)
  const [pickingPlayerId, setPickingPlayerId] = useState<string>()
  const [resettingPickId, setResettingPickId] = useState<string>()
  const [bidMessage, setBidMessage] = useState<{ text: string; tone: 'neutral' | 'success' | 'error' }>()
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
  const ledgers = buildTeamLedgers(currentEvent)
  const draftedIds = new Set(currentEvent.draftPicks.map((pick) => pick.playerId))
  const salaries = calculatePlayerSalaries(currentEvent)
  const salaryByPlayer = new Map(
    salaries.map((salary) => [salary.player.id, salary.salary]),
  )
  const available = currentEvent.players
    .filter(
      (player) =>
        isDraftEligiblePlayer(currentEvent, player) && !draftedIds.has(player.id),
    )
    .sort((a, b) => {
      const salaryDelta =
        (salaryByPlayer.get(b.id) ?? 0) - (salaryByPlayer.get(a.id) ?? 0)
      return salaryDelta || a.name.localeCompare(b.name)
    })
  const draftEligibleCount = currentEvent.players.filter((player) =>
    isDraftEligiblePlayer(currentEvent, player),
  ).length
  const isCaptain = ledgers.some((ledger) => ledger.team.captainDiscordId === userId)
  const draftReadiness = getDraftReadiness(currentEvent)
  const draftReady = draftReadiness.ready
  const draftStatus = draftReadiness
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
      canAcquirePlayer(
        currentEvent,
        nextLedger.team.id,
        activeBid.playerId,
        activeBid.currentBonus + currentEvent.bidIncrement,
      ),
  )

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
          <span className={`draft-status ${draftStatus.tone}`}>{draftStatus.label}</span>
        </div>
        {ledgers.length ? (
          <div className="team-grid compact">
            {ledgers.map((ledger, ledgerIndex) => {
              const isPickTurn = draftReady && !activeBid && pickTurn?.team.id === ledger.team.id
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
                      <dd>{money(ledger.budgetRemaining)}</dd>
                    </div>
                    <div>
                      <dt>Bonus left</dt>
                      <dd>{money(ledger.bonusRemaining)}</dd>
                    </div>
                    <div>
                      <dt>Total reach</dt>
                      <dd>{money(ledger.combinedRemaining)}</dd>
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
                          <span className="captain-pick-name">
                            {ledger.captainPlayer.name}
                            <span className="captain-crown" aria-hidden="true">
                              ♛
                            </span>
                          </span>
                          <small>Team</small>
                        </div>
                      </li>
                    ) : null}
                    {ledger.picks.map((pick) => (
                      <li key={pick.id}>
                        <div className="pick-main">
                          <span>{pick.player.name}</span>
                          <small>
                            {money(pick.salary)}
                            {pick.bonusSpent ? ` + ${money(pick.bonusSpent)}` : ''}
                          </small>
                        </div>
                        {canManageAll ? (
                          <button
                            className="text-button danger"
                            type="button"
                            disabled={resettingPickId === pick.id}
                            onClick={() => void resetPick(pick.id)}
                          >
                            {resettingPickId === pick.id ? <span className="spinner" aria-label="Resetting" /> : null}
                            Reset
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  <div className="team-count-chip">
                    {ledger.picks.length + (ledger.captainPlayer ? 1 : 0)}{' '}
                    {ledger.picks.length + (ledger.captainPlayer ? 1 : 0) === 1
                      ? 'player'
                      : 'players'}
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
              <h2>Current signup pool</h2>
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
                <strong>{bidPlayer?.name ?? activeBid.playerId}</strong>
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
                      disabled={savingBid || !canRaiseBid}
                      onClick={() => void runBidAction('bump')}
                    >
                      {savingBid ? <span className="spinner" aria-label="Saving" /> : null}
                      +{money(currentEvent.bidIncrement)}
                    </button>
                    <button
                      className="text-button danger"
                      type="button"
                      disabled={savingBid || !canActOnBid}
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
                    disabled={savingBid}
                    onClick={() => void cancelBid()}
                  >
                    Cancel bid
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="available-list">
          {!draftEligibleCount ? (
            <div className="empty-inline">No draft-eligible signups are available for this event yet.</div>
          ) : !available.length ? (
            <div className="empty-inline">Every draft-eligible signup has already been drafted.</div>
          ) : available.map((player) => {
            const salary = salaryByPlayer.get(player.id) ?? 0
            const pickCost = pickTurn
              ? acquisitionCost(currentEvent, pickTurn.team.id, player.id, 0)
              : undefined
            const canPickPlayer = Boolean(
              canBid &&
                isMyTurn &&
                draftReady &&
                !activeBid &&
                pickCost?.affordable,
            )
            return (
            <article className="player-card" key={player.id}>
              <div className="player-name">
                <strong>{player.name}</strong>
              </div>
              <span>{currentEvent.ratings.length ? money(salary) : 'TBD'}</span>
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
