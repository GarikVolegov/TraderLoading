# TraderLoadings Admin Panel Design

Date: 2026-06-10
Status: Draft for product review

## Objective

Design a secure, scalable, data-dense admin panel for managing TraderLoadings across users, trading data, broker connections, content, community, support, security, and runtime operations.

The admin panel must help an owner or small operations team answer three questions quickly:

1. Is the product healthy right now?
2. Which users or systems need intervention?
3. What actions were taken, by whom, and why?

## Product Context

TraderLoadings includes:

- User profiles, authentication, sessions, login access, user settings, push subscriptions.
- Trading data such as imported account trades, broker profiles, broker sync flows, MT5/FXBlue/SnapTrade/cTrader integrations, backtest sessions, and backtest trades.
- Personal productivity and coaching flows such as journal entries, journal recaps, check-ins, routines, checklist items, ideas, goals, missions, quotes, milestones, and level certificates.
- AI/Brain features such as strategies, analyses, scan configuration, knowledge sources, graph nodes and edges, and feedback.
- Community and social features such as posts, comments, follows, friendships, communities, channels, files, global chat, voice presence, and E2EE direct chat metadata.
- News and calendar features such as news snapshots, news feedback, news preferences, macro news runtime, and economic calendar.
- Runtime services such as API health, web sockets, push notifications, news provider jobs, broker bridge jobs, and deployment/runtime logs.

## Target Admin Users

Initial target:

- Owner / Super Admin: full access, high-risk actions, system controls.

Future target:

- Support Agent: user lookup, ticket handling, session reset, safe diagnostics.
- Moderator: community safety and reported content.
- Content Manager: library, mission templates, milestones, quotes.
- Ops / Developer: health checks, runtime diagnostics, feature flags.
- Finance Operator: subscriptions, invoices, refunds, billing state when monetization is added.

## Information Architecture

Use a persistent left sidebar and a compact top bar. The sidebar should favor operational groupings over database table names.

### Navigation

| Section | Pages / Tabs |
| --- | --- |
| Dashboard | Overview, urgent actions, product metrics, service health |
| Users | user list, profile records, login access, sessions, suspensions, E2EE status |
| Trading Data | broker accounts, imported trades, backtest sessions, backtest trades, sync errors |
| Journal & Routine | journal entries, journal images, journal recaps, check-ins, checklist, routine completions |
| Brain / AI | strategies, analyses, scan config, knowledge sources, graph data, model feedback |
| Community | posts, comments, follows, communities, channels, files, voice presence |
| Chat & Safety | friend requests, global chat, E2EE chat metadata, reports, blocked users |
| Content | library collections, library contents, mission templates, milestones, certificates, quotes |
| News & Calendar | news snapshots, feedback, preferences, provider status, economic calendar diagnostics |
| Notifications | push subscriptions, scheduled calls, broadcast messages, delivery logs |
| Support | tickets, bug reports, user assist view, internal notes, data/privacy requests |
| Finance | plans, trials, subscriptions, invoices, refunds, coupons; add when billing exists |
| System | feature flags, maintenance mode, runtime config, webhooks, provider toggles |
| Security | admin users, roles, permissions, audit logs, admin login history |
| DevOps | health checks, runtime logs, job queues, deploy status, cache controls |

### MVP Navigation

The first production-ready admin should include:

- Dashboard
- Users
- Trading Data
- Community
- Content
- Support
- System
- Security

Journal, Brain, Notifications, News, and DevOps can be added as deeper pages once the main admin shell and RBAC are stable.

## Dashboard

The dashboard is an operations cockpit, not a marketing view. It should use compact KPI cards, status rows, trend charts, and urgent action queues.

### Primary KPI Cards

| KPI | Meaning |
| --- | --- |
| Active users today | Daily product usage |
| New users 24h / 7d | Acquisition trend |
| Broker accounts connected | Core trading integration health |
| Broker sync failures | Operational risk |
| Trades imported today | Data ingestion activity |
| Journal entries today | User engagement quality |
| Backtests completed today | Strategy workflow usage |
| Open reports / tickets | Required human intervention |
| API error rate | Platform health |
| News freshness | Macro news reliability |

