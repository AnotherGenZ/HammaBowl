export type Role = 'viewer' | 'participant' | 'mod' | 'admin'
export type Faction = 'VS' | 'NC' | 'TR'
export type StartingSide = string

export type PlayerStatus = 'signed_up' | 'drafted' | 'disqualified'

export interface Player {
  id: string
  name: string
  groupTag?: string
  groupTagColor?: string
  outfit: string
  faction: 'VS' | 'NC' | 'TR' | 'NS'
  status: PlayerStatus
  checkedInAt?: string
  specs?: string[]
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
  honuReportUrl?: string
  honuReportCreatedAt?: string
}

export interface DraftPick {
  id: string
  playerId: string
  teamId: string
  openedByTeamId?: string
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

export interface EventRound {
  eventId: string
  roundNumber: number
  startedAt: string
  durationSeconds: number
  teamScores: Record<string, number>
  winningTeamId?: string
  resultNote?: string
  updatedAt: string
}

export interface EventLink {
  url: string
  name: string
  icon: string
}

export interface EventSpecOption {
  name: string
  emoji?: string
  limit?: number
}

export type EventTrophyId = 'hammo-bowl-cup' | 'hamma-dome-biolab'

export interface HammaEvent {
  id: string
  raidHelperEventId: string
  raidHelperChannelId?: string
  source: 'raid_helper' | 'native' | 'manual'
  eventChannelId?: string
  eventColor?: string
  eventImageUrl?: string
  mentionRoleIds?: string[]
  embedUseDiscordMentions?: boolean
  autoCreateSignupThread?: boolean
  minSignupSpecs?: number
  maxSignupSpecs?: number
  allowMultipleSignups?: boolean
  discordCheckInMessageId?: string
  discordCheckInMessageChannelId?: string
  name: string
  nameOverride?: string
  server: string
  startsAt: string
  endsAt?: string
  closingTime?: string
  draftStartMinutesBefore?: number
  roundCount: number
  roundDurationSeconds: number
  phase: 'signups' | 'rating' | 'draft' | 'locked' | 'complete'
  salaryPool: number
  bonusPool: number
  maxPlayerBonus: number
  bidIncrement: number
  pendingPlayerCount: number
  availableFactions: Faction[]
  availableSides: StartingSide[]
  availableSpecs?: string[]
  availableSpecOptions?: EventSpecOption[]
  teams: Team[]
  players: Player[]
  ratings: Rating[]
  draftPicks: DraftPick[]
  activeDraftBid?: ActiveDraftBid
  nextPickTeamId?: string
  coinflip?: Coinflip
  rounds: EventRound[]
  winningTeamId?: string
  twitchStreamUrl?: string
  twitchVodUrl?: string
  eventDescription?: string
  eventLinks: EventLink[]
  trophyId: EventTrophyId
  lore?: string
  honuZoneId: number
  honuAlertId?: number
  honuAlertCreatedAt?: string
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
  salaryPool: number
  bonusPool: number
  trophyId: EventTrophyId
  twitchStreamUrl?: string
  twitchVodUrl?: string
  lore?: string
  honuAlertId?: number
  honuAlertCreatedAt?: string
  winningTeam?: {
    id: string
    name: string
    members: string[]
    memberProfiles: Array<{
      discordId: string
      name: string
      groupTag?: string
      groupTagColor?: string
    }>
  }
  rounds: Array<EventRound & { winningTeamName?: string }>
  teams: Array<{
    id: string
    name: string
    captainDiscordId?: string
    captain?: string
    score: number
    members: string[]
    memberProfiles: Array<{
      discordId: string
      name: string
      groupTag?: string
      groupTagColor?: string
    }>
    winner: boolean
    honuReportUrl?: string
    honuReportCreatedAt?: string
  }>
  playerRatings: Array<{
    discordId: string
    name: string
    groupTag?: string
    groupTagColor?: string
    specs: string[]
    averageRating: number | null
    ratingCount: number
    salary: number | null
    teamId?: string
    teamName?: string
    isCaptain: boolean
    disqualified: boolean
  }>
  draftPicks: Array<{
    id: string
    order: number
    player: {
      discordId: string
      name: string
      groupTag?: string
      groupTagColor?: string
    }
    team: {
      id: string
      name: string
    }
    openedByTeam?: {
      id: string
      name: string
    }
    contestedByTeam?: {
      id: string
      name: string
    }
    salary: number
    bonusSpent: number
    confirmedAt: string
  }>
}

export interface RegisteredParticipant {
  discordId: string
  name: string
  groupTag?: string
  groupTagColor?: string
}

export type GroupMembershipStatus = 'pending' | 'member'

export interface GroupParticipant {
  discordId: string
  name: string
  groupTag?: string
  groupTagColor?: string
  avatarUrl?: string
}

export interface GroupSummary {
  id: string
  tag: string
  name: string
  logoUrl?: string
  tagColor: string
  description: string
  memberCount: number
  pendingCount: number
  administratorCount: number
  currentUserStatus?: GroupMembershipStatus
  currentUserIsAdministrator: boolean
}

export interface GroupDetail extends GroupSummary {
  administrators: GroupParticipant[]
  members: GroupParticipant[]
  pendingMembers: GroupParticipant[]
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
  source?: 'automatic' | 'system' | 'manual'
}

export interface PlayerProfile {
  discordId: string
  name: string
  groupId?: string
  groupName?: string
  groupTag?: string
  groupTagColor?: string
  avatarUrl?: string
  bannerUrl?: string
  catchphrase?: string
  characters: PlayerCharacter[]
  events: Array<{
    id: string
    name: string
    startsAt: string
    teamId?: string
    teamName?: string
    role?: 'captain' | 'player'
    winner: boolean
  }>
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
  groupTag?: string
  groupTagColor?: string
  noPersonalJaegerAccount: boolean
  assignments: PlayerCharacter[]
  assignment?: PlayerCharacter
}

export interface PlayerProfileSummary {
  discordId: string
  name: string
  groupTag?: string
  groupTagColor?: string
  avatarUrl?: string
  bannerUrl?: string
  catchphrase?: string
  eventCount: number
  winCount: number
  averageRating: number | null
  characterCount: number
  badges: PlayerBadge[]
  events: Array<{
    id: string
    name: string
    startsAt: string
  }>
}

export interface AdminBadgeDefinition {
  id: string
  name: string
  description: string
  color: string
  source: 'system' | 'manual'
  createdAt: string
}

export interface AdminBadgeAssignment {
  badgeId: string
  discordId: string
  playerName: string
  groupTag?: string
  groupTagColor?: string
  badgeName: string
  assignedAt: string
}

export interface AdminBadgeManagerData {
  badges: AdminBadgeDefinition[]
  players: RegisteredParticipant[]
  assignments: AdminBadgeAssignment[]
}

export interface AdminSignupManagerData {
  players: RegisteredParticipant[]
  signedUpPlayers: RegisteredParticipant[]
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
  groupTag?: string
  groupTagColor?: string
  noPersonalJaegerAccount: boolean
  characters: PlayerCharacter[]
}

export interface HonuPsbAccountSuggestion {
  accountId: number
  tag: string
  name: string
  playerName: string
  label: string
  characters: PlayerCharacter[]
  updatedAt: string
}
