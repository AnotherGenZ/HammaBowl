import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/hall-of-legends')({
  component: HallOfLegends,
})

function HallOfLegends() {
  return (
    <main>
      <section className="panel hall-page">
        <img src="/under-construction.svg" alt="" />
        <div>
          <h1>Hall of Legends</h1>
          <p>Coming Soon</p>
        </div>
      </section>
    </main>
  )
}