### Charts

- Active users over 7 / 30 days.
- New users by day and signup source, if available.
- Broker sync success versus failure.
- Journal entries and backtests by day.
- Community content volume and moderation volume.
- API errors by route/service.
- Push notification delivery success.

### Urgent Actions

Show a right-side queue with direct links:

- Users with suspicious login activity.
- Broker accounts with repeated sync errors.
- Reported posts, comments, files, or community messages.
- Open support tickets nearing SLA.
- News provider stale or failing.
- Push delivery errors above threshold.
- Admin actions requiring approval.
- System feature flag changes in last 24 hours.

## User Management

Users are the primary admin entity because they connect all other operational surfaces.

### User List Table

Columns:

- Name, email, avatar.
- User ID.
- Account status: active, suspended, banned, deletion pending.
- Plan: free, trial, pro, lifetime; can be hidden until billing exists.
- Created at.
- Last active.
- Last login IP / country if available.
- XP, level, streak.
- Broker connection count.
- Trade count.
- Journal entry count.
- Report count.
- Open ticket count.
- Row actions: open, create ticket, revoke sessions, suspend.

Required filters:

- Text search by email, profile name, user ID.
- Account status.
- Plan.
- Created date range.
- Last active date range.
- Level / XP range.
- Broker connected yes/no.
- Has sync errors yes/no.
- Has open reports yes/no.
- Has open support ticket yes/no.

Required sorting:

- Created date.
- Last active.
- XP / level.
- Trade count.
- Journal count.
- Report count.

### User Detail Page

The user detail page should have a sticky header with identity, status, plan, user ID, risk flags, and safe quick actions.

Tabs:

| Tab | Content |
| --- | --- |
| Overview | profile, settings summary, activity counters, latest events |
| Security | login access, active sessions, IP history, session revoke |
| Trading | broker accounts, imported trades, backtest sessions, sync status |
| Journal | journal entries, images, tags, recaps, routines, check-ins |
| Community | posts, comments, follows, friendships, community memberships |
| Support | tickets, internal notes, bug reports, data/privacy requests |
| Audit | admin actions targeting this user |

Quick actions:

- Create support ticket.
- Add internal note.
- Revoke sessions.
- Suspend account with required reason.
- Reactivate account.
- Force broker sync retry.
- Disconnect broker account; high-risk approval required.
- Export user data.
- Start deletion/anonymization workflow.
- Read-only impersonation; Super Admin only, banner required, audit required.

Do not expose:

- Plaintext E2EE direct chat content.
- Private keys.
- Broker secrets or tokens.
- Full sensitive request payloads without redaction.

## Trading Data Operations

### Broker Accounts

Purpose: diagnose connection and sync problems.

Table columns:

- User.
- Broker profile ID.
- Provider: MT5, FXBlue, SnapTrade, cTrader, demo, local companion.
- Account status.
- Last sync time.
- Last sync result.
- Error count.
- Connected at.
- Actions: view diagnostics, retry sync, disable provider for user, disconnect.

Detail view:

- Provider metadata.
- Sync timeline.
- Last error stack or sanitized reason.
- Account equity curve if available.
- Recent imported trades.
- Vault/secrets status only, never raw secrets.
- Audit events.

### Imported Trades

Table columns:

- User.
- Broker account.
- Ticket.
- Source.
- Symbol.
- Direction.
- Volume.
- Open/close time.
- PnL.
- Status.
- Linked journal entry.

Filters:

- User.
- Broker provider.
- Symbol.
- Direction.
- Status.
- Date range.
- PnL range.
- Has linked journal yes/no.

Admin actions should be conservative:

- View.
- Link/unlink journal entry with audit.
- Reprocess import.
- Mark duplicate or ignored.
- Avoid editing financial fields directly unless there is a controlled correction workflow.

## Content Management

Content pages should be optimized for publishing workflows.

### Library Collections

Fields:

