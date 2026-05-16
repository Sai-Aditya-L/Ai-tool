# NEXUS — Neural EXtended Universal System

> Your AI-powered personal operating system — a futuristic holographic command center for your entire digital life.

## Overview

NEXUS is a next-generation AI personal operating system that unifies every aspect of your digital life into a single, intelligent command center. Powered by Claude (Anthropic) and optionally OpenAI, it goes far beyond a simple chatbot — NEXUS understands context, orchestrates autonomous agents, manages your time, communicates on your behalf, monitors your systems, and proactively surfaces what matters before you even ask.

Built on Next.js 14 App Router with a glassmorphic futuristic UI, NEXUS ships with 25 phases of features spanning AI intelligence, productivity, research, security, communications, development tooling, life management, and infrastructure monitoring. It is designed to run as a PWA on any device, integrate with your existing tools (Google, GitHub, Home Assistant, and more), and extend infinitely via a plugin and webhook SDK.

Whether you are a developer, researcher, executive, or power user, NEXUS acts as your tireless AI co-pilot — orchestrating multi-agent swarms, predicting scheduling conflicts, analyzing documents, reviewing code, managing smart home devices, and summarizing your world every morning and evening.

## Features — 25 Phases

### Core Intelligence
- **AI Chat** — Streaming conversations with Claude, full tool calling, file analysis, and model switching per message
- **Multi-Agent Orchestration** — Deploy named agents (Atlas, Chronos, Forge, Sentinel, Oracle, and more) in parallel with shared memory
- **Master Orchestrator** — Auto-detects complex requests and deploys the right combination of agents automatically
- **Swarm Mode** — Run multiple agents simultaneously on large research tasks, merging results into a unified report
- **Long-term Memory** — User-controlled persistent memory with category management, search, and per-entry control
- **Knowledge Graph** — Visual relationship map connecting tasks, notes, events, files, and entities with auto-generation

### Productivity
- **Tasks** — Full task management with subtasks, priorities, due dates, tags, and bulk operations
- **Reminders** — Smart reminders with categories, scheduling, and completion tracking
- **Calendar** — Google Calendar integration with conflict detection, event creation, and availability queries
- **Notes** — Rich notes with tags, pinning, AI summaries, and full-text search
- **Goals** — Long-term goal tracking with milestones, progress visualization, and deadline management
- **Habits** — Habit streaks with daily tracking, completion history, and encouragement
- **Daily Briefings** — AI-generated morning and evening summaries with context from tasks, calendar, and email

### Intelligence & Research
- **Proactive Alerts** — AI-powered conflict detection, overdue task warnings, follow-up nudges, and priority escalations
- **Simulation Engine** — "Can I finish by Friday?" — predictive planning with world-state context awareness
- **Research Workspace** — Web search via DuckDuckGo, Wikipedia integration, document analysis, and source citations
- **Visual Intelligence** — Image analysis, OCR, security scan, diagram analysis, and screenshot interpretation via Claude Vision
- **Knowledge Graph** — Auto-generated entity relationship visualization with interactive exploration

### Communications
- **Email Assistant** — Gmail integration: summarize inbox, draft replies, extract action items, and track follow-ups
- **Voice Center** — Push-to-talk recording, speech-to-text transcription, text-to-speech playback, and wake-word ready architecture

### Development
- **Dev Workspace** — Code review, PR summaries, commit message generation, documentation generation, and refactoring suggestions
- **GitHub Integration** — Repository browser, file viewer, code search, PR review, and issue management
- **Security Review** — Sentinel-powered vulnerability scanning with OWASP and CVE awareness
- **Test Generator** — AI-generated test suites for any code file or function
- **Stack Trace Analyzer** — Root cause analysis and fix suggestions for errors and exceptions

### Security & Compliance
- **Cybersecurity Workspace** — Risk register, threat models (STRIDE), ISO 27001, SOC 2, and NIST CSF compliance tracking
- **Trust Center** — Permission dashboard, emergency stop, data export, audit logs, and connected service management
- **Computer Control** — Browser automation with 5 safety modes (Observation / Approval / Assisted / Autonomous / Sandbox)

