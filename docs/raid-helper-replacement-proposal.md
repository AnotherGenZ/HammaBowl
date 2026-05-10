# Native Event Signups Proposal

## Goal

Replace Hamma Bowl's Raid-Helper dependency with native event scheduling, Discord signup, reminder, composition, and roster tooling while preserving the current Hamma Bowl event flow: signup intake, ratings, draft, check-in, team composition, rounds, archive, and player history.

The target outcome is not a general Raid-Helper clone. It is a Hamma Bowl-native event system that covers the features this project actually relies on, removes external API coupling, and gives admins a web-first control surface backed by the existing Discord bot.

## Sources Reviewed

- Raid-Helper official site and docs pages requested:
  - https://raid-helper.xyz/
  - https://raid-helper.xyz/documentation/intro
  - https://raid-helper.xyz/documentation/advanced
  - https://raid-helper.xyz/documentation/guides
- Rendered Raid-Helper intro documentation snapshot, captured via Playwright because the docs are a JavaScript-rendered app.
- Raid-Helper behavior references from:
  - https://discord.fandom.com/wiki/Bot%3ARaid-Helper
  - https://techcult.com/how-to-use-raid-helper-bot-in-discord/
  - https://www.songofsunandmoon.com/guides/raid-helper

Source caveat: the official docs expose only the JavaScript app shell to non-browser fetches. The intro page was rendered with Playwright and used as the primary official source for permissions, timezone setup, event creation/editing, advanced settings, raider roles, and scheduled events. The advanced/guides feature list is corroborated by community documentation and command references.

## Current Hamma Bowl State

Hamma Bowl already treats Raid-Helper as a source adapter:

- `src/lib/raidHelper.ts` reads current events, signups, signup specs, closing time, Discord channel, and posts final compositions back to Raid-Helper.
- `src/lib/services.ts` periodically hydrates Raid-Helper data into SQLite and exposes `HammaEvent`.
- `src/lib/db.server.ts` persists events, participants, specs, teams, ratings, drafts, check-in state, rounds, archives, and player metadata.
- `src/routes/api.discord.interactions.ts` handles Discord interactions, currently only `/checkin` and the check-in button.
- `src/lib/discordCheckIn.server.ts` posts a native Discord check-in prompt, but it still depends on the Raid-Helper channel/message context.
- `src/components/AdminTools.tsx` has admin controls for event sync, team composition, names, teams, ratings, rounds, and Jaeger character setup.

That shape is useful: the replacement can be introduced by swapping the source of event and signup truth, not by rewriting the whole tournament flow.

## Raid-Helper Capabilities To Replace

### Must Have

- Event creation with title, date/time, duration, signup close/deadline, channel, description, image/color metadata, and optional mention roles.
- Discord-posted event message with signup controls.
- Signup states: accepted/signed up, maybe/tentative, bench, absent/declined, late, and unregister.
- Class/spec or role/spec selection, adapted to Hamma Bowl specs.
- Per-event signup limits and per-spec limits.
- One signup per user by default.
- Admin add/remove/move signup actions.
- Event editing after posting.
- Server-level defaults so admins do not reconfigure the same settings every event.
- Scheduled and recurring events.
- Reminders before signup close and event start.
- Message signed users, unsigned users, or admins.
- List/export signups.
- Composition publication after draft.

### Should Have

- Allowed/banned Discord role gates for signups.
- Automatic event thread for event discussion.
- Logging/audit channel for event creation, edits, and signup changes.
- Native event overview page in Hamma Bowl.
- Discord Scheduled Event sync.
- User-local Discord timestamps for event times.
- Copy signups from a previous event for recurring/statics-style events.
- Archive or lock events after completion.

### Not Needed Initially

- Generic MMO templates unrelated to Hamma Bowl.
- Multi-server event mirroring.
- DKP, item lookup, welcome messages, reaction roles, or polls unless they become separate product goals.
- Fully user-customizable template builders in phase one.
- Import/export format compatibility with Raid-Helper custom templates.

## Product Proposal

### Concept

Build a native "Event Ops" system with two admin surfaces:

- Web admin event editor for precise setup, templates, limits, reminders, and roster management.
- Discord bot interactions for fast user signup and moderator adjustments inside Discord.

The Discord message should be a live summary of the event, not the only system of record. SQLite should own event state. Discord messages are views that can be rebuilt after edits, deleted messages, or bot restarts.