- Title.
- Description.
- Cover image.
- Category.
- Required level.
- Order.
- Published status.

Actions:

- Create draft.
- Preview.
- Publish/unpublish.
- Reorder.
- Archive.

### Library Contents

Fields:

- Collection.
- Type: document, file, video/embed, mindmap.
- Title.
- Description.
- Markdown body.
- File/embed URL.
- Tags.
- Required level.
- Order.
- Published status.

### Missions, Milestones, Quotes

Use simple CRUD with:

- Draft/published state where user-facing.
- Preview.
- Bulk reorder.
- Audit on all publish/delete actions.

## Community & Safety

### Moderation Queue

A single queue should aggregate:

- Reported posts.
- Reported comments.
- Reported community messages.
- Reported files.
- Suspicious global chat messages.
- Communities requiring review.

Queue fields:

- Content type.
- Reporter.
- Author.
- Reason.
- Severity.
- Created at.
- Current status.
- Assigned moderator.

Actions:

- Dismiss report.
- Remove content.
- Hide content pending review.
- Warn user.
- Suspend user.
- Escalate to admin.

Moderators should see enough context to make decisions, but not sensitive trading data.

## Support

Support should be tied tightly to user detail pages.

### Tickets

Fields:

- Ticket ID.
- User.
- Category: login, broker sync, journal, billing, community, bug, data/privacy.
- Priority.
- Status: open, pending user, pending internal, resolved, archived.
- Assignee.
- SLA due time.
- Created at.
- Last activity.

Ticket detail:

- User summary.
- Conversation.
- Internal notes.
- Attachments/screenshots.
- Linked error events.
- Linked broker sync events.
- Linked audit events.
- Resolution reason.

### Bug Reports

Ingest from app/client reporter when possible:

- User ID.
- Screen/route.
- App version.
- Device/browser.
- Error fingerprint.
- Stack trace, sanitized.
- Steps supplied by user.
- Screenshot/attachment.
- Status: new, confirmed, in progress, fixed, released.

## System Settings

System settings must be runtime-safe, audited, and reversible.

### Feature Flags

Flags:

- Maintenance mode.
- Registration open/closed/invite only.
- Broker bridge global enable.
- Provider toggles: MT5, FXBlue, SnapTrade, cTrader, demo.
- News hub enable.
- AI Brain scan enable.
- Push notifications enable.
- Community posting enable.
- File uploads enable.
- Global chat enable.
- Broadcast messaging enable.

Each flag change requires:

- Reason.
- Actor.
- Before/after values.
- Optional expiration time.
- Audit event.

High-risk flags should support approval or at least a confirmation dialog.

### Maintenance Mode

Fields:

- Enabled.
- Public message.
- Start time.
- Estimated end time.
- Allowlisted admin/user IDs.
- Disable writes only versus full maintenance.

## RBAC

Permissions should be capability-based internally, even if the UI presents roles.

### Roles

| Role | Allowed |
| --- | --- |
| Super Admin | all permissions, role management, feature flags, irreversible actions |
| Admin Operator | user operations, content operations, support, moderation, diagnostics |
| Support Agent | user read, tickets, notes, session revoke, safe broker diagnostics |
| Moderator | moderation queue, posts, comments, community/files safety |
| Content Manager | library, missions, milestones, quotes |
| Finance Operator | billing, subscriptions, refunds; when billing exists |
| Developer/Ops | health, logs, jobs, feature flags technical; no private content by default |
| Read-only Auditor | audit logs and metrics only |

### Permission Examples

- `users.read`
- `users.suspend`
- `users.revoke_sessions`
- `users.export_data`
- `users.delete_data`
- `support.write`
- `moderation.resolve`
- `content.publish`
- `trading.read`
- `trading.retry_sync`
- `trading.disconnect_account`
- `system.feature_flags.write`
- `security.audit.read`
- `security.roles.write`

## Audit Logs

Audit logs must be append-only from the admin point of view.

Required fields:

- ID.
- Timestamp.
- Actor admin ID.
- Actor role.
- Target type.
- Target ID.
- Action.
- Reason.
- Before snapshot, redacted.
- After snapshot, redacted.
- IP address.
- User agent.
- Request ID / trace ID.