### Life Management
- **Trackers** — Bills, subscriptions, packages, warranties, and job applications with status tracking
- **Travel** — Trip planning, packing lists, real-time weather via Open-Meteo, and budget tracking
- **Home Control** — Home Assistant integration for smart home devices, scenes, and automations
- **Market** — Real-time crypto and market data via CoinGecko
- **News Feed** — Personalized news aggregation from configurable RSS and API sources

### System & Infrastructure
- **Automations** — Trigger-based workflows with scheduling, condition chaining, and AI-assisted generation
- **System Monitor** — Real-time CPU, memory, and uptime charts with configurable alert thresholds
- **Observability** — Application health dashboard, integration status, activity timeline, and full data export
- **AI Usage** — Token tracking per model, cost estimates, model router configuration, and budget limits
- **Model Router** — Automatically routes tasks to optimal models (Haiku for simple queries, Sonnet for complex reasoning)

### Extension & Collaboration
- **Plugins & SDK** — Custom tool plugins, webhooks, API key generation (`nxs_...`), and agent templates
- **Shared Workspaces** — Invite-based collaboration with role permissions (Owner / Editor / Viewer / Guest)
- **Workflow Templates** — Reusable automation templates with parameter substitution and sharing

### Mobile & Devices
- **Mobile & PWA** — Install as a native app on iOS and Android, offline-ready service worker, keyboard shortcut reference
- **Push Notifications** — Web Push via VAPID with per-category subscription management

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router), TypeScript |
| Database | Prisma ORM + SQLite (PostgreSQL-ready) |
| Auth | NextAuth.js v4 — credentials + Google OAuth |
| AI | Anthropic Claude API + OpenAI API (switchable per user) |
| Edge Security | Next.js Middleware with JWT validation |
| Styling | Tailwind CSS with glassmorphism design system |
| Real-time | Server-Sent Events (SSE) for streaming |
| PWA | Service Worker + Web App Manifest |
| Push | Web Push API (VAPID) |
| Integrations | Gmail, Google Calendar, GitHub, Home Assistant, CoinGecko, Open-Meteo, Wikipedia, DuckDuckGo |

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
git clone <repo>
cd Ai-tool
npm install
```

### Environment Setup

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

### Database Setup

```bash
npx prisma db push
npx prisma generate
```

### Development

```bash
npm run dev
```

Open http://localhost:3000 and register an account.

### Production Build

```bash
npm run build
npm start
```

---

## Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | SQLite (`file:./dev.db`) or PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Generate with: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your app URL, e.g. `https://nexus.yourdomain.com` |
| `ANTHROPIC_API_KEY` | Get from https://console.anthropic.com |

### AI Providers

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | Alternative AI provider (GPT-4o, GPT-4o-mini) |

### Google Integration

| Variable | Description |
|----------|-------------|
| `GOOGLE_CLIENT_ID` | OAuth 2.0 client ID for Gmail + Calendar |
| `GOOGLE_CLIENT_SECRET` | OAuth 2.0 client secret |

### GitHub Integration

| Variable | Description |
|----------|-------------|
| `GITHUB_CLIENT_ID` | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth app client secret |

### Push Notifications

| Variable | Description |
|----------|-------------|
| `VAPID_PUBLIC_KEY` | VAPID public key (generate with `npx web-push generate-vapid-keys`) |
| `VAPID_PRIVATE_KEY` | VAPID private key |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Client-side VAPID key (same as public key) |

### Smart Home & Media

| Variable | Description |
|----------|-------------|
| `HOME_ASSISTANT_URL` | Home Assistant instance URL (e.g. `http://homeassistant.local:8123`) |
| `HOME_ASSISTANT_TOKEN` | Long-lived access token from Home Assistant |
| `SPOTIFY_CLIENT_ID` | Spotify API client ID for media control |
| `SPOTIFY_CLIENT_SECRET` | Spotify API client secret |

---

## Google OAuth Setup

1. Go to https://console.cloud.google.com/apis/credentials
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add authorized redirect URIs:
   - `{YOUR_URL}/api/auth/callback/google`
   - `{YOUR_URL}/api/integrations/google/callback`
4. Enable APIs: **Gmail API**, **Google Calendar API**
5. Copy Client ID and Secret to `.env`

## GitHub OAuth Setup

