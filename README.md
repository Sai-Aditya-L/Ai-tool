# NEXUS — Neural EXtended Universal System

> Your AI-powered personal operating system

## Overview

NEXUS is an AI-powered personal operating system that acts as your intelligent digital command center. It combines task management, smart reminders, email intelligence, calendar awareness, file analysis, autonomous agents, and persistent memory into a single unified interface — all powered by Claude and optionally OpenAI.

## Features

### Phase 1 — Core OS
- AI chat with full tool use (Claude & OpenAI switchable)
- Task management with priorities, due dates, subtasks, and tags
- Smart reminders with status tracking
- Rich note-taking with search and pinning
- Persistent memory system with per-user enable/disable
- Daily summaries and dashboard

### Phase 2 — Integrations
- Gmail sync with AI-powered email analysis and action item extraction
- Google Calendar integration (create events, check availability)
- GitHub integration (repo listing, PR/issue overview)
- Email draft creation via AI

### Phase 3 — Agent Command Center
- Deploy named AI agents with specialized roles (Travel, Coding, Calendar, Research, Finance, Communication, Security, Memory, Automation)
- Agentic loop with tool calling (up to 5 iterations)
- Human approval gates for sensitive operations (email drafting, deletions)
- Run history and per-run logs

### Phase 4 — Files & Documents
- File upload with AI-generated summaries
- PDF text extraction (up to 10,000 characters)
- Plain text, Markdown, JSON, and CSV content parsing
- In-chat file analysis tool

### Phase 5 — Notifications & PWA
- Web Push notifications via VAPID
- Progressive Web App with service worker
- Push subscription management

### Phase 6 — Security & Reliability
- Rate limiting on sensitive endpoints (chat, registration, agent runs)
- Per-user AI provider and model selection
- Memory system with user-controlled enable/disable

## Tech Stack

- **Next.js 14** (App Router), TypeScript
- **Prisma ORM** + SQLite (PostgreSQL-ready)
- **NextAuth.js v4** — credentials + Google OAuth
- **Anthropic Claude API** + **OpenAI API** (switchable per user)
- **Google OAuth** — Gmail + Calendar
- **Web Push Notifications** (VAPID)
- **Tailwind CSS** glassmorphism UI
- **PWA** with service worker

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

**Required:**

| Variable | Description |
|---|---|
| `DATABASE_URL` | SQLite (default) or PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Generate with: `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Your app URL (e.g. `http://localhost:3000`) |
| `ANTHROPIC_API_KEY` | Get from https://console.anthropic.com |

**Optional (for integrations):**

| Variable | Description |
|---|---|
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Gmail + Calendar |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub repos + PRs |
| `OPENAI_API_KEY` | Alternative AI provider |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Push notifications |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Client-side push key |

### Database Setup

```bash
npx prisma db push
npx prisma generate
```

### Development

```bash
npm run dev
```

Open http://localhost:3000.

### Production

```bash
npm run build
npm start
```

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

## AI Provider Configuration

Switch between Anthropic and OpenAI in **Settings → Assistant → AI Provider**. Each user can independently choose their preferred provider and model.

- Anthropic: `claude-sonnet-4-6`, `claude-haiku-4-5`, `claude-opus-4-5`, etc.
- OpenAI: `gpt-4o`, `gpt-4o-mini`, `gpt-4-turbo`, etc.

## Deployment

NEXUS runs on any Node.js host: **Vercel**, **Railway**, **Render**, **DigitalOcean App Platform**, or self-hosted.

For PostgreSQL: change `DATABASE_URL` to a PostgreSQL connection string. Prisma handles migrations automatically.

```env
DATABASE_URL="postgresql://user:password@host:5432/nexus"
```

## Architecture

```
app/
  api/
    auth/          — Registration, NextAuth handlers
    agents/        — Agent CRUD and run execution engine
    chat/          — Main AI chat with tool loop
    emails/        — Gmail sync and AI action item parsing
    files/         — File upload with PDF + text extraction
    integrations/  — Google, GitHub OAuth callbacks
    notifications/ — Web Push subscription management
    tasks/         — Task CRUD
    reminders/     — Reminder CRUD
    notes/         — Note CRUD
    memory/        — Memory CRUD
    preferences/   — User preferences
  (pages)/         — App Router pages (dashboard, chat, tasks, etc.)
lib/
  anthropic.ts     — Claude client, system prompt, tool definitions
  ai-provider.ts   — Unified Anthropic/OpenAI abstraction
  google.ts        — Gmail and Calendar helpers
  prisma.ts        — Prisma client singleton
  auth.ts          — NextAuth configuration
  rate-limit.ts    — In-memory rate limiter
prisma/
  schema.prisma    — Full data model
```

## Security Notes

- Never commit `.env` — it is gitignored by default
- All API keys are server-side only and never exposed to the client
- All API routes require authentication via `getServerSession`
- Agent actions use human approval gates for sensitive operations (email drafting, deletions)
- Rate limiting is applied to chat (30 req/min), registration (5 req/min per IP), and agent runs (10 req/min per user)
- Passwords are hashed with bcrypt (12 rounds)