Events to capture:

- Admin login/logout/failure.
- Viewing sensitive user detail pages.
- Read-only impersonation.
- Ban, suspend, reactivate.
- Session revoke.
- User data export.
- User data deletion/anonymization.
- Role or permission changes.
- Feature flag changes.
- Maintenance mode changes.
- Content publish/unpublish/delete.
- Moderation decisions.
- Broker sync retry/disconnect.
- Runtime config changes.

## Interaction Design Rules

- Use dense tables with saved filters and column visibility.
- Use tabs for detail pages to avoid long scrolling.
- Destructive actions require explicit confirmation and a reason.
- High-risk actions must show the target user/content clearly in the dialog.
- Long-running actions show progress and final result.
- Every table has empty, loading, error, and permission-denied states.
- Every page should deep-link to a filtered view where possible.
- Use semantic status colors with text labels, not color alone.
- Support keyboard navigation and visible focus states.

## Suggested Technical Approach

Recommended stack for a custom admin:

- React.
- shadcn/ui or the existing component system.
- TanStack Table for data grids.
- React Query or equivalent for server state.
- Dedicated admin API routes, not direct client access to normal user APIs.
- Server-side RBAC checks on every admin endpoint.
- Audit middleware for all admin mutations and sensitive reads.

Alternatives:

- Retool: fastest internal MVP, lower custom UX and RBAC control.
- Strapi: useful for content-heavy workflows, not ideal as the main operational admin.

Recommendation: build a custom lightweight React admin because TraderLoadings needs integrated security, broker diagnostics, moderation, audit logging, and feature flags.

## MVP User Stories

1. As a Super Admin, I can view KPI cards, urgent actions, and service health on the dashboard.
2. As a Support Agent, I can search users by email, name, or user ID.
3. As a Support Agent, I can open a user detail page with profile, security, trading, journal, community, support, and audit tabs.
4. As a Support Agent, I can revoke a user's active sessions with a required reason.
5. As an Admin Operator, I can suspend and reactivate a user with audit logging.
6. As a Moderator, I can review reported content and dismiss, remove, warn, or escalate it.
7. As a Content Manager, I can create, edit, preview, publish, and unpublish library content.
8. As an Admin Operator, I can inspect broker sync failures and retry a sync.
9. As a Super Admin, I can toggle maintenance mode with a public message and expiration time.
10. As a Super Admin, I can view audit logs filtered by actor, target, action, and date.

## Non-Goals For MVP

- Full billing operations before a billing provider is integrated.
- Plaintext viewing of E2EE private chats.
- Direct editing of imported financial trade values outside a controlled correction workflow.
- Replacing production observability tools.
- Building a generic CMS that ignores TraderLoadings-specific operations.

## Open Product Decisions

1. Whether the first admin release is owner-only or includes Support Agent and Moderator roles immediately.
2. Whether support tickets live inside TraderLoadings or integrate with an external helpdesk.
3. Whether read-only impersonation is needed in MVP.
4. Whether moderation reports already exist in the app or need a new reporting data model.
5. Whether feature flags should be stored in the database, environment-backed config, or a dedicated flag provider.

## Implementation Sequence

1. Create admin auth gate and RBAC model.
2. Create audit log data model and middleware.
3. Create admin shell with sidebar, top bar, and permission-aware navigation.
4. Build dashboard overview using existing data sources.
5. Build users list and user detail read views.
6. Add safe user actions: session revoke, support note, suspend/reactivate.
7. Add broker diagnostics read view and retry action.
8. Add moderation queue.
9. Add content management for library and mission templates.
10. Add system settings and feature flags.

## Review Checklist

- The navigation maps to TraderLoadings' real product areas.
- User management is treated as the central operational workflow.
- Sensitive data is protected from admin overreach.
- RBAC supports future delegation to support, moderation, content, and ops roles.
- Audit logging covers reads and writes that carry risk.
- The MVP is scoped enough to implement incrementally.
