export type Role = 'viewer' | 'participant' | 'captain' | 'admin'
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

export interface Captain {
  id: string
  playerId: string
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
  captainId: string
  salary: number
  bonusSpent: number
  contestedByCaptainId?: string
  confirmedAt: string
}

export interface ActiveDraftBid {
  id: string
  playerId: string
  openedByCaptainId: string
  highestCaptainId: string
  nextCaptainId: string
  currentBonus: number
  createdAt: string
  updatedAt: string
}

export interface Coinflip {
  id: string
  callingCaptainId: string
  call?: 'heads' | 'tails'
  result?: 'heads' | 'tails'
  winningCaptainId?: string
  choiceType?: 'faction' | 'side'
  chosenFaction?: Faction
  chosenStartingSide?: StartingSide
  firstPickCaptainId?: string
  createdAt: string
  updatedAt?: string
}

export interface HammaEvent {
  id: string
  raidHelperEventId: string
  name: string
  nameOverride?: string
  server: string
  startsAt: string
  closingTime?: string
  phase: 'signups' | 'rating' | 'draft' | 'locked' | 'complete'
  salaryPool: number
  pendingPlayerCount: number
  availableFactions: Faction[]
  availableSides: StartingSide[]
  captains: Captain[]
  players: Player[]
  ratings: Rating[]
  draftPicks: DraftPick[]
  activeDraftBid?: ActiveDraftBid
  nextPickCaptainId?: string
  coinflip?: Coinflip
  winningCaptainId?: string
  twitchStreamUrl?: string
  twitchVodUrl?: string
  lore?: string
}

export interface PlayerSalary {
  player: Player
  averageRating: number
  ratingCount: number
  pointShare: number
  salary: number
}

export interface TeamLedger {
  captain: Captain
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
