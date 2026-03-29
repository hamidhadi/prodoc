# Project: Live Product Canvas

## The Problem

In software companies, Engineering Managers, PMs, designers, and analytics engineers all work on the same product but have no shared map. Everyone maintains their own view across different tools — Jira, Figma, Notion, PostHog, GitHub. Coordination is expensive and context is constantly lost:

- Designs change after specs are written
- Analytics events are missing at ship
- Engineers build to old acceptance criteria
- Nobody is to blame — there is no live, shared document

The existing tools (Linear, Notion, Confluence, Jira) are task managers and docs that have grown toward strategy. They are not a living representation of the product itself.

## The Solution

A **living documentation layer** that sits above existing tools — not replacing them, but abstracting over them. The canvas pulls from Figma, GitHub, analytics platforms and other tools, and presents a single, always-current view of the product that every discipline can read.

**The core insight:** Documentation doesn't go out of date because someone stops updating it — it goes out of date because updates require manual effort. Remove that effort and documentation stays current by construction.

The primary competitor is **Confluence and Notion**, not Figma or Linear. Those are data sources. The pitch: *"Documentation that doesn't go out of date."*

### Discipline Views

The same underlying data, filtered per role:
- **Engineers** see system architecture and component relationships
- **PMs** see user flows and feature status
- **Designers** see design states and Figma links in context
- **Analytics engineers** see instrumentation coverage and metrics

## Ideal Customer

Engineering Manager or VP Product at a software company with 30–500 people. Multiple tools already in use. Someone is manually maintaining a "source of truth" doc that's always out of date. Pain trigger: *"We had a misalignment between engineering and design again"* or *"We spent 30 minutes figuring out what state the feature was in."*

## Competitive Landscape

| Competitor | Why they don't solve it |
|---|---|
| Confluence / Notion | Doc tools. Accurate on day one, stale by week two. No live sync. Manual upkeep required. |
| Linear | Issue tracker. Figma integration is passive — static snapshot. No analytics layer. |
| Figma | Data source for us. Prototype mode is design-only, not cross-discipline. |
| PostHog | Strong on analytics but not a shared product map. |

**Key differentiator:** Every DIY attempt (Slack bots, Google Sheets, Notion docs) fails because it requires manual upkeep. The sync layer removes that failure mode entirely.

## Architecture

### Canonical Data Model (Platform-Agnostic)

The core model has zero knowledge of any external tool. Tools map into it via adapters.

```
Canvas         — a product area or feature being documented
Node           — any entity: SCREEN | COMPONENT | STATE
Connection     — a relationship between two nodes (with trigger + label)
NodeSource     — the bridge between a Node and its external origin
```

`NodeSource` stores the adapter name (`figma`, `github`, `storybook`...) and the external ID. The canvas and connection model never reference tool-specific concepts.

### Adapter Contract

Every integration implements the same interface:
```
fetchNodes(source)    → Node[]
fetchThumbnail(node)  → url
mapToNode(raw)        → Node     // e.g. Figma FRAME → SCREEN
mapFromNode(node)     → raw      // reverse, for future write-back
```

### Sync Strategy

- **GitHub:** webhooks — true real-time
- **Figma:** polling / manual sync button (Figma webhooks don't fire on design changes)
- **PostHog:** polling only
- Architecture uses a durable event queue so polling and webhooks are handled identically downstream

## First Integration: Figma

Figma is the first adapter because:
1. Screens are visual — the canvas is immediately compelling
2. User flows are the artifact most often missing or stale
3. The connections drawn between components are the first native data owned by this product

### How Figma Sync Works

1. Fetch file tree → extract top-level frames as `SCREEN` nodes
2. Fetch rendered thumbnails via Figma Images API
3. Fetch node tree with bounding boxes for each frame
4. Overlay invisible hit areas on rendered thumbnails — makes individual components clickable
5. User draws connections between any node (button → screen, screen → modal, component → state)

Figma component variants (Button/Default, Button/Hover) map to `STATE` nodes.

## Build Sequence

### Phase 1 — Foundation
- Next.js 15, TypeScript, Tailwind
- Supabase (Postgres + Auth)
- Prisma schema: `Canvas`, `Node`, `Connection`, `NodeSource`
- Auth: sign up / login / workspace

**Milestone:** Authenticated user can create a named canvas.

### Phase 2 — Canvas Engine
- React Flow integration
- Render, create, and move nodes
- Draw and persist connections
- Load canvas state on refresh

**Milestone:** Working canvas with persistent nodes and connections. No Figma yet.

### Phase 3 — Figma Adapter
- Figma OAuth
- File picker
- Frame extraction → Node + NodeSource records
- Thumbnail rendering on canvas
- Node tree overlay for component-level connections
- Sync button

**Milestone:** User sees real Figma screens on the canvas and can draw connections between components.

### Phase 4 — User Flows
- Connection trigger types (tap, hover, submit, error)
- Flow path visualization
- Read-only shareable canvas link

**Milestone:** A PM can share a living user flow diagram sourced from real Figma screens.

### Not Yet
- GitHub, Linear, PostHog adapters
- Bidirectional sync (write back to tools)
- Discipline-specific views
- Real-time collaboration

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router) |
| Database | Supabase (Postgres + Auth) |
| ORM | Prisma |
| Canvas | React Flow |
| Styling | Tailwind + shadcn/ui |
| Figma | Figma REST API + OAuth |
| AI (future) | Claude API (claude-sonnet-4-6) |

## Principles

- Validate before over-engineering — customer discovery is still ongoing
- Build the smallest thing that demonstrates the core value at each phase
- The canonical data model must stay platform-agnostic — tools are adapters, not first-class citizens
- Write tests for anything that touches the sync logic — that is the critical path
- Prefer fast iteration over premature abstraction