### User Flow

1. Admin creates or schedules a Hamma Bowl event in `/admin/general`.
2. Admin selects a native event template, likely "Hamma Bowl Standard".
3. Hamma Bowl posts a Discord embed into the configured event channel with buttons:
   - Sign Up
   - Maybe
   - Bench
   - Absent
   - Remove
4. `Sign Up` opens a Discord modal or select flow for:
   - preferred specs
   - optional faction/character readiness
   - optional note
5. Hamma Bowl validates role gates, limits, signup window, one-signup-per-user, and Discord membership.
6. The event message updates with grouped counts and a concise roster summary.
7. Reminders run from Hamma Bowl:
   - unsigned eligible users before close
   - accepted/maybe users before start
   - admins if minimum signup count is not reached
8. Existing rating, draft, check-in, team sync, and archive flows operate from the same `HammaEvent` shape they use today.

### Admin Flow

Admins need to create and manage the event without leaving Hamma Bowl:

- Create, edit, duplicate, schedule, cancel, close, reopen, and archive events.
- Choose Discord channel, announcement roles, allowed roles, banned roles, and optional thread creation.
- Manage signup templates and spec limits.
- Add/remove/move users between accepted, maybe, bench, absent, and disqualified states.
- Refresh/repost Discord message if Discord state drifts.
- Export CSV.
- Send targeted Discord messages to signed, unsigned, maybe, bench, checked-in, unchecked-in, captains, or admins.

## Architecture

### Domain Boundary

Introduce a native event-signup module and keep a compatibility layer:

- New: `src/lib/eventSignups.server.ts`
- New: `src/lib/eventDiscord.server.ts`
- New: `src/lib/eventScheduler.server.ts`
- Replace most of `src/lib/raidHelper.ts` with a deprecated adapter retained only for migration/import.
- Keep `HammaEvent` as the read model consumed by draft/rating/check-in components.

This keeps the UI and tournament logic stable while event ownership moves from Raid-Helper to Hamma Bowl.

### Data Model

Add native tables rather than overloading Raid-Helper columns:

- `event_templates`
  - `id`, `name`, `description`, `color`, `default_channel_id`, `default_duration_minutes`, `default_signup_close_minutes_before`, `created_at`, `updated_at`
- `event_template_options`
  - template-defined signup options such as `accepted`, `maybe`, `bench`, `absent`, `remove`, `late`
- `event_template_specs`
  - canonical Hamma Bowl spec options, display order, default limits
- `event_signup_limits`
  - `event_id`, optional `status`, optional `spec_name`, `limit`
- `event_signups`
  - `event_id`, `discord_id`, `status`, `late_minutes`, `note`, `created_at`, `updated_at`, `created_by_discord_id`
- `event_signup_specs`
  - `event_id`, `discord_id`, `spec_name`, `position`
- `event_discord_messages`
  - `event_id`, `kind`, `channel_id`, `message_id`, `thread_id`, `updated_at`
- `event_reminders`
  - `id`, `event_id`, `kind`, `target`, `offset_minutes`, `channel_id`, `message`, `enabled`, `last_sent_at`
- `event_recurrences`
  - `id`, `template_event_id`, `interval_days`, `post_time`, `next_post_at`, `enabled`
- `event_audit_log`
  - `id`, `event_id`, `actor_discord_id`, `action`, `payload_json`, `created_at`

Existing tables should remain:

- `events` remains the canonical event record.
- `event_participants` remains the draft/rating participant read model.
- `event_participant_specs` remains the existing spec read model.

During migration, `event_signups` should project accepted signups into `event_participants` so the rest of the app keeps working.

### Compatibility Changes

Rename semantics over time:

- `events.raid_helper_event_id` becomes legacy external ID. Add `events.source` and `events.discord_event_message_id` or keep Discord messages in `event_discord_messages`.
- `raidHelperChannelId` in `HammaEvent` should become `eventChannelId`, with a temporary alias for existing code.
- `pendingSignupCount` should be derived from native maybe/tentative signups.
- `src/lib/services.ts` should refresh from the native DB first, with Raid-Helper hydration behind a migration flag.

### Discord Interaction Design

Add slash commands:

- `/event create` for admins/mods, minimal fast path.
- `/event edit` for admins/mods.
- `/event signup` for users if they are not using the message button.
- `/event signed` for admins/mods.
- `/event unsigned` for admins/mods.
- `/event message-signed` for admins/mods.
- `/event close` and `/event open` for admins/mods.

