import {
  Calendar,
  ChartColumnIncreasingIcon,
  FileText,
  Globe,
  Link,
  Map,
  MessageCircle,
  Play,
  ScrollText,
  Siren,
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
  { name: 'Siren', label: 'Alert' },
  { name: 'Users', label: 'Players' },
  { name: 'ScrollText', label: 'Rules' },
  { name: 'ChartColumnIncreasingIcon', label: 'Stats' }
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
  Siren,
  Trophy,
  Users,
  Video,
  ChartColumnIncreasingIcon
}

export function EventLinkIcon({ name, size = 16 }: { name: string; size?: number }) {
  const Icon = eventLinkIcons[name] ?? Link
  return <Icon size={size} aria-hidden="true" />
}