1. Go to https://github.com/settings/developers → **New OAuth App**
2. Homepage URL: `{YOUR_URL}`
3. Callback URL: `{YOUR_URL}/api/integrations/github/callback`
4. Copy Client ID and Secret to `.env`

## Push Notifications Setup

```bash
npx web-push generate-vapid-keys
```

Add both keys to `.env`:

```env
VAPID_PUBLIC_KEY=<public key>
VAPID_PRIVATE_KEY=<private key>
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<public key>
```

---

## Agent System

### Named Agents

| Agent | Role | Specialization |
|-------|------|----------------|
| Atlas | Travel Agent | Trip planning, destinations, logistics, packing |
| Chronos | Calendar Agent | Scheduling, conflict detection, time management |
| Hermes | Communication Agent | Email drafting, message composition, follow-ups |
| Forge | Coding Agent | Code generation, review, debugging, documentation |
| Sentinel | Security Agent | Risk analysis, vulnerability scanning, compliance |
| Ledger | Finance Agent | Budget tracking, expense analysis, market data |
| Oracle | Research Agent | Information gathering, synthesis, source citations |
| Echo | Memory Agent | Context recall, preference management, history |
| Titan | Automation Agent | Workflow design, trigger configuration, execution |
| Vega | File Analysis Agent | Document analysis, visual intelligence, OCR |

### Swarm Mode

Deploy multiple agents simultaneously for complex tasks. The Master Orchestrator analyzes your request, selects the right combination of agents, runs them in parallel, and merges results into a unified, coherent response. Swarm runs are logged with per-agent timing and token usage.

### Human Approval Gates

Sensitive operations — sending emails, deleting data, executing automations — require explicit user confirmation before the agent proceeds. This is enforced at the API level regardless of agent confidence.

---

## Security

NEXUS is built with a defense-in-depth approach:

- **Edge Middleware Authentication** — `middleware.ts` validates JWT tokens on every protected route at the edge layer before any page or API handler runs. Unauthenticated API requests receive `401 Unauthorized`; unauthenticated page visits redirect to `/login` with a `callbackUrl`.
- **Security Headers** — `next.config.js` sets HSTS (2-year max-age with preload), CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, and X-Permitted-Cross-Domain-Policies on every response.
- **Rate Limiting** — In-memory rate limiter (`lib/rate-limit.ts`) enforces per-IP and per-user limits: 30 req/min for chat, 5 req/min for registration, 10 req/min for agent runs.
- **Server-side API Keys** — All AI and integration credentials are server-side only. The client never sees raw API keys.
- **Bcrypt Passwords** — User passwords are hashed with bcrypt (12 rounds).
- **Session Isolation** — Every API route validates the session and scopes all database queries to the authenticated user's ID — no cross-user data leakage is possible.
- **API Key System** — External integrations authenticate via `nxs_...` prefixed API keys stored as bcrypt hashes. Keys are shown only once on generation.
- **Trust Center** — Users can audit all connected services, revoke OAuth tokens, download a full data export (GDPR-ready), and trigger an emergency stop that disables all automations.
- **Human Approval Gates** — Destructive or communication-sending agent actions require explicit confirmation.

---

## AI Provider Configuration

Switch between Anthropic and OpenAI in **Settings → Assistant → AI Provider**. Each user independently chooses their preferred provider and model.

**Anthropic models:** `claude-sonnet-4-6`, `claude-haiku-4-5`, `claude-opus-4-5`

**OpenAI models:** `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`

The **Model Router** automatically selects the optimal model based on task complexity — lightweight queries use Haiku/mini for speed and cost; complex reasoning, code review, and multi-step tasks use Sonnet/GPT-4o.

---

## Deployment

NEXUS runs on any Node.js host: **Vercel**, **Railway**, **Render**, **DigitalOcean App Platform**, or self-hosted.

### PostgreSQL

For production, switch from SQLite to PostgreSQL by updating `DATABASE_URL`:

```env
DATABASE_URL="postgresql://user:password@host:5432/nexus"
```

Then run:

```bash
npx prisma migrate deploy
```

### Vercel

```bash
vercel deploy
```

Set all environment variables in the Vercel dashboard. Ensure `NEXTAUTH_URL` is set to your production URL — this is required for NextAuth and for the server actions `allowedOrigins` configuration.

