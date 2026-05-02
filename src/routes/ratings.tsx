import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useEffect, useMemo, useState } from 'react'
import { pageMeta } from '../lib/meta'
import { isCaptainPlayer } from '../lib/rules'
import { useSession } from '../lib/SessionContext'

type RatingsSortMode = 'name' | 'rating-desc' | 'rating-asc'

const requireRatingsAccess = createServerFn({ method: 'GET' }).handler(async () => {
  const { getDiscordSessionUser } = await import('../lib/discord.server')
  const { isEventParticipant } = await import('../lib/db.server')
  const { getCurrentEvent } = await import('../lib/services')

  const user = await getDiscordSessionUser()
  const event = await getCurrentEvent()

  if (!user) throw redirect({ to: '/' })
  if (user && !user.profileComplete) throw redirect({ to: '/settings' })

  if (!user.roles.includes('admin') && (!event || !isEventParticipant(event.id, user.id))) {
    throw redirect({ to: '/' })
  }

  return event
})

export const Route = createFileRoute('/ratings')({
  loader: async () => {
    return requireRatingsAccess()
  },
  head: ({ loaderData }) =>
    pageMeta({
      title: loaderData ? `${loaderData.name} Ratings` : 'Ratings',
      description: loaderData
        ? `Private rating page for ${loaderData.name} participants.`
        : 'Private HammaBowl participant rating page.',
      path: '/ratings',
      noIndex: true,
    }),
  component: Ratings,
})

