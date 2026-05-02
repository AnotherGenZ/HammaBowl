import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import { pageMeta } from '../lib/meta'
import type { PlayerProfileSummary } from '../lib/types'

type PlayerDirectorySortMode = 'name-asc' | 'name-desc' | 'rating-desc' | 'rating-asc' | 'events-desc'

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
  const [query, setQuery] = useState('')
  const [sortMode, setSortMode] = useState<PlayerDirectorySortMode>('name-asc')
  const [badgeFilter, setBadgeFilter] = useState('')
  const [eventFilter, setEventFilter] = useState('')
  const badgeOptions = useMemo(() => buildBadgeOptions(profiles), [profiles])
  const eventOptions = useMemo(() => buildEventOptions(profiles), [profiles])
  const filteredProfiles = useMemo(
    () => sortProfiles(filterProfiles(profiles, query, badgeFilter, eventFilter), sortMode),
    [profiles, query, badgeFilter, eventFilter, sortMode],
  )
  const hasActiveFilters = query.trim() !== '' || badgeFilter !== '' || eventFilter !== ''

  return (
    <main>
      <section className="event-hero compact-hero">
        <div>
          <p className="eyebrow">Profile directory</p>
          <h1>Players</h1>
        </div>
      </section>

      <section className="panel player-directory-panel">
        <div className="directory-toolbar">
          <label>
            Search profiles
            <input
              value={query}
              placeholder="Name, catchphrase, rating..."
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
          </label>
          <label>
            Sort
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.currentTarget.value as PlayerDirectorySortMode)}
            >
              <option value="name-asc">A-Z</option>
              <option value="name-desc">Z-A</option>
              <option value="rating-desc">Rating high-low</option>
              <option value="rating-asc">Rating low-high</option>
              <option value="events-desc">Most events</option>
            </select>
          </label>
          <label>
            Badge
            <select value={badgeFilter} onChange={(event) => setBadgeFilter(event.currentTarget.value)}>
              <option value="">Any badge</option>
              {badgeOptions.map((badge) => (
                <option key={badge.id} value={badge.id}>
                  {badge.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Event
            <select value={eventFilter} onChange={(event) => setEventFilter(event.currentTarget.value)}>
              <option value="">Any event</option>
              {eventOptions.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.name}
                </option>
              ))}
            </select>
          </label>
          {hasActiveFilters ? (
            <button
              type="button"
              className="directory-clear-button"
              onClick={() => {
                setQuery('')
                setBadgeFilter('')
                setEventFilter('')
              }}
            >
              Clear
            </button>
          ) : null}
          <span className="pill">
            {filteredProfiles.length} player{filteredProfiles.length === 1 ? '' : 's'}
          </span>
        </div>

        {filteredProfiles.length ? (
          <div className="profile-directory-grid">
            {filteredProfiles.map((profile) => (
              <Link
                key={profile.discordId}
                to="/players/$discordId"
                params={{ discordId: profile.discordId }}
                className="profile-directory-card"
              >
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="" />
                ) : (
                  <span>{profile.name.slice(0, 1)}</span>
                )}
                <div>
                  <strong>{profile.name}</strong>
                  <p>{profile.catchphrase ?? ''}</p>
                  <div className="profile-directory-stats">
                    <small>{profile.eventCount} event{profile.eventCount === 1 ? '' : 's'}</small>
                    <small>{profile.winCount} win{profile.winCount === 1 ? '' : 's'}</small>
                    <small>
                      {profile.averageRating === null ? 'TBD rating' : `${profile.averageRating.toFixed(2)} rating`}
                    </small>
                    {profile.badges.map((badge) => (
                      <small key={badge.id} title={badge.description} style={badgeStyle(badge.color)}>
                        {badge.name}
                      </small>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="empty-inline">No player profiles match that search.</div>
        )}
      </section>
    </main>
  )
}

function badgeStyle(color: string) {
  return { '--badge-color': color } as CSSProperties
}

function filterProfiles(
  profiles: PlayerProfileSummary[],
  query: string,
  badgeFilter: string,
  eventFilter: string,
) {
  const normalized = query.trim().toLowerCase()

  return profiles.filter((profile) =>
    (!badgeFilter || profile.badges.some((badge) => badge.id === badgeFilter)) &&
    (!eventFilter || profile.events.some((event) => event.id === eventFilter)) &&
    (!normalized ||
      [
        profile.name,
        profile.catchphrase ?? '',
        profile.averageRating === null ? 'tbd' : profile.averageRating.toFixed(2),
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

function sortProfiles(profiles: PlayerProfileSummary[], sortMode: PlayerDirectorySortMode) {
  return [...profiles].sort((a, b) => {
    const nameComparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    if (sortMode === 'name-asc') return nameComparison
    if (sortMode === 'name-desc') return -nameComparison
    if (sortMode === 'events-desc') {
      const eventComparison = b.eventCount - a.eventCount
      return eventComparison || nameComparison
    }

    const aRating = a.averageRating
    const bRating = b.averageRating
    const aIsRated = aRating !== null
    const bIsRated = bRating !== null

    if (aIsRated !== bIsRated) return aIsRated ? -1 : 1
    if (!aIsRated || !bIsRated) return nameComparison

    const ratingComparison = aRating - bRating
    if (ratingComparison === 0) return nameComparison
    return sortMode === 'rating-asc' ? ratingComparison : -ratingComparison
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
