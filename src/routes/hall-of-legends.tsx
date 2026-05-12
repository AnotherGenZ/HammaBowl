import { Link, createFileRoute } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useEffect, useRef, useState } from 'react'
import { shortDateWithTimeZone } from '../lib/format'
import { pageMeta } from '../lib/meta'
import type { HistoricalEvent } from '../lib/types'
import { useDisplayTimeZone } from '../lib/useDisplayTimeZone'

const loadHistoricalEvents = createServerFn({ method: 'GET' }).handler(async () => {
  const { getHistoricalEvents } = await import('../lib/db.server')
  return {
    events: await getHistoricalEvents(),
  }
})

export const Route = createFileRoute('/hall-of-legends')({
  loader: () => loadHistoricalEvents(),
  head: () =>
    pageMeta({
      title: 'Hall of Legends',
      description: 'Past HammaBowl events, teams, ratings, draft replays, Twitch streams, VODs, and winners.',
      path: '/hall-of-legends',
    }),
  component: HallOfLegends,
})

function HallOfLegends() {
  const { events } = Route.useLoaderData()
  const displayTimeZone = useDisplayTimeZone()
  const [focusedIndex, setFocusedIndex] = useState(0)
  const carouselRef = useRef<HTMLDivElement | null>(null)
  const focusedIndexRef = useRef(0)
  const lastDiscreteWheelAt = useRef(0)
  const horizontalWheelDelta = useRef(0)
  const scrollFrame = useRef<number | null>(null)
  const wheelEndTimer = useRef<number | null>(null)
  const horizontalWheelTimer = useRef<number | null>(null)

  useEffect(() => {
    document.body.classList.add('fixed-document')

    const track = carouselRef.current

    function handleWheel(event: WheelEvent) {
      if (event.ctrlKey) return
      if (!track) return
      const deltaX = normalizeWheelDelta(event.deltaX, event.deltaMode)
      const deltaY = normalizeWheelDelta(event.deltaY, event.deltaMode)
      const horizontalMouseWheel = event.deltaMode === WheelEvent.DOM_DELTA_PIXEL
        && Math.abs(deltaX) >= 16
        && Number.isInteger(deltaX)
        && Math.abs(deltaX) > Math.max(4, Math.abs(deltaY) * 1.6)
      const coarseWheel = event.deltaMode !== WheelEvent.DOM_DELTA_PIXEL || (
        Math.abs(deltaX) < 1 && Math.abs(deltaY) >= 80
      )

      if (horizontalMouseWheel) {
        event.preventDefault()
        horizontalWheelDelta.current += deltaX

        if (horizontalWheelTimer.current !== null) window.clearTimeout(horizontalWheelTimer.current)
        horizontalWheelTimer.current = window.setTimeout(() => {
          horizontalWheelDelta.current = 0
          horizontalWheelTimer.current = null
        }, 220)

        if (Math.abs(horizontalWheelDelta.current) < 70) return

        const direction = Math.sign(horizontalWheelDelta.current)
        horizontalWheelDelta.current = 0
        const now = window.performance.now()
        if (now - lastDiscreteWheelAt.current < 220) return

        lastDiscreteWheelAt.current = now
        const nextIndex = Math.max(
          0,
          Math.min(events.length - 1, focusedIndexRef.current + direction),
        )
        scrollToCard(track, nextIndex)
        return
      }

      if (coarseWheel) {
        event.preventDefault()
        const now = window.performance.now()
        if (now - lastDiscreteWheelAt.current < 180) return

        lastDiscreteWheelAt.current = now
        const direction = deltaY || deltaX
        const nextIndex = Math.max(
          0,
          Math.min(events.length - 1, focusedIndexRef.current + Math.sign(direction)),
        )
        scrollToCard(track, nextIndex)
        return
      }

      const delta =
        Math.abs(deltaX) >= Math.abs(deltaY)
          ? deltaX
          : deltaY * 0.5
      if (delta === 0) return

      event.preventDefault()
      track.classList.add('wheel-scrolling')
      track.scrollLeft += delta
      updateFocusedCard(track)

      if (wheelEndTimer.current !== null) window.clearTimeout(wheelEndTimer.current)
      wheelEndTimer.current = window.setTimeout(() => {
        track.classList.remove('wheel-scrolling')
        wheelEndTimer.current = null
      }, 140)
    }

    track?.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      track?.removeEventListener('wheel', handleWheel)
      document.body.classList.remove('fixed-document')
      if (scrollFrame.current !== null) window.cancelAnimationFrame(scrollFrame.current)
      if (wheelEndTimer.current !== null) window.clearTimeout(wheelEndTimer.current)
      if (horizontalWheelTimer.current !== null) window.clearTimeout(horizontalWheelTimer.current)
    }
  }, [events.length])

  function updateFocusedCard(track: HTMLDivElement) {
    if (scrollFrame.current !== null) window.cancelAnimationFrame(scrollFrame.current)

    scrollFrame.current = window.requestAnimationFrame(() => {
      const trackBox = track.getBoundingClientRect()
      const trackCenter = trackBox.left + trackBox.width / 2
      let nextFocusedIndex = 0
      let closestDistance = Number.POSITIVE_INFINITY

      Array.from(track.querySelectorAll<HTMLElement>('.legend-card')).forEach((card, index) => {
        const cardBox = card.getBoundingClientRect()
        const cardCenter = cardBox.left + cardBox.width / 2
        const distance = Math.abs(trackCenter - cardCenter)

        if (distance < closestDistance) {
          closestDistance = distance
          nextFocusedIndex = index
        }
      })

      setFocusedIndex((current) => (current === nextFocusedIndex ? current : nextFocusedIndex))
      focusedIndexRef.current = nextFocusedIndex
      scrollFrame.current = null
    })
  }

  function scrollToCard(track: HTMLDivElement, index: number) {
    const card = track.querySelectorAll<HTMLElement>('.legend-card')[index]
    if (!card) return

    track.classList.add('wheel-scrolling')
    setFocusedIndex(index)
    focusedIndexRef.current = index
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })

    if (wheelEndTimer.current !== null) window.clearTimeout(wheelEndTimer.current)
    wheelEndTimer.current = window.setTimeout(() => {
      track.classList.remove('wheel-scrolling')
      wheelEndTimer.current = null
    }, 260)
  }

  return (
    <main className="legends-main min-w-0">
      <section className="event-hero compact-hero legends-hero">
        <div>
          <h1>Hall of Legends</h1>
          <div className="meta-row">
            <span>{events.length} completed event{events.length === 1 ? '' : 's'}</span>
          </div>
        </div>
      </section>

      {events.length ? (
        <section className="legend-carousel-section" aria-label="Completed events">
          <div
            className="legend-carousel"
            ref={carouselRef}
            onScroll={(event) => updateFocusedCard(event.currentTarget)}
            tabIndex={0}
          >
            {events.map((event, index) => (
              <Link
                className={`legend-card${focusedIndex === index ? ' focused' : ''}`}
                key={event.id}
                to="/hall-of-legends/$eventId"
                params={{ eventId: event.id }}
                aria-label={`Open ${event.name} results`}
              >
                <span className="legend-card-shine" aria-hidden="true" />
                <div className="legend-card-title">
                  <time dateTime={event.date}>
                    {shortDateWithTimeZone(event.date, { timeZone: displayTimeZone })}
                  </time>
                  <h2>{event.name}</h2>
                </div>
                <LegendTrophy event={event} />
                <LegendScoreboard event={event} />
                <div className="legend-card-winner">
                  <span>Winning team</span>
                  <strong>{event.winningTeam?.name ?? 'Winner pending'}</strong>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section className="panel empty-state">
          <h2>No completed events yet</h2>
          <p>Completed HammaBowl events will appear here after admins record a winner.</p>
        </section>
      )}
    </main>
  )
}

function normalizeWheelDelta(delta: number, mode: number) {
  if (mode === WheelEvent.DOM_DELTA_LINE) return delta * 48
  if (mode === WheelEvent.DOM_DELTA_PAGE) return delta * window.innerWidth
  return delta
}

function LegendTrophy({ event }: { event: Pick<HistoricalEvent, 'name' | 'trophyId'> }) {
  const isBiolab = event.trophyId === 'hamma-dome-biolab'

  return (
    <div className={`legend-trophy ${isBiolab ? 'legend-trophy-biolab' : ''}`}>
      <img
        src={isBiolab ? '/trophies/hamma-dome-i.png' : '/trophies/hamma-bowl.png'}
        alt={`${event.name} trophy`}
      />
    </div>
  )
}

function LegendScoreboard({ event }: { event: HistoricalEvent }) {
  return (
    <div className="legend-scoreboard" aria-label={`${event.name} final scores`}>
      {event.teams.map((team) => (
        <div className={team.winner ? 'winner' : undefined} key={team.id}>
          <span>{team.name}</span>
          <strong>{team.score}</strong>
        </div>
      ))}
    </div>
  )
}