Add components:

- Event embed buttons: sign up, maybe, bench, absent, remove.
- Select menus for spec selection.
- Modal for optional notes.
- Admin-only message components for close, refresh, export, and targeted message.

Discord API considerations:

- Embeds have size limits, so large rosters should show counts plus a compact visible list, with a Hamma Bowl link for the full roster.
- Component custom IDs should include stable event ID and action, for example `hammabowl:event-signup:<eventId>:accepted`.
- Every interaction should return an ephemeral confirmation.
- Message updates should be debounced/coalesced to avoid Discord rate limits during signup bursts.
- Discord timestamps should be used for event time display to handle user-local rendering.

### Reminder System

Use a lightweight scheduler in the server process first:

- Poll every minute for due reminders.
- Store `last_sent_at` to keep reminders idempotent.
- Use `setInterval(...).unref()` like the existing Raid-Helper auto-refresh pattern.
- For multi-instance deployment later, add a lock table or job runner.

Reminder targets:

- signed users
- maybe/bench users
- unsigned eligible users based on configured raider roles
- captains/admins
- event channel
- event thread

### Signup Validation

Centralize signup validation in server code:

- Event exists and is in `signups` or explicitly open.
- Signup window has not closed.
- User is a guild member.
- User does not have banned roles.
- User has at least one allowed role when the event defines allowed roles.
- User signup count does not exceed one unless the event permits multiple.
- Status/spec limits are not exceeded.
- Specs are allowed for the event.
- Removing signup after lock requires admin unless configured otherwise.

This validation should be used by both web admin actions and Discord interactions.

### Composition Replacement

Today, final teams are pushed back into Raid-Helper through `buildRaidHelperCompUpdate`. Replace that with native composition rendering:

- A Discord "Teams" message posted or updated after draft.
- Optional event embed field showing team counts and captain names.
- Hamma Bowl remains the full composition source of truth.
- Add export formats if needed: CSV, Markdown, plain Discord message.

The existing `buildTeamLedgers(event)` logic can drive this directly.

## Implementation Plan

### Phase 0: Inventory And Migration Guardrails

- Add `events.source` with values `raid_helper` and `native`.
- Add a feature flag such as `NATIVE_EVENT_SIGNUPS_ENABLED`.
- Add tests around current Raid-Helper hydration behavior before changing it.
- Document current Raid-Helper fields and how they map into native events.

Deliverable: current behavior is protected; native work can ship behind a flag.

### Phase 1: Native Event Storage And Read Model

- Add tables for templates, signups, signup specs, limits, Discord messages, reminders, recurrence, and audit log.
- Add `eventSignups.server.ts` with create/update/remove/list signup operations.
- Project native accepted signups into `event_participants` and `event_participant_specs`.
- Update `getCurrentDbEvent()` paths only as needed so existing UI sees native signups.
- Seed a default "Hamma Bowl Standard" template from current event defaults.

Deliverable: admins can create a native event in DB and it appears as a normal `HammaEvent`.

### Phase 2: Admin UI For Event Setup

- Add an Event Ops admin section under `/admin/general` or a dedicated `/admin/events`.
- Build create/edit forms for title, start/end, closing time, channel, description, specs, limits, allowed/banned roles, reminders, and recurrence.
- Add signup management UI for moving users between statuses and editing specs.
- Add duplicate event and copy signups actions.

Deliverable: a native event can be configured without Raid-Helper.

### Phase 3: Discord Event Message And Signup Interactions

- Extend `DISCORD_SLASH_COMMANDS` and `api.discord.interactions.ts` with event commands and component routing.
- Add `eventDiscord.server.ts` to render event embeds and components.
- Implement signup button/select/modal flow.
- Add message update coalescing and event audit logging.
- Reuse existing Discord REST helpers in `src/lib/discord.ts`.

Deliverable: users can sign up in Discord and Hamma Bowl updates its own event message.

### Phase 4: Reminders, Unsigned Lists, And Targeted Messaging

- Add reminder scheduler and due-reminder query.
- Implement unsigned user calculation from configured raider roles and Discord guild member role data.
- Add admin actions for `signed`, `unsigned`, and targeted messages.
- Add CSV export.

Deliverable: Hamma Bowl covers the operational features that currently keep Raid-Helper in the loop.

