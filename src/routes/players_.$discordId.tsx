import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { shortDate } from '../lib/format'
import { pageMeta } from '../lib/meta'
import type { AdminPlayerProfileEditorData, PlayerBadge } from '../lib/types'

const loadPlayerProfile = createServerFn({ method: 'GET' })
  .inputValidator((input: { discordId: string }) => input)
  .handler(async ({ data }) => {
    const { getPlayerProfile } = await import('../lib/db.server')
    const { getDiscordSessionUser } = await import('../lib/discord.server')
    const user = await getDiscordSessionUser()
    return {
      profile: getPlayerProfile(data.discordId),
      isAdmin: Boolean(user?.roles.includes('admin')),
      isOwner: user?.id === data.discordId,
    }
  })

export const Route = createFileRoute('/players_/$discordId')({
  loader: ({ params }) => loadPlayerProfile({ data: { discordId: params.discordId } }),
  head: ({ loaderData, params }) =>
    pageMeta({
      title: loaderData?.profile ? `${loaderData.profile.name} Profile` : 'Player Profile',
      description: loaderData?.profile?.catchphrase ?? 'HammaBowl player profile, stats, characters, and badges.',
      path: `/players/${params.discordId}`,
    }),
  component: PlayerProfilePage,
})

function PlayerProfilePage() {
  const { profile, isAdmin, isOwner } = Route.useLoaderData()
  const navigate = useNavigate()
  const [badges, setBadges] = useState<PlayerBadge[]>(profile?.badges ?? [])
  const [catchphrase, setCatchphrase] = useState(profile?.catchphrase ?? '')
  const [profileEditorOpen, setProfileEditorOpen] = useState(false)
  const [chartExpanded, setChartExpanded] = useState(false)

  useEffect(() => {
    setBadges(profile?.badges ?? [])
    setCatchphrase(profile?.catchphrase ?? '')
  }, [profile?.discordId, profile?.badges, profile?.catchphrase])

  if (!profile) {
    return (
      <main>
        <nav className="breadcrumb-nav" aria-label="Breadcrumb">
          <Link to="/players" activeOptions={{ exact: true }}>
            Players
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Player not found</span>
        </nav>
        <section className="panel empty-state">
          <h1>Player not found</h1>
        </section>
      </main>
    )
  }

  const ratingHistory = profile.stats.ratingHistory.map((item) => ({
    ...item,
    dateLabel: shortDate(item.startsAt),
  }))

  return (
    <main>
      <nav className="breadcrumb-nav" aria-label="Breadcrumb">
        <Link to="/players" activeOptions={{ exact: true }}>
          Players
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">{profile.name}</span>
      </nav>
      <section
        className="profile-hero"
        style={profile.bannerUrl ? { backgroundImage: `url(${profile.bannerUrl})` } : undefined}
      >
        {isAdmin || isOwner ? (
          <button
            className="profile-edit-icon"
            type="button"
            aria-label="Edit profile"
            title="Edit profile"
            onClick={() => {
              if (isAdmin) {
                setProfileEditorOpen(true)
              } else {
                void navigate({ to: '/settings' })
              }
            }}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 20h4l10.8-10.8a2.4 2.4 0 0 0-3.4-3.4L4.6 16.6 4 20Z" />
              <path d="m14 7 3 3" />
            </svg>
          </button>
        ) : null}
        <div className="profile-identity">
          {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <span>{profile.name.slice(0, 1)}</span>}
          <div>
            <p className="eyebrow">Player profile</p>
            <h1>{profile.name}</h1>
            {catchphrase ? <p className="profile-catchphrase">{catchphrase}</p> : null}
            {badges.length ? (
              <div className="profile-hero-badges">
                {badges.map((badge) => (
                  <span key={badge.id} title={badge.description} style={badgeStyle(badge.color)}>
                    {badge.name}
                  </span>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {isAdmin && profileEditorOpen ? (
        <AdminProfileEditorModal
          discordId={profile.discordId}
          playerName={profile.name}
          onClose={() => setProfileEditorOpen(false)}
          onBadgesChanged={setBadges}
          onCatchphraseChanged={setCatchphrase}
        />
      ) : null}

      <section className="profile-grid">
        <article className="panel">
          <div className="section-heading">
            <h2>Stats</h2>
          </div>
          <dl>
            <Metric label="Events" value={profile.stats.events.toString()} />
            <Metric label="Wins" value={profile.stats.wins.toString()} />
            <Metric
              label="Average rating"
              value={profile.stats.averageRating === null ? 'TBD' : profile.stats.averageRating.toFixed(2)}
            />
            {profile.stats.killsOnHamma > 0 ? (
              <Metric label="Kills on Hamma" value={profile.stats.killsOnHamma.toString()} />
            ) : null}
            {profile.stats.deathsToHamma > 0 ? (
              <Metric label="Deaths to Hamma" value={profile.stats.deathsToHamma.toString()} />
            ) : null}
          </dl>
        </article>

        <article className="panel">
          <div className="section-heading">
            <h2>Characters</h2>
            {isOwner ? (
              <Link to="/settings" className="pill">
                Edit
              </Link>
            ) : null}
          </div>
          <div className="character-list">
            {profile.characters.length ? (
              profile.characters.map((character) => (
                <span key={character.faction}>
                  <strong>{character.faction}</strong>
                  {character.characterName}
                </span>
              ))
            ) : (
              <div className="empty-inline">No linked characters.</div>
            )}
          </div>
        </article>

        <article className="panel profile-wide">
          <div className="section-heading">
            <h2>Rating history</h2>
            {ratingHistory.length > 1 ? (
              <button
                type="button"
                className="text-button"
                onClick={() => setChartExpanded((v) => !v)}
              >
                {chartExpanded ? 'Collapse' : 'Expand'}
              </button>
            ) : null}
          </div>
          {ratingHistory.length ? (
            <div className={`rating-chart${chartExpanded ? ' rating-chart-expanded' : ''}`}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={ratingHistory} margin={{ top: 12, right: 18, bottom: 8, left: 0 }}>
                  <CartesianGrid stroke="rgba(255, 255, 255, 0.08)" vertical={false} />
                  <XAxis
                    dataKey="dateLabel"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#a9b3b2', fontSize: 12, fontWeight: 700 }}
                    minTickGap={18}
                  />
                  <YAxis
                    domain={[1, 10]}
                    ticks={[1, 3, 5, 7, 10]}
                    axisLine={false}
                    tickLine={false}
                    width={34}
                    tick={{ fill: '#a9b3b2', fontSize: 12, fontWeight: 700 }}
                  />
                  <Tooltip
                    cursor={{ stroke: 'rgba(228, 180, 94, 0.28)', strokeWidth: 1 }}
                    contentStyle={{
                      border: '1px solid rgba(255, 255, 255, 0.14)',
                      borderRadius: 8,
                      background: '#121417',
                      boxShadow: '0 18px 40px rgba(0, 0, 0, 0.32)',
                      color: '#f4f0e8',
                    }}
                    labelStyle={{ color: '#e4b45e', fontWeight: 900 }}
                    formatter={(value) => [Number(value).toFixed(2), 'Rating']}
                    labelFormatter={(_, payload) => {
                      const point = payload?.[0]?.payload as (typeof ratingHistory)[number] | undefined
                      return point ? `${point.eventName} - ${point.dateLabel}` : ''
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="averageRating"
                    name="Rating"
                    stroke="#e4b45e"
                    strokeWidth={3}
                    dot={{ r: 4, fill: '#e4b45e', stroke: '#121417', strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: '#f0c878', stroke: '#121417', strokeWidth: 2 }}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-inline">No rating history yet.</div>
          )}
        </article>
      </section>
    </main>
  )
}

function AdminProfileEditorModal({
  discordId,
  playerName,
  onClose,
  onBadgesChanged,
  onCatchphraseChanged,
}: {
  discordId: string
  playerName: string
  onClose: () => void
  onBadgesChanged: (badges: PlayerBadge[]) => void
  onCatchphraseChanged: (catchphrase: string) => void
}) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="modal-panel admin-profile-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-profile-editor-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">Admin profile editor</p>
            <h2 id="admin-profile-editor-title">{playerName}</h2>
          </div>
          <button type="button" className="modal-close" aria-label="Close profile editor" onClick={onClose}>
            ×
          </button>
        </div>
        <PlayerBadgeEditor
          discordId={discordId}
          onBadgesChanged={onBadgesChanged}
          onCatchphraseChanged={onCatchphraseChanged}
        />
      </section>
    </div>
  )
}

function PlayerBadgeEditor({
  discordId,
  onBadgesChanged,
  onCatchphraseChanged,
}: {
  discordId: string
  onBadgesChanged: (badges: PlayerBadge[]) => void
  onCatchphraseChanged: (catchphrase: string) => void
}) {
  const [data, setData] = useState<AdminPlayerProfileEditorData>()
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState('')

  useEffect(() => {
    void loadEditor()
  }, [discordId])

  async function loadEditor() {
    setMessage('')
    const response = await fetch(`/api/admin/player-profile?discordId=${encodeURIComponent(discordId)}`)
    if (!response.ok) throw new Error(await response.text())
    const payload = await response.json() as AdminPlayerProfileEditorData
    setData(payload)
    onBadgesChanged(payload.visibleBadges)
    onCatchphraseChanged(payload.catchphrase)
  }

  function applyEditorPayload(payload: AdminPlayerProfileEditorData & { message?: string }) {
    setData(payload)
    onBadgesChanged(payload.visibleBadges)
    onCatchphraseChanged(payload.catchphrase)
    setMessage(payload.message ?? 'Profile updated.')
  }

  async function toggleBadge(badgeId: string, checked: boolean) {
    setBusy(badgeId)
    setMessage('')
    try {
      const response = await fetch('/api/admin/player-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: checked ? 'assign' : 'unassign',
          discordId,
          badgeId,
        }),
      })
      if (!response.ok) throw new Error(await response.text())
      const payload = await response.json() as AdminPlayerProfileEditorData & { message?: string }
      applyEditorPayload(payload)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update badges.')
    } finally {
      setBusy('')
    }
  }

  async function resetCatchphrase() {
    setBusy('catchphrase')
    setMessage('')
    try {
      const response = await fetch('/api/admin/player-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reset-catchphrase',
          discordId,
        }),
      })
      if (!response.ok) throw new Error(await response.text())
      const payload = await response.json() as AdminPlayerProfileEditorData & { message?: string }
      applyEditorPayload(payload)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to reset catchphrase.')
    } finally {
      setBusy('')
    }
  }

  if (!data) {
    return (
      <section className="admin-badge-editor">
        <div className="section-heading">
          <h2>Badges</h2>
        </div>
        <div className="empty-inline"><span className="spinner" aria-label="Loading" /> Loading badges.</div>
      </section>
    )
  }

  return (
    <section className="admin-badge-editor">
      <div className="section-heading">
        <h2>Profile controls</h2>
      </div>
      {message ? <div className="admin-result">{message}</div> : null}
      <div className="badge-settings-list">
        <article className="badge-settings-row" data-selected={Boolean(data.catchphrase)}>
          <span>
            <strong>Catchphrase</strong>
            <small>{data.catchphrase || 'No catchphrase set.'}</small>
          </span>
          <button
            type="button"
            className="danger-button"
            disabled={busy === 'catchphrase' || !data.catchphrase}
            onClick={() => void resetCatchphrase()}
          >
            {busy === 'catchphrase' ? <span className="spinner" aria-label="Saving" /> : null}
            Reset catchphrase
          </button>
        </article>
      </div>
      <div className="section-heading">
        <h2>Badges</h2>
      </div>
      <div className="badge-settings-list">
        {data.badges.length ? (
          data.badges.map((badge) => {
            const checked = data.assignedBadgeIds.includes(badge.id)
            return (
              <article className="badge-settings-row" key={badge.id} data-selected={checked}>
                <label className="checkbox-field">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={busy === badge.id || badge.source !== 'manual'}
                    onChange={(event) => {
                      const nextChecked = event.currentTarget.checked
                      void toggleBadge(badge.id, nextChecked)
                    }}
                  />
                  <span>
                    <strong style={badgeStyle(badge.color)}>{badge.name}</strong>
                    <small>{badge.description}</small>
                  </span>
                </label>
              </article>
            )
          })
        ) : (
          <div className="empty-inline">No manual badges have been created yet.</div>
        )}
      </div>
    </section>
  )
}

function badgeStyle(color: string) {
  return { '--badge-color': color } as CSSProperties
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
