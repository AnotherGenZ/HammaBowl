import { useEffect, useRef, useState } from 'react'
import { money } from '../lib/format'
import {
  buildTeamLedgers,
  calculatePlayerSalaries,
  canAcquirePlayer,
  isDraftEligiblePlayer,
  nextDraftSide,
} from '../lib/rules'
import type { HammaEvent } from '../lib/types'
import { useRealtimeCurrentEvent } from '../lib/useRealtimeCurrentEvent'

const BID_INCREMENT = 1_000_000

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
  const [bidOpen, setBidOpen] = useState(false)
  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  const [selectedTeamId, setSelectedTeamId] = useState('')
  const [savingBid, setSavingBid] = useState(false)
  const [resettingPickId, setResettingPickId] = useState<string>()
  const [bidMessage, setBidMessage] = useState<string>()
  const pickListRefs = useRef<Array<HTMLUListElement | null>>([])
  const syncingPickScroll = useRef(false)

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
  const allowedLedgers = canManageAll
    ? ledgers
    : ledgers.filter((ledger) => ledger.captain.playerId === userId)
  const draftReady = ledgers.length >= 2 && currentEvent.ratings.length > 0
  const draftStatus = !ledgers.length
    ? { label: 'Teams', tone: 'blocked' }
    : !currentEvent.ratings.length
      ? { label: 'Ratings', tone: 'pending' }
      : { label: 'Ready', tone: 'ready' }
  const activeBid = currentEvent.activeDraftBid
  const pickTurn = nextDraftSide(currentEvent)
  const openingLedgers = pickTurn
    ? allowedLedgers.filter((ledger) => ledger.captain.id === pickTurn.captain.id)
    : []
  const selectedPlayer = available.find((player) => player.id === selectedPlayerId)
  const selectedSalary = selectedPlayerId ? salaryByPlayer.get(selectedPlayerId) ?? 0 : 0
  const bidPlayer = activeBid
    ? currentEvent.players.find((player) => player.id === activeBid.playerId)
    : undefined
  const highestLedger = activeBid
    ? ledgers.find((ledger) => ledger.captain.id === activeBid.highestCaptainId)
    : undefined
  const nextLedger = activeBid
    ? ledgers.find((ledger) => ledger.captain.id === activeBid.nextCaptainId)
    : undefined
  const canActOnBid = Boolean(
    activeBid &&
      nextLedger &&
      (canManageAll || nextLedger.captain.playerId === userId),
  )
  const canRaiseBid = Boolean(
    activeBid &&
      nextLedger &&
      canAcquirePlayer(
        currentEvent,
        nextLedger.captain.id,
        activeBid.playerId,
        activeBid.currentBonus + BID_INCREMENT,
      ),
  )
  const canOpenBid = Boolean(
    canBid &&
      draftReady &&
      openingLedgers.length &&
      !activeBid &&
      Boolean(pickTurn),
  )

  useEffect(() => {
    if (!selectedPlayerId && available[0]) setSelectedPlayerId(available[0].id)
  }, [available, selectedPlayerId])

  useEffect(() => {
    if (!openingLedgers.length) {
      if (selectedTeamId) setSelectedTeamId('')
      return
    }

    if (!openingLedgers.some((ledger) => ledger.captain.id === selectedTeamId)) {
      setSelectedTeamId(openingLedgers[0].captain.id)
    }
  }, [openingLedgers, selectedTeamId])

  async function runBidAction(action: 'open' | 'bump' | 'forfeit') {
    const actionTeamId = action === 'open' ? selectedTeamId : activeBid?.nextCaptainId
    const actionPlayerId = action === 'open' ? selectedPlayerId : activeBid?.playerId
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
      setBidMessage(payload.message ?? 'Bid updated.')
      if (action !== 'bump') setSelectedPlayerId('')
      if (action === 'open') setBidOpen(false)
    } catch (error) {
      setBidMessage(error instanceof Error ? error.message : 'Unable to update bid.')
    } finally {
      setSavingBid(false)
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
      setBidMessage(payload.message ?? 'Bid cancelled.')
    } catch (error) {
      setBidMessage(error instanceof Error ? error.message : 'Unable to cancel bid.')
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
      setBidMessage(payload.message ?? 'Pick reset.')
    } catch (error) {
      setBidMessage(error instanceof Error ? error.message : 'Unable to reset pick.')
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
            {ledgers.map((ledger, ledgerIndex) => (
              <article className="team-panel" key={ledger.captain.id}>
                <div className="team-title-row">
                  <h2>{ledger.captain.teamName}</h2>
                  {draftReady && !activeBid && pickTurn?.captain.id === ledger.captain.id ? (
                    <span className="pick-turn-chip">Pick turn</span>
                  ) : null}
                </div>
                <div className="team-meta-row">
                  <span>
                    <small>Faction</small>
                    <strong>{ledger.captain.faction ?? 'TBD'}</strong>
                  </span>
                  <span>
                    <small>Side</small>
                    <strong>{ledger.captain.startingSide ?? 'TBD'}</strong>
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
                        <small>Captain</small>
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
            ))}
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
          {canOpenBid ? (
            <button type="button" onClick={() => setBidOpen((open) => !open)}>
              {bidOpen ? 'Close bid' : 'Open bid'}
            </button>
          ) : null}
        </div>
        {activeBid ? (
          <div className="active-bid-panel">
            <div>
              <small>Player</small>
              <strong>{bidPlayer?.name ?? activeBid.playerId}</strong>
            </div>
            <div>
              <small>Leading</small>
              <strong>{highestLedger?.captain.teamName ?? activeBid.highestCaptainId}</strong>
            </div>
            <div>
              <small>Bonus bid</small>
              <strong>{money(activeBid.currentBonus)}</strong>
            </div>
            <div>
              <small>Turn</small>
              <strong>{nextLedger?.captain.teamName ?? activeBid.nextCaptainId}</strong>
            </div>
            {canActOnBid ? (
              <div className="bid-actions">
                <button
                  type="button"
                  disabled={savingBid || !canRaiseBid}
                  onClick={() => void runBidAction('bump')}
                >
                  +{money(BID_INCREMENT)}
                </button>
                <button
                  className="text-button danger"
                  type="button"
                  disabled={savingBid}
                  onClick={() => void runBidAction('forfeit')}
                >
                  Forfeit
                </button>
              </div>
            ) : null}
            {canCancelBid ? (
              <button
                className="text-button danger"
                type="button"
                disabled={savingBid}
                onClick={() => void cancelBid()}
              >
                Cancel
              </button>
            ) : null}
            {bidMessage ? <div className="admin-result">{bidMessage}</div> : null}
          </div>
        ) : null}
        {bidOpen ? (
          <div className="bid-panel">
            <label>
              Player
              <select
                value={selectedPlayerId}
                onChange={(event) => setSelectedPlayerId(event.currentTarget.value)}
              >
                {available.map((player) => (
                  <option value={player.id} key={player.id}>
                    {player.name} - {money(salaryByPlayer.get(player.id) ?? 0)}
                  </option>
                ))}
              </select>
            </label>
            {canManageAll ? (
              <label>
                Team
                <select
                  value={selectedTeamId}
                  onChange={(event) => setSelectedTeamId(event.currentTarget.value)}
                >
                  {openingLedgers.map((ledger) => (
                    <option value={ledger.captain.id} key={ledger.captain.id}>
                      {ledger.captain.teamName}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="locked-field">
                <small>Team</small>
                <strong>{openingLedgers[0]?.captain.teamName ?? 'Unassigned'}</strong>
              </div>
            )}
            <div className="bid-summary">
              <span>{selectedPlayer ? money(selectedSalary) : 'No player'}</span>
              <small>Opening pick</small>
            </div>
            <button
              type="button"
              disabled={savingBid || !available.length || !selectedTeamId}
              onClick={() => void runBidAction('open')}
            >
              Start bid
            </button>
            {bidMessage ? <div className="admin-result">{bidMessage}</div> : null}
          </div>
        ) : null}
        <div className="available-list">
          {!draftEligibleCount ? (
            <div className="empty-inline">No draft-eligible signups are available for this event yet.</div>
          ) : !available.length ? (
            <div className="empty-inline">Every draft-eligible signup has already been drafted.</div>
          ) : available.map((player) => {
            const salary = salaryByPlayer.get(player.id) ?? 0
            return (
            <article className="player-card" key={player.id}>
              <div className="player-name">
                <strong>{player.name}</strong>
              </div>
              <span>{currentEvent.ratings.length ? money(salary) : 'TBD'}</span>
              {ledgers.length && currentEvent.ratings.length ? (
                <div className="eligibility">
                  {ledgers.map((ledger) => (
                    <EligibilityChip
                      key={ledger.captain.id}
                      label={ledger.captain.teamName}
                      status={
                        canAcquirePlayer(currentEvent, ledger.captain.id, player.id)
                          ? 'budget'
                          : canAcquirePlayer(
                                currentEvent,
                                ledger.captain.id,
                                player.id,
                                Math.max(0, salary - ledger.budgetRemaining),
                              )
                            ? 'combined'
                            : 'blocked'
                      }
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

function initials(label: string) {
  const parts = label.trim().split(/\s+/)
  return parts.length > 1
    ? parts.slice(0, 2).map((part) => part[0]).join('').toUpperCase()
    : label.slice(0, 2).toUpperCase()
}