function Ratings() {
  const event = Route.useLoaderData()
  const { user } = useSession()
  const [ratings, setRatings] = useState<Record<string, number>>({})
  const [ratingsLoaded, setRatingsLoaded] = useState(false)
  const [saving, setSaving] = useState<string>()
  const [sortMode, setSortMode] = useState<RatingsSortMode>('name')
  const [message, setMessage] = useState<{ text: string; tone: 'neutral' | 'success' | 'error' }>()

  const isAdmin = Boolean(user?.roles.includes('admin'))
  const canRate = user?.roles.some((role) => role === 'participant' || role === 'admin')
  const raterOptions = useMemo(
    () => {
      const submittedRaterIds = new Set(event?.ratings.map((rating) => rating.fromPlayerId) ?? [])
      return [...(event?.players ?? [])]
        .filter((player) => submittedRaterIds.has(player.id))
        .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    },
    [event],
  )
  const [selectedRaterId, setSelectedRaterId] = useState('')
  const players = useMemo(
    () =>
      event?.players.filter(
        (player) => player.id !== selectedRaterId && !isCaptainPlayer(event, player.id),
      ) ?? [],
    [event, selectedRaterId],
  )

  const ratedCount = useMemo(
    () => players.filter((p) => ratings[p.id] !== undefined).length,
    [players, ratings],
  )

  const sortedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      const nameComparison = a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
      if (sortMode === 'name') return nameComparison

      const aRating = ratings[a.id]
      const bRating = ratings[b.id]
      const aIsRated = aRating !== undefined
      const bIsRated = bRating !== undefined

      if (aIsRated !== bIsRated) return aIsRated ? -1 : 1
      if (!aIsRated || !bIsRated) return nameComparison

      const ratingComparison = aRating - bRating
      if (ratingComparison === 0) return nameComparison

      return sortMode === 'rating-asc' ? ratingComparison : -ratingComparison
    })
  }, [players, ratings, sortMode])

  useEffect(() => {
    if (!user) {
      setSelectedRaterId('')
      return
    }

    if (!isAdmin) {
      setSelectedRaterId(user.id)
      return
    }

    if (!raterOptions.length) {
      setSelectedRaterId('')
      return
    }

    if (!raterOptions.some((player) => player.id === selectedRaterId)) {
      setSelectedRaterId(raterOptions[0].id)
    }
  }, [isAdmin, raterOptions, selectedRaterId, user])

  useEffect(() => {
    if (!event || !canRate) {
      setRatings({})
      setRatingsLoaded(false)
      return
    }

    if (!selectedRaterId) {
      setRatings({})
      setRatingsLoaded(Boolean(user))
      return
    }

    let active = true
    setRatingsLoaded(false)
    const params = isAdmin ? `?fromDiscordId=${encodeURIComponent(selectedRaterId)}` : ''
    fetch(`/api/ratings${params}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(await response.text())
        return response.json() as Promise<{
          ratings: Array<{ toDiscordId: string; score: number }>
        }>
      })
      .then((payload) => {
        if (!active) return
        setRatings(
          Object.fromEntries(
            payload.ratings.map((rating) => [rating.toDiscordId, rating.score]),
          ),
        )
        setRatingsLoaded(true)
      })
      .catch((error) => {
        if (active) {
          setMessage({ text: error instanceof Error ? error.message : 'Unable to load ratings.', tone: 'error' })
          setRatingsLoaded(true)
        }
      })

    return () => {
      active = false
    }
  }, [event, canRate, isAdmin, selectedRaterId, user])

  async function rate(toDiscordId: string, score: number) {
    setSaving(toDiscordId)
    setMessage(undefined)
    try {
      const response = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromDiscordId: selectedRaterId, toDiscordId, score }),
      })
      if (!response.ok) throw new Error(await response.text())
      const result = await response.json()
      setRatings((current) => ({ ...current, [toDiscordId]: score }))
      setMessage({ text: result.message ?? 'Rating saved.', tone: 'success' })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Rating failed.', tone: 'error' })
    } finally {
      setSaving(undefined)
    }
  }

  async function clearRating(toDiscordId: string) {
    setSaving(toDiscordId)
    setMessage(undefined)
    try {
      const response = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromDiscordId: selectedRaterId, toDiscordId, score: null }),
      })
      if (!response.ok) throw new Error(await response.text())
      const result = await response.json()
      setRatings((current) => {
        const next = { ...current }
        delete next[toDiscordId]
        return next
      })
      setMessage({ text: result.message ?? 'Rating cleared.', tone: 'success' })
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Rating failed.', tone: 'error' })
    } finally {
      setSaving(undefined)
    }
  }

  return (
    <main className="ratings-page">
      <section className="panel">
        <div className="section-heading">
          <div>
            <h1>Rate known players</h1>
          </div>
          <div className="rating-header-actions">
            {ratingsLoaded && players.length ? (
              <span className="count-chip">
                {ratedCount}/{players.length} rated
              </span>
            ) : null}
            <label className="rating-rater-select">
              <span>Ratings by</span>
              <select
                value={selectedRaterId}
                disabled={!isAdmin || !raterOptions.length}
                onChange={(event) => setSelectedRaterId(event.currentTarget.value)}
              >
                {isAdmin ? (
                  raterOptions.length ? (
                    raterOptions.map((player) => (
                      <option key={player.id} value={player.id}>
                        {player.name}
                      </option>
                    ))
                  ) : (
                    <option value="">No raters available</option>
                  )
                ) : (
                  <option value={user?.id ?? ''}>{user ? user.name : 'Discord login required'}</option>
                )}
              </select>
            </label>
          </div>
        </div>
        {!event ? (
          <div className="empty-inline">
            Ratings will be available once Raid Helper has a current HammaBowl event.
          </div>
        ) : null}
        {message ? (
          <div className={`toast toast-${message.tone}`} role="status" aria-live="polite">
            {message.text}
          </div>
        ) : null}
        {event && canRate ? (
          <>
            <div className="rating-legend">
              <p className="rating-legend-title">Rating guide</p>
              <div className="rating-legend-scale">
                <span><strong>1-3</strong> Below average</span>
                <span><strong>4-6</strong> Average</span>
                <span><strong>7-9</strong> Above average</span>
                <span><strong>10</strong> Exceptional</span>
              </div>
              <p className="rating-legend-note">
                Only rate players you have played with. Leave unknown players unrated. Do not troll,
                coordinate, or otherwise attempt to manipulate ratings.
              </p>
            </div>
            <div className="rating-list-toolbar" aria-label="Rating list controls">
              <span>Sort by</span>
              <div className="rating-sort-control" role="group" aria-label="Sort players">
                <button
                  type="button"
                  className={sortMode === 'name' ? 'active' : undefined}
                  aria-pressed={sortMode === 'name'}
                  onClick={() => setSortMode('name')}
                >
                  A-Z
                </button>
                <button
                  type="button"
                  className={sortMode === 'rating-desc' ? 'active' : undefined}
                  aria-pressed={sortMode === 'rating-desc'}
                  onClick={() => setSortMode('rating-desc')}
                >
                  High-Low
                </button>
                <button
                  type="button"
                  className={sortMode === 'rating-asc' ? 'active' : undefined}
                  aria-pressed={sortMode === 'rating-asc'}
                  onClick={() => setSortMode('rating-asc')}
                >
                  Low-High
                </button>
              </div>
            </div>
            <div className="rating-list">
              {sortedPlayers.map((player) => {
                const hasRating = ratings[player.id] !== undefined
                return (
                  <article
                    className="rating-row"
                    data-rating-state={ratingsLoaded && !hasRating ? 'unrated' : 'rated'}
                    key={player.id}
                  >
                    <strong>{player.name}</strong>
                    <div className="rating-controls">
                      {saving === player.id ? <span className="spinner" aria-label="Saving" /> : null}
                      <div
                        className="rating-score-picker"
                        role="group"
                        aria-label={`Rate ${player.name}`}
                      >
                        {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
                          <button
                            type="button"
                            className={ratings[player.id] === score ? 'active' : undefined}
                            disabled={saving === player.id}
                            aria-pressed={ratings[player.id] === score}
                            onClick={() => {
                              if (ratings[player.id] === score) {
                                void clearRating(player.id)
                                return
                              }

                              void rate(player.id, score)
                            }}
                            key={score}
                          >
                            {score}
                          </button>
                        ))}
                      </div>
                    </div>
                  </article>
                )
              })}
            </div>
          </>
        ) : event ? (
          <div className="empty-inline">
            You must be an accepted participant in the current event to rate players.
          </div>
        ) : null}
      </section>
    </main>
  )
}
