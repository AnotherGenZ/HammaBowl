import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import { PlayerName } from '../components/PlayerName'
import { pageMeta } from '../lib/meta'
import type { PlayerBadge, PlayerProfileSummary } from '../lib/types'
import {
  eyebrowClass,
  playersAvatarClass,
  playersAvatarInitialClass,
  playersBadgeChipClass,
  playersBadgeOverflowClass,
  playersBadgeRowClass,
  playersCardBadgesClass,
  playersCardBannerClass,
  playersCardBodyClass,
  playersCardCatchphraseClass,
  playersCardClass,
  playersCardGridClass,
  playersCardIdentityClass,
  playersCardNameClass,
  playersCardStatClass,
  playersCardStatLabelClass,
  playersCardStatValueClass,
  playersCardStatsClass,
  playersClearButtonClass,
  playersCountPillClass,
  playersFilterSelectClass,
  playersHeaderClass,
  playersPanelClass,
  playersRatingBarClass,
  playersRatingFillClass,
  playersRatingTbdClass,
  playersRatingTrackClass,
  playersRatingValueClass,
  playersSearchIconClass,
  playersSearchInputClass,
  playersSearchWrapClass,
  playersSortArrowClass,
  playersSortButtonClass,
  playersTableHeaderClass,
  playersTableNameCellClass,
  playersTableRowClass,
  playersTableStatClass,
  playersTableWrapClass,
  playersToolbarClass,
  playersViewToggleButtonClass,
  playersViewToggleClass,
} from '../lib/ui'

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
    <main className="min-w-0 mx-auto w-[min(1180px,calc(100%_-_32px))] py-7 pb-[54px] max-[1023px]:w-[min(100%_-_24px,1180px)] max-[1023px]:py-[18px] max-[1023px]:pb-[42px] max-[480px]:w-[min(100%_-_18px,1180px)]">
      <section className={playersHeaderClass}>
        <div>
          <p className={eyebrowClass}>Profile directory</p>
          <h1>Players</h1>
        </div>
        <div className={playersViewToggleClass}>
          <button
            type="button"
            className={playersViewToggleButtonClass(view === 'table')}
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
            className={playersViewToggleButtonClass(view === 'grid')}
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

      <section className={playersPanelClass}>
        <div className={playersToolbarClass}>
          <div className={playersSearchWrapClass}>
            <svg className={playersSearchIconClass} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
            <input
              className={playersSearchInputClass}
              value={query}
              placeholder="Search players, catchphrases…"
              onChange={(e) => setQuery(e.currentTarget.value)}
            />
          </div>
          <label className={playersFilterSelectClass}>
            Badge
            <select value={badgeFilter} onChange={(e) => setBadgeFilter(e.currentTarget.value)}>
              <option value="">Any badge</option>
              {badgeOptions.map((badge) => (
                <option key={badge.id} value={badge.id}>{badge.name}</option>
              ))}
            </select>
          </label>
          <label className={playersFilterSelectClass}>
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
              className={playersClearButtonClass}
              onClick={() => { setQuery(''); setBadgeFilter(''); setEventFilter('') }}
            >
              Clear
            </button>
          ) : null}
          <span className={playersCountPillClass}>
            {sorted.length} player{sorted.length === 1 ? '' : 's'}
          </span>
        </div>

        {sorted.length === 0 ? (
          <div className="empty-inline flex min-h-11 w-full items-center gap-2 rounded-lg border border-dashed border-white/[0.12] bg-white/[0.04] px-3.5 py-3 font-bold text-[#b4bcbb]">No player profiles match that search.</div>
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
    <div className={playersTableWrapClass}>
      <div className={playersTableHeaderClass}>
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
          className={playersTableRowClass(i % 2 !== 0)}
        >
          <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size={34} />
          <div className={playersTableNameCellClass}>
            <strong>
              <PlayerName name={p.name} groupTag={p.groupTag} groupTagColor={p.groupTagColor} />
            </strong>
            {p.badges.length > 0 ? (
              <div className={playersBadgeRowClass}>
                {p.badges.slice(0, 2).map((b) => (
                  <BadgeChip key={b.id} badge={b} />
                ))}
                {p.badges.length > 2 ? (
                  <span className={playersBadgeOverflowClass}>+{p.badges.length - 2}</span>
                ) : null}
              </div>
            ) : null}
          </div>
          <span className={playersTableStatClass()}>{p.eventCount}</span>
          <span className={playersTableStatClass(p.winCount > 0 ? 'gold' : 'muted')}>{p.winCount}</span>
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
      className={playersSortButtonClass(active)}
      onClick={() => onToggle(sortKey)}
    >
      {label}
      {active ? <span className={playersSortArrowClass}>{dir > 0 ? '▲' : '▼'}</span> : null}
    </button>
  )
}

function RatingBar({ rating }: { rating: number | null }) {
  if (rating === null) {
    return <span className={playersRatingTbdClass}>UNRATED</span>
  }
  const pct = ((rating - 1) / 9) * 100
  const tier = rating >= 8.5 ? 'high' : rating >= 7 ? 'mid' : 'low'
  return (
    <div className={playersRatingBarClass}>
      <div className={playersRatingTrackClass}>
        <div className={playersRatingFillClass(tier)} style={{ width: `${pct}%` }} />
      </div>
      <span className={playersRatingValueClass(tier)}>{rating.toFixed(1)}</span>
    </div>
  )
}

/* ── Card Grid View ──────────────────────────────────────────── */

function PlayersCardGrid({ players }: { players: PlayerProfileSummary[] }) {
  return (
    <div className={playersCardGridClass}>
      {players.map((p) => (
        <Link
          key={p.discordId}
          to="/players/$discordId"
          params={{ discordId: p.discordId }}
          className={playersCardClass}
        >
          <div
            className={playersCardBannerClass}
            style={p.bannerUrl ? { backgroundImage: `url(${p.bannerUrl})` } : undefined}
          />
          <div className={playersCardBodyClass}>
            <div className={playersCardIdentityClass}>
              <PlayerAvatar name={p.name} avatarUrl={p.avatarUrl} size={46} />
            </div>
            <div className={playersCardNameClass}>
              <PlayerName name={p.name} groupTag={p.groupTag} groupTagColor={p.groupTagColor} />
            </div>
            {p.catchphrase ? (
              <div className={playersCardCatchphraseClass}>{p.catchphrase}</div>
            ) : null}
            <div className={playersCardStatsClass}>
              <div className={playersCardStatClass}>
                <span className={playersCardStatLabelClass}>Events</span>
                <span className={playersCardStatValueClass()}>{p.eventCount}</span>
              </div>
              <div className={playersCardStatClass}>
                <span className={playersCardStatLabelClass}>Wins</span>
                <span className={playersCardStatValueClass(p.winCount > 0)}>{p.winCount}</span>
              </div>
              <div className={playersCardStatClass}>
                <span className={playersCardStatLabelClass}>Rating</span>
                <span className={playersCardStatValueClass(p.averageRating !== null && p.averageRating >= 8)}>
                  {p.averageRating === null ? 'UNRATED' : p.averageRating.toFixed(1)}
                </span>
              </div>
            </div>
            {p.badges.length > 0 ? (
              <div className={playersCardBadgesClass}>
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
        className={playersAvatarClass}
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span className={playersAvatarInitialClass} style={{ width: size, height: size, fontSize: size * 0.38 }}>
      {name[0]?.toUpperCase()}
    </span>
  )
}

function BadgeChip({ badge }: { badge: PlayerBadge }) {
  return (
    <span
      className={playersBadgeChipClass}
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
