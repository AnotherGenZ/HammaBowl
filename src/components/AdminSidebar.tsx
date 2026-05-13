import { Link, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface AdminSidebarSection {
  id: string
  label: string
  status?: 'ok' | 'warning' | 'pending'
  badge?: string
  group?: string
}

const ADMIN_TABS = [
  { id: '/admin', label: 'Event Admin' },
  { id: '/admin/general', label: 'General' },
  { id: '/admin/history', label: 'History' },
] as const

const adminTabClass =
  'inline-flex min-h-10 items-center justify-center rounded-md border border-white/[0.08] bg-white/[0.04] px-3 text-sm font-black text-[#cbd5d3] transition-colors hover:border-[#e4b45e]/40 hover:bg-[#e4b45e]/[0.10] hover:text-[#f3d99d]'
const adminTabActiveClass = `${adminTabClass} border-[#e4b45e]/55 bg-[#e4b45e]/[0.16] text-[#f3d99d]`
const sectionButtonBaseClass =
  'grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 rounded-md border border-transparent bg-transparent px-2.5 py-2 text-left transition-colors hover:border-white/[0.10] hover:bg-white/[0.06]'
const sectionButtonActiveClass = `${sectionButtonBaseClass} !border-[#e4b45e]/[0.42] !bg-[#e4b45e]/[0.14] shadow-[inset_3px_0_0_rgba(228,180,94,0.72)]`

export function AdminLayout({
  sections,
  children,
}: {
  sections: AdminSidebarSection[]
  children: ReactNode
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [activeSection, setActiveSection] = useState(sections[0]?.id ?? '')
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false)
  const activeSectionRef = useRef(activeSection)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isScrollingTo = useRef(false)
  const activeSectionLabel = sections.find((section) => section.id === activeSection)?.label ?? sections[0]?.label ?? 'Sections'

  useEffect(() => {
    activeSectionRef.current = activeSection
  }, [activeSection])

  useEffect(() => {
    if (sections.length > 0) {
      const first = sections[0].id
      activeSectionRef.current = first
      setActiveSection(first)
    }
    setSectionMenuOpen(false)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [pathname, sections])

  useEffect(() => {
    const container = scrollRef.current
    if (!container || sections.length === 0) return

    function updateActiveSection(anchorTop: number, getTop: (element: HTMLElement) => number) {
      if (isScrollingTo.current) return
      let best: string | null = null
      let bestDist = Infinity

      for (const section of sections) {
        const el = document.getElementById(section.id)
        if (!el) continue
        const dist = Math.abs(getTop(el) - anchorTop)
        if (dist < bestDist) {
          bestDist = dist
          best = section.id
        }
      }

      if (best && best !== activeSectionRef.current) {
        setActiveSection(best)
      }
    }

    function onContainerScroll() {
      const containerTop = container!.getBoundingClientRect().top
      updateActiveSection(40, (element) => element.getBoundingClientRect().top - containerTop)
    }

    function onWindowScroll() {
      if (!window.matchMedia('(max-width: 1023px)').matches) return
      const sidebarBottom = document.querySelector<HTMLElement>('.admin-sidebar')?.getBoundingClientRect().bottom ?? 0
      updateActiveSection(sidebarBottom + 16, (element) => element.getBoundingClientRect().top)
    }

    container.addEventListener('scroll', onContainerScroll, { passive: true })
    window.addEventListener('scroll', onWindowScroll, { passive: true })
    window.addEventListener('resize', onWindowScroll, { passive: true })
    return () => {
      container.removeEventListener('scroll', onContainerScroll)
      window.removeEventListener('scroll', onWindowScroll)
      window.removeEventListener('resize', onWindowScroll)
    }
  }, [sections])

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id)
    const container = scrollRef.current
    if (!el || !container) return

    setActiveSection(id)
    setSectionMenuOpen(false)
    isScrollingTo.current = true
    if (window.matchMedia('(max-width: 1023px)').matches) {
      el.scrollIntoView({ block: 'start', behavior: 'smooth' })
      setTimeout(() => { isScrollingTo.current = false }, 700)
      return
    }
    const offset = el.offsetTop - container.offsetTop - 16
    container.scrollTo({ top: offset, behavior: 'smooth' })
    setTimeout(() => { isScrollingTo.current = false }, 700)
  }, [])

  return (
    <div className="admin-sidebar-layout grid h-full min-h-0 min-w-0 grid-cols-[260px_minmax(0,1fr)] overflow-hidden rounded-lg border border-white/[0.10] bg-[#13171a] max-[1023px]:h-auto max-[1023px]:grid-cols-1 max-[1023px]:gap-3 max-[1023px]:overflow-visible">
      <div className="admin-sidebar min-w-0 border-r border-white/[0.08] bg-[#111417] p-3 max-[1023px]:sticky max-[1023px]:top-[66px] max-[1023px]:z-[8] max-[1023px]:grid max-[1023px]:max-h-[42dvh] max-[1023px]:gap-2 max-[1023px]:overflow-auto max-[1023px]:border-r-0">
        <div className="admin-sidebar-tabs flex min-w-0 gap-2 max-[1023px]:overflow-x-auto max-[1023px]:pb-1 max-[1023px]:[scroll-snap-type:x_proximity] lg:grid">
          {ADMIN_TABS.map((tab) => (
            <Link
              key={tab.id}
              to={tab.id}
              className={`${adminTabClass} max-[1023px]:shrink-0 max-[1023px]:[scroll-snap-align:start]`}
              activeOptions={{ exact: true }}
              activeProps={{ className: `${adminTabActiveClass} max-[1023px]:shrink-0 max-[1023px]:[scroll-snap-align:start]` }}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        {sections.length > 0 ? (
          <div className="admin-sidebar-sections grid min-w-0 gap-1.5 pt-3 max-[1023px]:pt-0">
            <button
              type="button"
              className="admin-sidebar-menu-toggle hidden min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-white/[0.12] bg-white/[0.06] px-3 py-2 text-left max-[1023px]:grid"
              aria-expanded={sectionMenuOpen}
              aria-controls="admin-section-menu"
              onClick={() => setSectionMenuOpen((open) => !open)}
            >
              <span className="grid min-w-0 gap-0.5">
                <span className="text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#8a9896]">Section</span>
                <strong className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-[#fff7e6]">{activeSectionLabel}</strong>
              </span>
              <span className="text-lg leading-none text-[#e4b45e]" aria-hidden="true">{sectionMenuOpen ? '−' : '+'}</span>
            </button>
            <div
              id="admin-section-menu"
              className={`${sectionMenuOpen ? 'grid' : 'hidden'} admin-sidebar-section-menu min-w-0 gap-1.5 lg:grid max-[1023px]:max-h-[52dvh] max-[1023px]:overflow-y-auto max-[1023px]:rounded-lg max-[1023px]:border max-[1023px]:border-white/[0.10] max-[1023px]:bg-[#0f1215] max-[1023px]:p-2`}
            >
              {sections.map((s, index) => {
                const active = activeSection === s.id
                const previous = sections[index - 1]
                const showGroup = Boolean(s.group && s.group !== previous?.group)
                return (
                  <div key={s.id} className="admin-sidebar-section-group">
                    {showGroup ? (
                      <div className="admin-sidebar-group-label mb-1.5 mt-3 flex items-center gap-2 text-[0.68rem] font-black uppercase tracking-[0.08em] text-[#8a9896] first:mt-0 max-[1023px]:mt-2">
                        <span>{s.group}</span>
                        <span className="h-px flex-1 bg-white/[0.08]" aria-hidden="true" />
                      </div>
                    ) : null}
                    <button
                      type="button"
                      className={active ? sectionButtonActiveClass : sectionButtonBaseClass}
                      onClick={() => scrollToSection(s.id)}
                    >
                      {s.status ? (
                        <span
                          className={`admin-sidebar-status size-2.5 rounded-full ${
                            s.status === 'ok'
                              ? 'bg-[#47bf8f] shadow-[0_0_0_3px_rgba(71,191,143,0.14)]'
                              : s.status === 'warning'
                                ? 'bg-[#e4b45e] shadow-[0_0_0_3px_rgba(228,180,94,0.14)]'
                                : 'bg-[#8a9896] shadow-[0_0_0_3px_rgba(138,152,150,0.14)]'
                          }`}
                          aria-hidden="true"
                        />
                      ) : null}
                      <span
                        className={`admin-sidebar-section-label min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-sm font-extrabold ${
                          active ? 'text-[#fff7e6]' : 'text-[#cbd5d3]'
                        }`}
                      >
                        {s.label}
                      </span>
                      {s.badge ? (
                        <span className="admin-sidebar-badge grid min-w-6 place-items-center rounded-full border border-[#e4b45e]/40 bg-[#e4b45e]/[0.14] px-2 py-0.5 text-[0.72rem] font-black text-[#f3d99d]">
                          {s.badge}
                        </span>
                      ) : null}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>
      <div
        ref={scrollRef}
        className="admin-sidebar-content min-h-0 min-w-0 overflow-y-auto bg-[#13171a] max-[1023px]:h-auto max-[1023px]:overflow-visible [&>.panel]:mt-0 [&>.panel]:rounded-none [&>.panel]:border-0 [&>.panel]:bg-transparent [&>section.panel]:mt-0 [&>section.panel]:rounded-none [&>section.panel]:border-0 [&>section.panel]:bg-transparent"
      >
        {children}
      </div>
    </div>
  )
}