### Docker (self-hosted)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY . .
RUN npm ci && npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## Architecture

```
middleware.ts            — Edge JWT auth guard for all protected routes
next.config.js           — Security headers, CSP, server actions config
app/
  api/
    auth/                — Registration, NextAuth handlers
    agents/              — Agent CRUD and run execution engine (agentic loop)
    chat/                — Main AI chat with streaming + tool loop
    emails/              — Gmail sync and AI action item parsing
    files/               — File upload with PDF + text extraction
    integrations/        — Google, GitHub OAuth callbacks
    notifications/       — Web Push subscription management
    tasks/               — Task CRUD with subtask support
    reminders/           — Reminder CRUD with scheduling
    notes/               — Note CRUD with tagging and pinning
    memory/              — Memory CRUD with category management
    goals/               — Goal and milestone tracking
    habits/              — Habit streak management
    automations/         — Trigger-based workflow engine
    simulate/            — Predictive planning simulation
    visual/              — Claude Vision image analysis
    knowledge-graph/     — Auto-generated entity relationship data
    usage/               — Token tracking and cost estimation
    trust-center/        — Permissions, data export, emergency stop
    api-keys/            — API key generation and management
    webhooks/            — Inbound webhook processing
    workspaces/          — Shared workspace collaboration
    world-state/         — User world state snapshot
    system-health/       — Application health check endpoint
    export/              — Full user data export (GDPR)
  (pages)/               — App Router pages (dashboard, chat, tasks, etc.)
lib/
  anthropic.ts           — Claude client, system prompt, tool definitions
  ai-provider.ts         — Unified Anthropic/OpenAI abstraction
  google.ts              — Gmail and Calendar helpers
  prisma.ts              — Prisma client singleton
  auth.ts                — NextAuth configuration
  rate-limit.ts          — In-memory rate limiter
prisma/
  schema.prisma          — Full data model (User, Task, Note, Agent, Memory, ...)
public/
  sw.js                  — Service worker for PWA offline support
  manifest.json          — Web App Manifest
```

---

## API Reference

### Authentication

All protected API routes require authentication via:
- **Session cookie** — Set automatically by NextAuth on login
- **API key header** — `Authorization: Bearer nxs_...` for external integrations

Unauthenticated requests to `/api/*` protected routes return:
```json
{ "error": "Unauthorized" }
```
with HTTP status `401`.

### Key Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/chat` | AI chat with streaming and tool calling |
| `POST` | `/api/agents/orchestrate` | Deploy multi-agent swarm with auto-selection |
| `GET` | `/api/world-state` | Current user world state snapshot |
| `POST` | `/api/simulate` | Run predictive planning simulation |
| `GET` | `/api/export` | Export all user data as JSON (GDPR) |
| `POST` | `/api/visual` | Image analysis with Claude Vision |
| `GET` | `/api/system-health` | Application health check |
| `GET` | `/api/usage` | AI token usage statistics and cost estimates |
| `GET` | `/api/tasks` | List tasks with filtering and pagination |
| `POST` | `/api/tasks` | Create a task |
| `GET` | `/api/notes` | List notes with search and tag filtering |
| `GET` | `/api/memory` | List memory entries with category filter |
| `POST` | `/api/memory` | Add a memory entry |
| `GET` | `/api/knowledge-graph` | Knowledge graph entity and edge data |
| `POST` | `/api/automations/trigger` | Manually trigger an automation |
| `GET` | `/api/trust-center` | Permission and integration audit data |
| `POST` | `/api/api-keys` | Generate a new API key (`nxs_...`) |

### Chat Request Format

```json
{
  "messages": [{ "role": "user", "content": "Summarize my tasks for today" }],
  "model": "claude-sonnet-4-6",
  "stream": true
}
```

### Agent Orchestration Request

```json
{
  "task": "Plan a 3-day trip to Tokyo and add it to my calendar",
  "agents": ["Atlas", "Chronos"],
  "swarm": true
}
```

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feat/your-feature`
3. Commit your changes with conventional commits: `feat:`, `fix:`, `chore:`
4. Open a pull request

---

## License

MIT — see `LICENSE` for details.
