import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useEffect, useMemo, useState } from 'react'
import { pageMeta } from '../lib/meta'
import { isCaptainPlayer } from '../lib/rules'
import { useSession } from '../lib/SessionContext'
import { getCurrentEvent } from '../lib/services'

const requireCompleteProfile = createServerFn({ method: 'GET' }).handler(async () => {
  const { getDiscordSessionUser } = await import('../lib/discord.server')
  const user = await getDiscordSessionUser()
  if (user && !user.profileComplete) throw redirect({ to: '/settings' })
})

export const Route = createFileRoute('/ratings')({
  loader: async () => {
    await requireCompleteProfile()
    return getCurrentEvent()
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
  const [message, setMessage] = useState<{ text: string; tone: 'neutral' | 'success' | 'error' }>()

  const canRate = user?.roles.some((role) => role === 'participant' || role === 'admin')
  const players = useMemo(
    () =>
      event?.players.filter(
        (player) => player.id !== user?.id && !isCaptainPlayer(event, player.id),
      ) ?? [],
    [event, user?.id],
  )

  const ratedCount = useMemo(
    () => players.filter((p) => ratings[p.id] !== undefined).length,
    [players, ratings],
  )

  useEffect(() => {
    if (!event || !canRate) {
      setRatings({})
      setRatingsLoaded(false)
      return
    }

    let active = true
    setRatingsLoaded(false)
    fetch('/api/ratings')
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
  }, [event, canRate])

  async function rate(toDiscordId: string, score: number) {
    setSaving(toDiscordId)
    setMessage(undefined)
    try {
      const response = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toDiscordId, score }),
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

  return (
    <main>
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
            <span className="pill">{user ? user.name : 'Discord login required'}</span>
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
                Only rate players you have played with. Leave unknown players unrated.
              </p>
            </div>
            <div className="rating-list">
              {players.map((player) => {
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
                      <select
                        value={ratings[player.id]?.toString() ?? ''}
                        disabled={saving === player.id}
                        aria-label={`Rate ${player.name}`}
                        onChange={(event) => {
                          const score = Number(event.currentTarget.value)
                          if (score) void rate(player.id, score)
                        }}
                      >
                        <option value="" disabled>
                          Rate
                        </option>
                        {Array.from({ length: 10 }, (_, index) => index + 1).map((score) => (
                          <option value={score} key={score}>
                            {score}
                          </option>
                        ))}
                      </select>
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
