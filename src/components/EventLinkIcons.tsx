import {
  Calendar,
  FileText,
  Globe,
  Link,
  Map,
  MessageCircle,
  Play,
  ScrollText,
  Trophy,
  Users,
  Video,
  type LucideIcon,
} from 'lucide-react'

export const EVENT_LINK_ICON_OPTIONS = [
  { name: 'Link', label: 'Link' },
  { name: 'Globe', label: 'Globe' },
  { name: 'Calendar', label: 'Calendar' },
  { name: 'Trophy', label: 'Trophy' },
  { name: 'Play', label: 'Stream' },
  { name: 'Video', label: 'Video' },
  { name: 'MessageCircle', label: 'Discord' },
  { name: 'FileText', label: 'Document' },
  { name: 'Map', label: 'Map' },
  { name: 'Users', label: 'Players' },
  { name: 'ScrollText', label: 'Rules' },
] as const

const eventLinkIcons: Record<string, LucideIcon> = {
  Calendar,
  FileText,
  Globe,
  Link,
  Map,
  MessageCircle,
  Play,
  ScrollText,
  Trophy,
  Users,
  Video,
}

export function EventLinkIcon({ name, size = 16 }: { name: string; size?: number }) {
  const Icon = eventLinkIcons[name] ?? Link
  return <Icon size={size} aria-hidden="true" />
}
