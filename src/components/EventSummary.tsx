import { CalendarClock, Swords, UserCheck, type LucideIcon } from 'lucide-react'
import { money, percent, shortDateWithTimeZone } from '../lib/format'
import { buildTeamLedgers } from '../lib/rules'
import type { HammaEvent } from '../lib/types'
import { Countdown } from './Countdown'
import { EventLinkIcon } from './EventLinkIcons'

export function EventSummary({ event }: { event: HammaEvent }) {
  const ledgers = buildTeamLedgers(event)
  const drafted = event.draftPicks.length
  const eventStarted = Date.now() >= Date.parse(event.startsAt)
  const eventTimes = buildEventTimes(event)

  return (
    <section className="event-hero">
      <div>
        <h1>{event.name}</h1>
        {event.eventDescription ? (
          <p className="event-description">{event.eventDescription}</p>
        ) : null}
        <div className="event-link-badges" aria-label="Event details and links">
          {eventTimes.map((item) => {
            const Icon = item.icon
            const formattedTime = shortDateWithTimeZone(item.time)

            return (
              <span
                className={`event-time-badge ${item.className}`}
                key={item.label}
                title={`${item.label}: ${formattedTime}`}
                aria-label={`${item.label}: ${formattedTime}`}
              >
                <Icon size={16} aria-hidden="true" />
                <strong>{formattedTime}</strong>
              </span>
            )
          })}
          {event.eventLinks.map((link) => (
            <a key={`${link.url}-${link.name}`} href={link.url} target="_blank" rel="noreferrer">
              <EventLinkIcon name={link.icon} />
              <span>{link.name}</span>
            </a>
          ))}
        </div>
        {event.twitchStreamUrl || event.twitchVodUrl ? (
          <div className="meta-row">
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
        ) : null}
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

type EventTime = {
  label: string
  time: string
  className: string
  icon: LucideIcon
}

function buildEventTimes(event: HammaEvent) {
  const times: EventTime[] = [
    {
      label: 'Event start',
      time: event.startsAt,
      className: 'event-time-badge-start',
      icon: CalendarClock,
    },
  ]

  if (event.closingTime) {
    times.push({
      label: 'Signups close',
      time: event.closingTime,
      className: 'event-time-badge-signups',
      icon: UserCheck,
    })
  }

  if (typeof event.draftStartMinutesBefore === 'number') {
    const startTime = Date.parse(event.startsAt)

    if (Number.isFinite(startTime)) {
      times.push({
        label: 'Draft start',
        time: new Date(startTime - event.draftStartMinutesBefore * 60_000).toISOString(),
        className: 'event-time-badge-draft',
        icon: Swords,
      })
    }
  }

  return times
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}