### Phase 5: Native Composition Publishing

- Replace `syncTeamCompositionToRaidHelper` with `publishTeamCompositionToDiscord`.
- Post/update a native composition message and link it from admin UI.
- Keep the old Raid-Helper sync button available only for `source = raid_helper` events during migration.

Deliverable: final teams no longer need Raid-Helper comps.

### Phase 6: Scheduled And Recurring Events

- Implement recurrence materialization.
- Allow scheduled event posts at a configured post time.
- Add admin overview of pending scheduled posts.
- Add audit/log messages when events are posted automatically.

Deliverable: weekly or recurring Hamma Bowl events can be posted automatically.

### Phase 7: Decommission Raid-Helper

- Stop automatic Raid-Helper refresh when native mode is enabled.
- Convert old active events or complete them under legacy mode.
- Remove `RAID_HELPER_API_KEY` and `RAID_HELPER_SERVER_ID` from required production config.
- Keep import-only code temporarily if historical Raid-Helper migration is needed.
- Rename UI text from "Raid Helper refresh/sync" to "Event sync" or remove it.

Deliverable: Raid-Helper is no longer required for normal Hamma Bowl operations.

## Rollout Strategy

Use a dual-source migration:

1. Keep Raid-Helper for the next live event while native tables and admin UI are built.
2. Create a test native event in a private Discord channel.
3. Run signup, edit, reminder, close, check-in, rating, draft, and composition drills.
4. Use native mode for a low-risk event.
5. Keep Raid-Helper fallback for one more event cycle.
6. Remove Raid-Helper from the live workflow after native event ops survives a complete event.

Do not migrate mid-event unless the Raid-Helper API fails. The risk is not the data model; it is confusing participants with two signup surfaces.

## Testing Plan

Unit tests:

- Signup validation: close windows, role gates, limits, one-signup-per-user, spec validation.
- Projection from `event_signups` into `event_participants`.
- Reminder due-time and idempotency logic.
- Discord custom ID parsing.

Integration tests:

- Create native event, sign up, change specs, move to maybe, remove signup.
- Admin add/remove/move signup.
- Event edit updates Discord message payload.
- Draft eligibility sees only accepted native signups.
- Composition message renders after draft.

Manual Discord smoke tests:

- Button signup.
- Spec select.
- Modal note submission.
- Permission denial for non-admin event edits.
- Message recovery/repost after deleting the Discord message.
- Rate-limit behavior with repeated signup changes.

## Risks And Mitigations

- Discord rate limits: debounce message edits and keep full roster in Hamma Bowl instead of forcing every name into the embed.
- Bot downtime: SQLite remains source of truth; admin can repost event messages.
- Multi-instance scheduling: start with idempotent `last_sent_at`; add DB locks before horizontal scaling.
- Permission complexity: keep a single validation module used by all write paths.
- Migration confusion: never run Raid-Helper and native signup links for the same event except in private testing.
- Schema naming debt: introduce neutral names now and treat `raidHelper*` fields as legacy aliases.

## Suggested Initial Work Items

1. Add native event source fields and signup tables.
2. Implement `eventSignups.server.ts` and native-to-`HammaEvent` projection.
3. Add a native event create/edit admin panel.
4. Add Discord event embed rendering and signup buttons.
5. Add spec select flow.
6. Add reminder scheduler.
7. Add native team composition publishing.
8. Hide Raid-Helper controls for native events.

## Open Decisions

- Whether native event creation should live in `/admin/general` or a new `/admin/events` route.
- Whether signup specs should be single-select, multi-select, ranked preferences, or current free multi-spec behavior.
- Whether bench users should count toward rating eligibility, reminder targets, and check-in.
- Whether unsigned reminders should target all Discord members with specific roles or only known Hamma Bowl participants.
- Whether recurring events should copy previous signups by default or start empty.
- Whether to create Discord Scheduled Events in addition to message embeds.

## Recommendation

Build the replacement as a native Hamma Bowl event system with Discord as an interaction surface and SQLite as the source of truth. Start with the minimum complete path for one Hamma Bowl event: create event, post signup message, collect specs/statuses, update the existing `HammaEvent` read model, run ratings/draft/check-in, and publish teams.

Once that path works end to end, add reminders, recurrence, exports, and richer admin messaging. This sequencing removes the external dependency without destabilizing the current tournament mechanics.
