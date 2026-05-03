import { Link, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'

export interface AdminSidebarSection {
  id: string
  label: string
  status?: 'ok' | 'warning' | 'pending'
  badge?: string
}

const ADMIN_TABS = [
  { id: '/admin', label: 'Event Config' },
  { id: '/admin/general', label: 'General' },
  { id: '/admin/history', label: 'History' },
] as const

export function AdminLayout({
  sections,
  children,
}: {
  sections: AdminSidebarSection[]
  children: ReactNode
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [activeSection, setActiveSection] = useState(sections[0]?.id ?? '')
  const activeSectionRef = useRef(activeSection)
  const scrollRef = useRef<HTMLDivElement>(null)
  const isScrollingTo = useRef(false)

  useEffect(() => {
    activeSectionRef.current = activeSection
  }, [activeSection])

  useEffect(() => {
    if (sections.length > 0) {
      const first = sections[0].id
      activeSectionRef.current = first
      setActiveSection(first)
    }
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }, [pathname, sections])

  useEffect(() => {
    const container = scrollRef.current
    if (!container || sections.length === 0) return

    function onScroll() {
      if (isScrollingTo.current) return
      const containerTop = container!.getBoundingClientRect().top
      let best: string | null = null
      let bestDist = Infinity

      for (const section of sections) {
        const el = document.getElementById(section.id)
        if (!el) continue
        const top = el.getBoundingClientRect().top - containerTop
        const dist = Math.abs(top - 40)
        if (dist < bestDist) {
          bestDist = dist
          best = section.id
        }
      }

      if (best && best !== activeSectionRef.current) {
        setActiveSection(best)
      }
    }

    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [sections])

  const scrollToSection = useCallback((id: string) => {
    const el = document.getElementById(id)
    const container = scrollRef.current
    if (!el || !container) return

    setActiveSection(id)
    isScrollingTo.current = true
    const offset = el.offsetTop - container.offsetTop - 16
    container.scrollTo({ top: offset, behavior: 'smooth' })
    setTimeout(() => { isScrollingTo.current = false }, 700)
  }, [])

  return (
    <div className="admin-sidebar-layout">
      <div className="admin-sidebar">
        <div className="admin-sidebar-tabs">
          {ADMIN_TABS.map((tab) => (
            <Link
              key={tab.id}
              to={tab.id}
              className="admin-sidebar-tab"
              activeOptions={{ exact: true }}
              activeProps={{ className: 'admin-sidebar-tab active' }}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        {sections.length > 0 ? (
          <div className="admin-sidebar-sections">
            {sections.map((s) => {
              const active = activeSection === s.id
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`admin-sidebar-section${active ? ' active' : ''}`}
                  onClick={() => scrollToSection(s.id)}
                >
                  {s.status ? (
                    <span
                      className={`admin-sidebar-status admin-sidebar-status-${s.status}`}
                      aria-hidden="true"
                    />
                  ) : null}
                  <span className="admin-sidebar-section-label">{s.label}</span>
                  {s.badge ? <span className="admin-sidebar-badge">{s.badge}</span> : null}
                </button>
              )
            })}
          </div>
        ) : null}
      </div>
      <div ref={scrollRef} className="admin-sidebar-content">
        {children}
      </div>
    </div>
  )
}
