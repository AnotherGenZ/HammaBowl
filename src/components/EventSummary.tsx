import { money, percent, shortDate } from '../lib/format'
import { buildTeamLedgers } from '../lib/rules'
import type { HammaEvent } from '../lib/types'
import { Countdown } from './Countdown'

export function EventSummary({ event }: { event: HammaEvent }) {
  const ledgers = buildTeamLedgers(event)
  const drafted = event.draftPicks.length
  const eventStarted = Date.now() >= Date.parse(event.startsAt)

  return (
    <section className="event-hero">
      <div>
        <h1>{event.name}</h1>
        <div className="meta-row">
          <span>{shortDate(event.startsAt)}</span>
          {event.twitchStreamUrl ? (
            <a href={event.twitchStreamUrl} target="_blank" rel="noreferrer">
              Stream
            </a>
          ) : null}
          {event.twitchVodUrl ? (
            <a href={event.twitchVodUrl} target="_blank" rel="noreferrer">
              VOD
            </a>
          ) : null}
        </div>
      </div>
      <Countdown
        closingTime={event.closingTime}
        startsAt={event.startsAt}
        draftStartMinutesBefore={event.draftStartMinutesBefore}
      />
      <div className="stat-strip">
        <Metric label="Salary pool" value={money(event.salaryPool)} />
        <Metric label="Signups" value={event.players.length.toString()} />
        <Metric label="Pending Players" value={event.pendingPlayerCount.toString()} />
        <Metric label="Drafted" value={`${drafted}/${event.players.length}`} />
      </div>
      {ledgers.length ? (
        <div className="team-grid">
          {ledgers.map((ledger) => {
            const memberCount = ledger.picks.length + (ledger.captainPlayer ? 1 : 0)
            return (
          <article className="team-panel summary-team-panel" key={ledger.team.id}>
            <div>
              <h2>{ledger.team.teamName}</h2>
            </div>
            {eventStarted ? <strong className="score">{ledger.team.score}</strong> : null}
            <dl>
              <div>
                <dt>Members</dt>
                <dd>{memberCount}</dd>
              </div>
              <div>
                <dt>Budget</dt>
                <dd>{money(ledger.budgetRemaining)}</dd>
              </div>
              <div>
                <dt>Bonus cap</dt>
                <dd>{money(ledger.bonusRemaining)}</dd>
              </div>
              <div>
                <dt>Committed</dt>
                <dd>{percent(ledger.salarySpent / ledger.team.budget)}</dd>
              </div>
            </dl>
          </article>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
