export type Role = 'viewer' | 'participant' | 'admin'
export type Faction = 'VS' | 'NC' | 'TR'
export type StartingSide = string

export type PlayerStatus = 'signed_up' | 'drafted' | 'disqualified'

export interface Player {
  id: string
  name: string
  outfit: string
  faction: 'VS' | 'NC' | 'TR' | 'NS'
  status: PlayerStatus
}

export interface Rating {
  fromPlayerId: string
  toPlayerId: string
  score: number
  note?: string
  disqualified?: boolean
}

export interface Team {
  id: string
  captainDiscordId: string
  teamName: string
  faction?: Faction
  startingSide?: StartingSide
  budget: number
  bonusCap: number
  score: number
}

export interface DraftPick {
  id: string
  playerId: string
  teamId: string
  salary: number
  bonusSpent: number
  contestedByTeamId?: string
  confirmedAt: string
}

export interface ActiveDraftBid {
  id: string
  playerId: string
  openedByTeamId: string
  highestTeamId: string
  nextTeamId: string
  currentBonus: number
  createdAt: string
  updatedAt: string
}

export interface Coinflip {
  id: string
  callingTeamId: string
  call?: 'heads' | 'tails'
  result?: 'heads' | 'tails'
  winningTeamId?: string
  choiceType?: 'faction' | 'side'
  chosenFaction?: Faction
  chosenStartingSide?: StartingSide
  firstPickTeamId?: string
  createdAt: string
  updatedAt?: string
}

export interface EventLink {
  url: string
  name: string
  icon: string
}

export interface HammaEvent {
  id: string
  raidHelperEventId: string
  name: string
  nameOverride?: string
  server: string
  startsAt: string
  endsAt?: string
  closingTime?: string
  draftStartMinutesBefore?: number
  phase: 'signups' | 'rating' | 'draft' | 'locked' | 'complete'
  salaryPool: number
  bonusPool: number
  maxPlayerBonus: number
  bidIncrement: number
  pendingPlayerCount: number
  availableFactions: Faction[]
  availableSides: StartingSide[]
  teams: Team[]
  players: Player[]
  ratings: Rating[]
  draftPicks: DraftPick[]
  activeDraftBid?: ActiveDraftBid
  nextPickTeamId?: string
  coinflip?: Coinflip
  winningTeamId?: string
  twitchStreamUrl?: string
  twitchVodUrl?: string
  eventDescription?: string
  eventLinks: EventLink[]
  lore?: string
}

export interface PlayerRatingSummary {
  player: Player
  averageRating: number
  ratingCount: number
  isCaptain: boolean
}

export interface PlayerSalary extends PlayerRatingSummary {
  pointShare: number
  salary: number
}

export interface TeamLedger {
  team: Team
  captainPlayer?: Player
  picks: Array<DraftPick & { player: Player; salary: number }>
  salarySpent: number
  bonusSpent: number
  budgetRemaining: number
  bonusRemaining: number
  combinedRemaining: number
}

export interface HistoricalEvent {
  id: string
  name: string
  nameOverride?: string
  date: string
  server: string
  twitchStreamUrl?: string
  twitchVodUrl?: string
  lore?: string
  winningTeam?: {
    id: string
    name: string
    members: string[]
  }
  teams: Array<{
    id: string
    name: string
    captain?: string
    score: number
    members: string[]
    winner: boolean
  }>
}

export interface RegisteredParticipant {
  discordId: string
  name: string
}

export interface PlayerCharacter {
  faction: Faction
  characterId: string
  characterName: string
  resolvedAt: string
}

export interface PlayerBadge {
  id: string
  name: string
  description: string
  color: string
  source?: 'automatic' | 'manual'
}

export interface PlayerProfile {
  discordId: string
  name: string
  avatarUrl?: string
  bannerUrl?: string
  catchphrase?: string
  characters: PlayerCharacter[]
  stats: {
    events: number
    wins: number
    averageRating: number | null
    killsOnHamma: number
    deathsToHamma: number
    ratingHistory: Array<{
      eventId: string
      eventName: string
      startsAt: string
      averageRating: number
    }>
  }
  badges: PlayerBadge[]
}

export interface EventPlayerCharacterAssignment {
  eventId: string
  discordId: string
  playerName: string
  noPersonalJaegerAccount: boolean
  assignment?: PlayerCharacter
}

export interface PlayerProfileSummary {
  discordId: string
  name: string
  avatarUrl?: string
  catchphrase?: string
  eventCount: number
  winCount: number
  averageRating: number | null
  characterCount: number
  badges: PlayerBadge[]
}

export interface AdminBadgeDefinition {
  id: string
  name: string
  description: string
  color: string
  source: 'automatic' | 'manual'
  createdAt: string
}

export interface AdminBadgeAssignment {
  badgeId: string
  discordId: string
  playerName: string
  badgeName: string
  assignedAt: string
}

export interface AdminBadgeManagerData {
  badges: AdminBadgeDefinition[]
  players: RegisteredParticipant[]
  assignments: AdminBadgeAssignment[]
}

export interface AdminPlayerProfileEditorData {
  player: RegisteredParticipant
  catchphrase: string
  badges: AdminBadgeDefinition[]
  assignedBadgeIds: string[]
  visibleBadges: PlayerBadge[]
}

export interface AdminPlayerCharacterConfig {
  discordId: string
  name: string
  noPersonalJaegerAccount: boolean
  characters: PlayerCharacter[]
}
