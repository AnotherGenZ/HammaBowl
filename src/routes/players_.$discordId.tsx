import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PlayerName } from '../components/PlayerName'
import { shortDate } from '../lib/format'
import { pageMeta } from '../lib/meta'
import type { AdminPlayerProfileEditorData, PlayerBadge } from '../lib/types'
import {
  adminBadgeEditorClass,
  adminProfileModalClass,
  badgeSettingsListClass,
  badgeSettingsRowClass,
  breadcrumbNavClass,
  eyebrowClass,
  infoListClass,
  modalBackdropClass,
  modalCloseClass,
  profileEventDateClass,
  profileEventResultClass,
  profileEventsTableClass,
  profileEventsTableWrapClass,
  ratingChartClass,
  playerGroupTagClass,
  playerNameWithGroupClass,
  profileCatchphraseClass,
  profileEditIconClass,
  profileGroupTagLinkClass,
  profileHeroBadgesClass,
  profileHeroClass,
  profileIdentityClass,
  profileMetricClass,
  profileStatsGridClass,
} from '../lib/ui'
import { useDisplayTimeZone } from '../lib/useDisplayTimeZone'

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
  const [displayName, setDisplayName] = useState(profile?.name ?? '')
  const [profileEditorOpen, setProfileEditorOpen] = useState(false)
  const [chartExpanded, setChartExpanded] = useState(false)
  const displayTimeZone = useDisplayTimeZone()

  useEffect(() => {
    setBadges(profile?.badges ?? [])
    setCatchphrase(profile?.catchphrase ?? '')
    setDisplayName(profile?.name ?? '')
  }, [profile?.discordId, profile?.badges, profile?.catchphrase, profile?.name])

  if (!profile) {
    return (
      <main className="min-w-0 mx-auto w-[min(1180px,calc(100%_-_32px))] py-7 pb-[54px] max-[1023px]:w-[min(100%_-_24px,1180px)] max-[1023px]:py-[18px] max-[1023px]:pb-[42px] max-[480px]:w-[min(100%_-_18px,1180px)]">
        <nav className={breadcrumbNavClass} aria-label="Breadcrumb">
          <Link to="/players" activeOptions={{ exact: true }}>
            Players
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Player not found</span>
        </nav>
        <section className="panel rounded-lg border border-white/[0.10] bg-white/[0.055] p-[clamp(18px,3vw,28px)] mt-[18px] first:mt-0 max-[720px]:px-[clamp(14px,4vw,18px)]  empty-state min-h-[320px] grid content-center justify-items-center text-center gap-2.5 [&_p]:text-[#c0c8c6]">
          <h1>Player not found</h1>
        </section>
      </main>
    )
  }

  const ratingHistory = profile.stats.ratingHistory.map((item) => ({
    ...item,
    dateLabel: shortDate(item.startsAt, { timeZone: displayTimeZone }),
  }))

  return (
    <main className="min-w-0 mx-auto w-[min(1180px,calc(100%_-_32px))] py-7 pb-[54px] max-[1023px]:w-[min(100%_-_24px,1180px)] max-[1023px]:py-[18px] max-[1023px]:pb-[42px] max-[480px]:w-[min(100%_-_18px,1180px)]">
      <nav className={breadcrumbNavClass} aria-label="Breadcrumb">
        <Link to="/players" activeOptions={{ exact: true }}>
          Players
        </Link>
        <span aria-hidden="true">/</span>
        <span aria-current="page">
          <PlayerName name={displayName} groupTag={profile.groupTag} groupTagColor={profile.groupTagColor} />
        </span>
      </nav>
      <section
        className={profileHeroClass}
        style={profile.bannerUrl ? { backgroundImage: `url(${profile.bannerUrl})` } : undefined}
      >
        {isAdmin || isOwner ? (
          <button
            className={profileEditIconClass}
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
        <div className={profileIdentityClass}>
          {profile.avatarUrl ? <img src={profile.avatarUrl} alt="" /> : <span>{displayName.slice(0, 1)}</span>}
          <div>
            {/*<p className="eyebrow">Player profile</p>*/}
            <h1>
              <span className={playerNameWithGroupClass}>
                {profile.groupId && profile.groupTag ? (
                  <Link
                    to="/groups/$groupId"
                    params={{ groupId: profile.groupId }}
                    className={profileGroupTagLinkClass}
                    style={groupTagStyle(profile.groupTagColor)}
                    title={profile.groupName ? `View ${profile.groupName}` : 'View group'}
                  >
                    {profile.groupTag}
                  </Link>
                ) : profile.groupTag ? (
                  <span className={playerGroupTagClass} style={groupTagStyle(profile.groupTagColor)}>
                    {profile.groupTag}
                  </span>
                ) : null}
                <span>{displayName}</span>
              </span>
            </h1>
            {catchphrase ? <p className={profileCatchphraseClass}>{catchphrase}</p> : null}
            {badges.length ? (
              <div className={profileHeroBadgesClass}>
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
          playerName={displayName}
          groupTag={profile.groupTag}
          groupTagColor={profile.groupTagColor}
          onClose={() => setProfileEditorOpen(false)}
          onBadgesChanged={setBadges}
          onCatchphraseChanged={setCatchphrase}
          onNameChanged={setDisplayName}
        />
      ) : null}

      <section className="profile-grid grid min-w-0 grid-cols-2 gap-[18px] max-[720px]:grid-cols-1 [&>.panel]:mt-0">
        <article className="panel rounded-lg border border-white/[0.10] bg-white/[0.055] p-[clamp(18px,3vw,28px)] mt-[18px] first:mt-0 max-[720px]:px-[clamp(14px,4vw,18px)] ">
          <div className="section-heading mb-5 flex items-center justify-between gap-3 max-[720px]:grid max-[720px]:grid-cols-1 max-[720px]:items-start [&>*]:min-w-0">
            <h2>Stats</h2>
          </div>
          <dl className={profileStatsGridClass}>
            <Metric label="Events" value={profile.stats.events.toString()} />
            <Metric label="Wins" value={profile.stats.wins.toString()} />
            <Metric
              label="Average rating"
              value={profile.stats.averageRating === null ? 'UNRATED' : profile.stats.averageRating.toFixed(2)}
            />
            {profile.stats.killsOnHamma > 0 ? (
              <Metric label="Kills on Hamma" value={profile.stats.killsOnHamma.toString()} />
            ) : null}
            {profile.stats.deathsToHamma > 0 ? (
              <Metric label="Deaths to Hamma" value={profile.stats.deathsToHamma.toString()} />
            ) : null}
          </dl>
        </article>

        <article className="panel rounded-lg border border-white/[0.10] bg-white/[0.055] p-[clamp(18px,3vw,28px)] mt-[18px] first:mt-0 max-[720px]:px-[clamp(14px,4vw,18px)] ">
          <div className="section-heading mb-5 flex items-center justify-between gap-3 max-[720px]:grid max-[720px]:grid-cols-1 max-[720px]:items-start [&>*]:min-w-0">
            <h2>Characters</h2>
            {isOwner ? (
              <Link to="/settings" className="inline-flex min-h-9 w-fit max-w-full items-center rounded-full border border-white/[0.08] bg-white/[0.08] px-3 text-[#cbd5d3] transition-colors hover:bg-white/[0.12] hover:text-[#fff7e6]">
                Edit
              </Link>
            ) : null}
          </div>
          <div className={infoListClass}>
            {profile.characters.length ? (
              profile.characters.map((character) => (
                <span key={character.faction}>
                  <strong>{character.faction}</strong>
                  {character.characterName}
                </span>
              ))
            ) : (
              <div className="empty-inline flex min-h-11 w-full items-center gap-2 rounded-lg border border-dashed border-white/[0.12] bg-white/[0.04] px-3.5 py-3 font-bold text-[#b4bcbb]">No linked characters.</div>
            )}
          </div>
        </article>

        <article className="panel rounded-lg border border-white/[0.10] bg-white/[0.055] p-[clamp(18px,3vw,28px)] mt-[18px] first:mt-0 max-[720px]:px-[clamp(14px,4vw,18px)]  col-span-full">
          <div className="section-heading mb-5 flex items-center justify-between gap-3 max-[720px]:grid max-[720px]:grid-cols-1 max-[720px]:items-start [&>*]:min-w-0">
            <h2>Events</h2>
          </div>
          {profile.events.length ? (
            <div className={profileEventsTableWrapClass}>
              <table className={profileEventsTableClass}>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Team</th>
                    <th>Role</th>
                    <th>Result</th>
                  </tr>
                </thead>
                <tbody>
                  {profile.events.map((event) => (
                    <tr key={event.id}>
                      <td>
                        <Link to="/hall-of-legends/$eventId" params={{ eventId: event.id }}>
                          {event.name}
                        </Link>
                        <span className={profileEventDateClass}>
                          {shortDate(event.startsAt, { timeZone: displayTimeZone })}
                        </span>
                      </td>
                      <td>{event.teamName ?? 'Unassigned'}</td>
                      <td>{eventRoleLabel(event.role)}</td>
                      <td>
                        <span className={profileEventResultClass(event.winner)}>
                          {event.winner ? 'Win' : 'Loss'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-inline flex min-h-11 w-full items-center gap-2 rounded-lg border border-dashed border-white/[0.12] bg-white/[0.04] px-3.5 py-3 font-bold text-[#b4bcbb]">No completed event participation yet.</div>
          )}
        </article>

        <article className="panel rounded-lg border border-white/[0.10] bg-white/[0.055] p-[clamp(18px,3vw,28px)] mt-[18px] first:mt-0 max-[720px]:px-[clamp(14px,4vw,18px)]  col-span-full">
          <div className="section-heading mb-5 flex items-center justify-between gap-3 max-[720px]:grid max-[720px]:grid-cols-1 max-[720px]:items-start [&>*]:min-w-0">
            <h2>Rating history</h2>
            {ratingHistory.length > 1 ? (
              <button
                type="button"
                className="inline-flex min-h-[30px] cursor-pointer items-center justify-center gap-1.5 rounded-md border border-white/[0.14] bg-white/[0.07] px-2.5 font-extrabold text-[#f4f0e8] transition-colors hover:border-white/[0.22] hover:bg-white/[0.14] disabled:cursor-not-allowed disabled:opacity-55"
                onClick={() => setChartExpanded((v) => !v)}
              >
                {chartExpanded ? 'Collapse' : 'Expand'}
              </button>
            ) : null}
          </div>
          {ratingHistory.length ? (
            <div className={ratingChartClass(chartExpanded)}>
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
            <div className="empty-inline flex min-h-11 w-full items-center gap-2 rounded-lg border border-dashed border-white/[0.12] bg-white/[0.04] px-3.5 py-3 font-bold text-[#b4bcbb]">No rating history yet.</div>
          )}
        </article>
      </section>
    </main>
  )
}

function AdminProfileEditorModal({
  discordId,
  playerName,
  groupTag,
  groupTagColor,
  onClose,
  onBadgesChanged,
  onCatchphraseChanged,
  onNameChanged,
}: {
  discordId: string
  playerName: string
  groupTag?: string
  groupTagColor?: string
  onClose: () => void
  onBadgesChanged: (badges: PlayerBadge[]) => void
  onCatchphraseChanged: (catchphrase: string) => void
  onNameChanged: (name: string) => void
}) {
  return (
    <div className={modalBackdropClass} role="presentation" onMouseDown={onClose}>
      <section
        className={adminProfileModalClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-profile-editor-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="section-heading mb-5 flex items-center justify-between gap-3 max-[720px]:grid max-[720px]:grid-cols-1 max-[720px]:items-start [&>*]:min-w-0">
          <div>
            <p className={eyebrowClass}>Admin profile editor</p>
            <h2 id="admin-profile-editor-title">
              <PlayerName name={playerName} groupTag={groupTag} groupTagColor={groupTagColor} />
            </h2>
          </div>
          <button type="button" className={modalCloseClass} aria-label="Close profile editor" onClick={onClose}>
            ×
          </button>
        </div>
        <PlayerBadgeEditor
          discordId={discordId}
          onBadgesChanged={onBadgesChanged}
          onCatchphraseChanged={onCatchphraseChanged}
          onNameChanged={onNameChanged}
        />
      </section>
    </div>
  )
}

function PlayerBadgeEditor({
  discordId,
  onBadgesChanged,
  onCatchphraseChanged,
  onNameChanged,
}: {
  discordId: string
  onBadgesChanged: (badges: PlayerBadge[]) => void
  onCatchphraseChanged: (catchphrase: string) => void
  onNameChanged: (name: string) => void
}) {
  const [data, setData] = useState<AdminPlayerProfileEditorData>()
  const [name, setName] = useState('')
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
    setName(payload.player.name)
    onBadgesChanged(payload.visibleBadges)
    onCatchphraseChanged(payload.catchphrase)
    onNameChanged(payload.player.name)
  }

  function applyEditorPayload(payload: AdminPlayerProfileEditorData & { message?: string }) {
    setData(payload)
    setName(payload.player.name)
    onBadgesChanged(payload.visibleBadges)
    onCatchphraseChanged(payload.catchphrase)
    onNameChanged(payload.player.name)
    setMessage(payload.message ?? 'Profile updated.')
  }

  async function renamePlayer() {
    setBusy('name')
    setMessage('')
    try {
      const response = await fetch('/api/admin/player-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rename',
          discordId,
          name,
        }),
      })
      if (!response.ok) throw new Error(await response.text())
      const payload = await response.json() as AdminPlayerProfileEditorData & { message?: string }
      applyEditorPayload(payload)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to rename player.')
    } finally {
      setBusy('')
    }
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
      <section className={adminBadgeEditorClass}>
        <div className="section-heading mb-5 flex items-center justify-between gap-3 max-[720px]:grid max-[720px]:grid-cols-1 max-[720px]:items-start [&>*]:min-w-0">
          <h2>Badges</h2>
        </div>
        <div className="empty-inline flex min-h-11 w-full items-center gap-2 rounded-lg border border-dashed border-white/[0.12] bg-white/[0.04] px-3.5 py-3 font-bold text-[#b4bcbb]"><span className="spinner" aria-label="Loading" /> Loading badges.</div>
      </section>
    )
  }

  return (
    <section className={adminBadgeEditorClass}>
      <div className="section-heading mb-5 flex items-center justify-between gap-3 max-[720px]:grid max-[720px]:grid-cols-1 max-[720px]:items-start [&>*]:min-w-0">
        <h2>Profile controls</h2>
      </div>
      {message ? <div className="mb-4 rounded-lg border border-white/[0.10] bg-white/[0.06] px-3.5 py-3 text-[#d8dedc]">{message}</div> : null}
      <div className={badgeSettingsListClass}>
        <article className={badgeSettingsRowClass} data-selected={name.trim() !== data.player.name}>
          <label className="profile-name-field grid gap-2 [&_input]:min-h-10 [&_input]:w-full [&_input]:min-w-0 [&_input]:rounded-md [&_input]:border [&_input]:border-white/[0.18] [&_input]:bg-[#121417] [&_input]:px-2.5 [&_input]:font-bold [&_input]:text-[#f4f0e8] [&+button]:self-end">
            <span>
              <strong>Display name</strong>
              <small>Shown across player profiles, events, and admin tools.</small>
            </span>
            <input
              value={name}
              maxLength={80}
              disabled={busy === 'name'}
              onChange={(event) => setName(event.currentTarget.value)}
            />
          </label>
          <button className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#e4b45e] bg-[#e4b45e] px-3.5 font-extrabold text-[#16130f] transition-colors hover:border-[#f0c878] hover:bg-[#f0c878] disabled:cursor-not-allowed disabled:opacity-55"
            type="button"
            disabled={busy === 'name' || !name.trim() || name.trim() === data.player.name}
            onClick={() => void renamePlayer()}
          >
            {busy === 'name' ? <span className="spinner" aria-label="Saving" /> : null}
            Rename player
          </button>
        </article>
      </div>
      <div className={badgeSettingsListClass}>
        <article className={badgeSettingsRowClass} data-selected={Boolean(data.catchphrase)}>
          <span>
            <strong>Catchphrase</strong>
            <small>{data.catchphrase || 'No catchphrase set.'}</small>
          </span>
          <button
            type="button"
            className="inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-[#d94f3d]/90 bg-[#b94135] px-3.5 font-extrabold text-[#fff6f3] transition-colors hover:bg-[#c94e41] disabled:cursor-not-allowed disabled:bg-[#b94135]/34 disabled:text-[#ffd9d1] disabled:opacity-75"
            disabled={busy === 'catchphrase' || !data.catchphrase}
            onClick={() => void resetCatchphrase()}
          >
            {busy === 'catchphrase' ? <span className="spinner" aria-label="Saving" /> : null}
            Reset catchphrase
          </button>
        </article>
      </div>
      <div className="section-heading mb-5 flex items-center justify-between gap-3 max-[720px]:grid max-[720px]:grid-cols-1 max-[720px]:items-start [&>*]:min-w-0">
        <h2>Badges</h2>
      </div>
      <div className={badgeSettingsListClass}>
        {data.badges.length ? (
          data.badges.map((badge) => {
            const checked = data.assignedBadgeIds.includes(badge.id)
            return (
              <article className={badgeSettingsRowClass} key={badge.id} data-selected={checked}>
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
          <div className="empty-inline flex min-h-11 w-full items-center gap-2 rounded-lg border border-dashed border-white/[0.12] bg-white/[0.04] px-3.5 py-3 font-bold text-[#b4bcbb]">No badges have been created yet.</div>
        )}
      </div>
    </section>
  )
}

function badgeStyle(color: string) {
  return { '--badge-color': color } as CSSProperties
}

function groupTagStyle(color?: string) {
  return color ? ({ '--group-tag-color': color } as CSSProperties) : undefined
}

function eventRoleLabel(role?: 'captain' | 'player') {
  if (role === 'captain') return 'Captain'
  if (role === 'player') return 'Player'
  return 'Participant'
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className={profileMetricClass}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}
