import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import { PlayerName } from '../components/PlayerName'
import { pageMeta } from '../lib/meta'
import type { PlayerBadge, PlayerProfileSummary } from '../lib/types'

type PlayerDirectorySortKey = 'name' | 'rating' | 'events' | 'wins'
type PlayerDirectoryView = 'table' | 'grid'

const loadPlayerProfiles = createServerFn({ method: 'GET' }).handler(async () => {
  const { searchPlayerProfiles } = await import('../lib/db.server')
  return searchPlayerProfiles()
})

export const Route = createFileRoute('/players')({
  loader: () => loadPlayerProfiles(),
  head: () =>
    pageMeta({
      title: 'Player Profiles',
      description: 'Search HammaBowl player profiles, ratings, achievements, and linked characters.',
      path: '/players',
    }),
  component: PlayerDirectory,
})

function PlayerDirectory() {
  const profiles = Route.useLoaderData()
  const [view, setView] = useState<PlayerDirectoryView>('table')
  const [query, setQuery] = useState('')
  const [sortKey, setSortKey] = useState<PlayerDirectorySortKey>('name')
  const [sortDir, setSortDir] = useState(1)
  const [badgeFilter, setBadgeFilter] = useState('')
  const [eventFilter, setEventFilter] = useState('')
  const badgeOptions = useMemo(() => buildBadgeOptions(profiles), [profiles])
  const eventOptions = useMemo(() => buildEventOptions(profiles), [profiles])
  const filtered = useMemo(
    () => filterProfiles(profiles, query, badgeFilter, eventFilter),
    [profiles, query, badgeFilter, eventFilter],
  )
  const sorted = useMemo(
    () => sortProfiles(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir],
  )
  const hasActiveFilters = query.trim() !== '' || badgeFilter !== '' || eventFilter !== ''

  function toggleSort(key: PlayerDirectorySortKey) {
    if (sortKey === key) {
      setSortDir((d) => -d)
    } else {
      setSortKey(key)
      setSortDir(1)
    }
  }

  return (
    <main className="min-w-0">
      <section className="players-header">
        <div>
          <p className="eyebrow">Profile directory</p>
          <h1>Players</h1>
        </div>
        <div className="players-view-toggle">
          <button
            type="button"
            className={view === 'table' ? 'active' : ''}
            onClick={() => setView('table')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M3 9h18M3 15h18M9 3v18" />
            </svg>
            Table
          </button>
          <button
            type="button"
            className={view === 'grid' ? 'active' : ''}
            onClick={() => setView('grid')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            Grid
          </button>
        </div>
      </section>

      <section className="panel players-panel">
        <div className="players-toolbar">
          <div className="players-search-wrap">
            <svg className="players-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              className="players-search-input"
              value={query}
              placeholder="Search players, catchphrases…"
              onChange={(e) => setQuery(e.currentTarget.value)}
            />
          </div>
          <label className="players-filter-select">
            Badge
            <select value={badgeFilter} onChange={(e) => setBadgeFilter(e.currentTarget.value)}>
              <option value="">Any badge</option>
              {badgeOptions.map((badge) => (
                <option key={badge.id} value={badge.id}>{badge.name}</option>
              ))}
            </select>
          </label>
          <label className="players-filter-select">
            Event
            <select value={eventFilter} onChange={(e) => setEventFilter(e.currentTarget.value)}>
              <option value="">Any event</option>
              {eventOptions.map((event) => (
                <option key={event.id} value={event.id}>{event.name}</option>
              ))}
            </select>
          </label>
          {hasActiveFilters ? (
            <button
              type="button"
              className="players-clear-btn"
              onClick={() => { setQuery(''); setBadgeFilter(''); setEventFilter('') }}
            >
              Clear
            </button>
          ) : null}
          <span className="players-count-pill">
            {sorted.length} player{sorted.length === 1 ? '' : 's'}
          </span>
        </div>

        {sorted.length === 0 ? (
          <div className="empty-inline">No player profiles match that search.</div>
        ) : view === 'table' ? (
          <PlayersTableView
            players={sorted}
            sortKey={sortKey}
            sortDir={sortDir}
            onToggleSort={toggleSort}
          />
        ) : (
          <PlayersCardGrid players={sorted} />
        )}
      </section>
    </main>
  )
}

/* ── Table View ──────────────────────────────────────────────── */

function PlayersTableView({
  players,
  sortKey,
  sortDir,
  onToggleSort,
}: {
  players: PlayerProfileSummary[]
  sortKey: PlayerDirectorySortKey
  sortDir: number
  onToggleSort: (key: PlayerDirectorySortKey) => void
}) {
  return (
    <div className="players-table-wrap">
      <div className="players-table-header">
        <div />
        <SortButton label="Player" sortKey="name" activeKey={sortKey} dir={sortDir} onToggle={onToggleSort} />
        <SortButton label="Events" sortKey="events" activeKey={sortKey} dir={sortDir} onToggle={onToggleSort} />
        <SortButton label="Wins" sortKey="wins" activeKey={sortKey} dir={sortDir} onToggle={onToggleSort} />
        <SortButton label="Rating" sortKey="rating" activeKey={sortKey} dir={sortDir} onToggle={onToggleSort} />
      </div>
      {players.map((p, i) => (
        <Link
          key={p.discordId}
          to="/players/$discordId"
          params={{ discordId: p.discordId }}
          className={`players-table-row${i % 2 === 0 ? '' : ' alt'}`}
        >
          <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size={34} />
          <div className="players-table-name-cell">
            <strong>
              <PlayerName name={p.name} groupTag={p.groupTag} groupTagColor={p.groupTagColor} />
            </strong>
            {p.badges.length > 0 ? (
              <div className="players-badge-row">
                {p.badges.slice(0, 2).map((b) => (
                  <BadgeChip key={b.id} badge={b} />
                ))}
                {p.badges.length > 2 ? (
                  <span className="players-badge-overflow">+{p.badges.length - 2}</span>
                ) : null}
              </div>
            ) : null}
          </div>
          <span className="players-table-stat">{p.eventCount}</span>
          <span className={`players-table-stat${p.winCount > 0 ? ' gold' : ' muted'}`}>{p.winCount}</span>
          <RatingBar rating={p.averageRating} />
        </Link>
      ))}
    </div>
  )
}

function SortButton({
  label,
  sortKey,
  activeKey,
  dir,
  onToggle,
}: {
  label: string
  sortKey: PlayerDirectorySortKey
  activeKey: PlayerDirectorySortKey
  dir: number
  onToggle: (key: PlayerDirectorySortKey) => void
}) {
  const active = activeKey === sortKey
  return (
    <button
      type="button"
      className={`players-sort-btn${active ? ' active' : ''}`}
      onClick={() => onToggle(sortKey)}
    >
      {label}
      {active ? <span className="players-sort-arrow">{dir > 0 ? '▲' : '▼'}</span> : null}
    </button>
  )
}

function RatingBar({ rating }: { rating: number | null }) {
  if (rating === null) {
    return <span className="players-rating-tbd">UNRATED</span>
  }
  const pct = ((rating - 1) / 9) * 100
  const tier = rating >= 8.5 ? 'high' : rating >= 7 ? 'mid' : 'low'
  return (
    <div className="players-rating-bar">
      <div className="players-rating-track">
        <div className={`players-rating-fill ${tier}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`players-rating-value ${tier}`}>{rating.toFixed(1)}</span>
    </div>
  )
}

/* ── Card Grid View ──────────────────────────────────────────── */

function PlayersCardGrid({ players }: { players: PlayerProfileSummary[] }) {
  return (
    <div className="players-card-grid">
      {players.map((p) => (
        <Link
          key={p.discordId}
          to="/players/$discordId"
          params={{ discordId: p.discordId }}
          className="players-card"
        >
          <div
            className="players-card-banner"
            style={p.bannerUrl ? { backgroundImage: `url(${p.bannerUrl})` } : undefined}
          />
          <div className="players-card-body">
            <div className="players-card-identity">
              <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size={46} />
            </div>
            <div className="players-card-name">
              <PlayerName name={p.name} groupTag={p.groupTag} groupTagColor={p.groupTagColor} />
            </div>
            {p.catchphrase ? (
              <div className="players-card-catchphrase">{p.catchphrase}</div>
            ) : null}
            <div className="players-card-stats">
              <div className="players-card-stat">
                <span className="players-card-stat-label">Events</span>
                <span className="players-card-stat-value">{p.eventCount}</span>
              </div>
              <div className="players-card-stat">
                <span className="players-card-stat-label">Wins</span>
                <span className={`players-card-stat-value${p.winCount > 0 ? ' gold' : ''}`}>{p.winCount}</span>
              </div>
              <div className="players-card-stat">
                <span className="players-card-stat-label">Rating</span>
                <span className={`players-card-stat-value${p.averageRating !== null && p.averageRating >= 8 ? ' gold' : ''}`}>
                  {p.averageRating === null ? 'UNRATED' : p.averageRating.toFixed(1)}
                </span>
              </div>
            </div>
            {p.badges.length > 0 ? (
              <div className="players-card-badges">
                {p.badges.map((b) => (
                  <BadgeChip key={b.id} badge={b} />
                ))}
              </div>
            ) : null}
          </div>
        </Link>
      ))}
    </div>
  )
}

/* ── Shared Atoms ────────────────────────────────────────────── */

function PlayerAvatar({
  name,
  avatarUrl,
  size = 34,
}: {
  name: string
  avatarUrl?: string
  size?: number
}) {
  if (avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        className="players-avatar"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span className="players-avatar players-avatar-initial" style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {name[0]?.toUpperCase()}
    </span>
  )
}

function BadgeChip({ badge }: { badge: PlayerBadge }) {
  return (
    <span
      className="players-badge-chip"
      style={{ '--badge-color': badge.color } as CSSProperties}
      title={badge.description}
    >
      {badge.name}
    </span>
  )
}

/* ── Filter/Sort Logic ───────────────────────────────────────── */

function filterProfiles(
  profiles: PlayerProfileSummary[],
  query: string,
  badgeFilter: string,
  eventFilter: string,
) {
  const normalized = query.trim().toLowerCase()

  return profiles.filter(
    (profile) =>
      (!badgeFilter || profile.badges.some((badge) => badge.id === badgeFilter)) &&
      (!eventFilter || profile.events.some((event) => event.id === eventFilter)) &&
      (!normalized ||
        [
          profile.name,
          profile.catchphrase ?? '',
          profile.averageRating === null ? 'unrated' : profile.averageRating.toFixed(2),
          `${profile.eventCount} events`,
          `${profile.winCount} wins`,
          ...profile.badges.map((badge) => badge.name),
          ...profile.events.map((event) => event.name),
        ]
          .join(' ')
          .toLowerCase()
          .includes(normalized)),
  )
}

function sortProfiles(
  profiles: PlayerProfileSummary[],
  key: PlayerDirectorySortKey,
  dir: number,
) {
  return [...profiles].sort((a, b) => {
    const nameComp = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })

    if (key === 'name') return dir * nameComp

    if (key === 'events') {
      const evComp = b.eventCount - a.eventCount
      return dir > 0 ? (evComp || nameComp) : (-evComp || nameComp)
    }

    if (key === 'wins') {
      const winComp = b.winCount - a.winCount
      return dir > 0 ? (winComp || nameComp) : (-winComp || nameComp)
    }

    const aR = a.averageRating
    const bR = b.averageRating
    if (aR === null && bR === null) return nameComp
    if (aR === null) return 1
    if (bR === null) return -1
    const rComp = bR - aR
    return dir > 0 ? (rComp || nameComp) : (-rComp || nameComp)
  })
}

function buildBadgeOptions(profiles: PlayerProfileSummary[]) {
  const badges = new Map<string, { id: string; name: string }>()
  for (const profile of profiles) {
    for (const badge of profile.badges) {
      badges.set(badge.id, { id: badge.id, name: badge.name })
    }
  }
  return [...badges.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
  )
}

function buildEventOptions(profiles: PlayerProfileSummary[]) {
  const events = new Map<string, { id: string; name: string; startsAt: string }>()
  for (const profile of profiles) {
    for (const event of profile.events) {
      events.set(event.id, event)
    }
  }
  return [...events.values()].sort((a, b) => b.startsAt.localeCompare(a.startsAt))
}
