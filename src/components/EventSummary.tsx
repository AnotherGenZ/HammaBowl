import { money, percent, shortDate } from '../lib/format'
import { buildTeamLedgers } from '../lib/rules'
import type { HammaEvent } from '../lib/types'
import { Countdown } from './Countdown'

export function EventSummary({ event }: { event: HammaEvent }) {
  const ledgers = buildTeamLedgers(event)
  const drafted = event.draftPicks.length

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
      <Countdown target={event.closingTime} />
      <div className="stat-strip">
        <Metric label="Salary pool" value={money(event.salaryPool)} />
        <Metric label="Signups" value={event.players.length.toString()} />
        <Metric label="Pending Players" value={event.pendingPlayerCount.toString()} />
        <Metric label="Drafted" value={`${drafted}/${event.players.length}`} />
      </div>
      {ledgers.length ? (
        <div className="team-grid">
          {ledgers.map((ledger) => (
          <article className="team-panel" key={ledger.captain.id}>
            <div>
              <h2>{ledger.captain.teamName}</h2>
            </div>
            <strong className="score">{ledger.captain.score}</strong>
            <dl>
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
                <dd>{percent(ledger.salarySpent / ledger.captain.budget)}</dd>
              </div>
            </dl>
          </article>
          ))}
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
