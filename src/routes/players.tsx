import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import { pageMeta } from '../lib/meta'
import type { PlayerProfileSummary } from '../lib/types'

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
  const filteredProfiles = useMemo(() => filterProfiles(profiles, query), [profiles, query])

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
                  {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <span>{profile.name.slice(0, 1)}</span>}
                <div>
                  <strong>{profile.name}</strong>
                  <p>{profile.catchphrase ?? ''}</p>
                  <div className="profile-directory-stats">
                    <small>{profile.eventCount} event{profile.eventCount === 1 ? '' : 's'}</small>
                    <small>{profile.winCount} win{profile.winCount === 1 ? '' : 's'}</small>
                    <small>{profile.averageRating === null ? 'TBD rating' : `${profile.averageRating.toFixed(2)} rating`}</small>
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

function filterProfiles(profiles: PlayerProfileSummary[], query: string) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return profiles

  return profiles.filter((profile) =>
    [
      profile.name,
      profile.catchphrase ?? '',
      profile.averageRating === null ? 'tbd' : profile.averageRating.toFixed(2),
      `${profile.eventCount} events`,
      `${profile.winCount} wins`,
    ]
      .join(' ')
      .toLowerCase()
      .includes(normalized),
  )
}
