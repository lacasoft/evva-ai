<p align="center">
  <img src="assets/evva-logo.png" alt="Evva" width="250" />
</p>

<h1 align="center">Evva</h1>

<p align="center">
  <strong>AI-powered personal assistant with real memory and proactive actions.</strong><br/>
  <em>Lives in Telegram and WhatsApp. Remembers everything. Acts before you ask.</em>
</p>

<p align="center">
  <a href="https://github.com/lacasoft/evva-ai/releases"><img src="https://img.shields.io/github/v/release/lacasoft/evva-ai?style=flat-square" alt="Release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D22-green?style=flat-square" alt="Node" />
  <img src="https://img.shields.io/badge/skills-22-purple?style=flat-square" alt="Skills" />
  <img src="https://img.shields.io/badge/tools-42-orange?style=flat-square" alt="Tools" />
  <img src="https://img.shields.io/badge/channels-2-teal?style=flat-square" alt="Channels" />
</p>

<p align="center">
  <a href="README.es.md">Leer en Espanol</a> &middot; <a href="docs/SETUP.md">Setup Guide</a> &middot; <a href="https://github.com/lacasoft/evva-ai/releases">Releases</a>
</p>

<p align="center">
  <strong>Try Evva now — no setup required:</strong> <a href="https://t.me/evva_dev_bot">t.me/evva_dev_bot</a>
</p>

<p align="center">
  <img src="assets/intro.gif" alt="Evva Demo" width="350" />
</p>

---

## Features

| | |
|:--|:--|
| **Brain** Persistent semantic memory | **Bell** Scheduled reminders & proactive messages |
| **Note** Notes, lists & todos | **Person** Contact management |
| **Calendar** Google Calendar integration | **Mail** Gmail read, search & send |
| **Dollar** Personal finance & savings goals | **Mic** Voice note transcription (Groq Whisper) |
| **Camera** Photo & document analysis (Claude Vision) | **Sun** Daily proactive briefing |
| **Globe** Web search (Brave) & news summaries | **Cloud** Weather for any city |
| **Pill** Medication & habit tracking | **Phone** Emergency contacts |
| **Language** Translation & smart dictation | **Music** Spotify integration |
| **Exchange** Live currency conversion | **Birthday** Proactive birthday reminders |
| **Recipe** Recipe suggestions from grocery lists | **WhatsApp** Multi-channel (Telegram + WhatsApp) |

---

## Tech Stack

| Layer | Technology |
|:--|:--|
| Framework | NestJS + TypeScript |
| Bot | grammY |
| LLM | Claude Sonnet (Vercel AI SDK) |
| Embeddings | Voyage AI (voyage-3-lite, 512 dims) |
| Database | PostgreSQL + pgvector |
| Queue | BullMQ + Redis |
| Transcription | Groq (Whisper) |
| Vision | Claude Vision |
| Search | Brave Search API |
| Monorepo | pnpm workspaces |

---

## Architecture

Evva follows a gateway/worker split. The gateway handles all user-facing interactions -- receiving messages, orchestrating the LLM agent loop, and returning responses. Heavy or scheduled work (reminders, fact extraction, daily briefings) is offloaded to an async worker via BullMQ, keeping the bot responsive at all times.

```
Telegram / WhatsApp
        |
        v
+-----------------------------------+
|  Gateway (NestJS)                 |
|                                   |
|  TelegramModule    -- receives messages, sends replies
|  ConversationModule -- orchestrates the agent loop
|  MemoryModule      -- RAG over user facts
|  PersonaModule     -- dynamic system prompt
|  ToolsModule       -- web_search, reminders, etc.
|  SchedulerModule   -- enqueues jobs via BullMQ
|  UsersModule       -- user and assistant CRUD
+-----------------------------------+
        | BullMQ (Redis)
        v
+-----------------------------------+
|  Worker (NestJS)                  |
|                                   |
|  ScheduledJobProcessor   -- executes reminders
|  FactExtractionProcessor -- extracts facts from conversations
|  DailyBriefingProcessor  -- sends daily morning summaries
+-----------------------------------+
        |
        v
+-----------------------------------+
|  PostgreSQL + pgvector            |
|                                   |
|  users, assistant_config,         |
|  messages, memory_facts,          |
|  onboarding_state                 |
+-----------------------------------+
```

---

## Quick Start

For detailed step-by-step instructions, see [`docs/SETUP.md`](docs/SETUP.md).

**Prerequisites:** Node.js >= 22, pnpm >= 9, PostgreSQL with pgvector, Redis.

### Option A -- Docker Compose (recommended)

```bash
git clone https://github.com/lacasoft/evva-ai.git
cd evva-ai
cp .env.example .env
# Edit .env with your credentials (see .env.example for all variables)

docker compose up
```

PostgreSQL, Redis, migrations, gateway, and worker all start automatically.

<details>
<summary><strong>Option B -- Manual setup</strong></summary>

```bash
git clone https://github.com/lacasoft/evva-ai.git
cd evva-ai
pnpm install
cp .env.example .env
# Edit .env with your credentials

pnpm db:migrate

# Terminal 1 -- Gateway (Telegram bot)
pnpm dev:gateway

# Terminal 2 -- Worker (BullMQ processors)
pnpm dev:worker
```

The bot starts in **long polling** mode -- no webhook setup required for local development.

</details>

---

## Project Structure

```
evva/
├── apps/
│   ├── gateway/                 # Main app -- Telegram bot + API
│   │   └── src/
│   │       ├── telegram/             # Telegram message handler
│   │       ├── conversation/         # Agent loop + onboarding
│   │       ├── memory/              # Fact search and storage
│   │       ├── persona/             # System prompt construction
│   │       ├── tools/               # Tools available to the LLM
│   │       ├── scheduler/           # BullMQ job scheduling
│   │       ├── users/               # User and assistant CRUD
│   │       ├── health/              # Health check endpoints
│   │       └── config/              # Env var validation
│   │
│   └── worker/                  # BullMQ worker -- async jobs
│       └── src/
│           ├── processors/           # ScheduledJob + FactExtraction
│           └── handlers/             # TelegramSender
│
├── packages/
│   ├── core/                    # Shared types, constants, and utils
│   ├── database/                # PostgreSQL client (pg) and repositories
│   ├── ai/                      # LLM (Claude), embeddings (Voyage), prompts
│   └── skills/                  # Modular skill plugins (22 skills)
│       └── src/
│           ├── registry.ts           # Central skill registry
│           ├── base-skill.ts         # SkillDefinition interface
│           ├── memory/               # Persistent semantic memory
│           ├── notes/                # Notes and lists
│           ├── contacts/             # Contact management
│           ├── reminders/            # Scheduled reminders
│           ├── finance/              # Cards, transactions, savings
│           ├── health/               # Medication and habit tracking
│           ├── emergency/            # Emergency contacts
│           ├── calendar/             # Google Calendar
│           ├── gmail/                # Gmail (read, search, send)
│           ├── weather/              # Weather lookup
│           ├── search/               # Web search (Brave)
│           ├── news/                 # News summary
│           ├── translator/           # Language translation
│           ├── exchange/             # Currency exchange rates
│           ├── dictation/            # Smart message drafting
│           ├── briefing/             # Daily proactive briefing
│           ├── birthdays/            # Birthday reminders
│           ├── recipes/              # Recipe suggestions
│           ├── voice/                # Voice note transcription
│           ├── vision/               # Photo and document analysis
│           └── spotify/              # Spotify integration
│
└── docs/                        # Setup guides and documentation
```

<details>
<summary><strong>Adding a New Skill</strong></summary>

Each skill is a self-contained module. To add a new one:

```typescript
// packages/skills/src/my-skill/index.ts
import { tool } from 'ai';
import { z } from 'zod';
import type { SkillDefinition } from '../base-skill.js';

export const mySkill: SkillDefinition = {
  name: 'my-skill',
  description: 'What this skill does',
  category: 'utility',
  forProfiles: ['young', 'adult', 'senior'],
  requiredEnv: ['MY_API_KEY'],  // optional

  buildTools: (ctx) => ({
    my_tool: tool({
      description: 'Tool description for the LLM',
      parameters: z.object({ input: z.string() }),
      execute: async ({ input }) => {
        return { success: true, result: input };
      },
    }),
  }),

  promptInstructions: [
    '- my_tool: Description of what this tool does',
  ],
};
```

Then register it in `packages/skills/src/index.ts`:

```typescript
export { mySkill } from './my-skill/index.js';
import { mySkill } from './my-skill/index.js';
skillRegistry.register(mySkill);
```

The skill is automatically available to the LLM. No other files need to change.

</details>

---

## How it Works

### Message Flow

1. User sends a message in Telegram or WhatsApp.
2. `TelegramService` receives the message and upserts the user in PostgreSQL.
3. If the user is new, the onboarding flow starts (choose assistant name).
4. For existing users: semantic search retrieves relevant facts (Voyage + pgvector), a dynamic system prompt is constructed, recent history is loaded, and Claude is called with all available tools.
5. If the LLM invokes a tool, it is executed and the result is fed back.
6. The final response is sent to the user. The message is persisted, and fact extraction is enqueued in BullMQ (async).

### Proactive Flow (Reminders)

1. User says "remind me to X on Friday at 8am".
2. Claude calls the `create_reminder` tool.
3. `SchedulerService` creates a BullMQ job with the calculated delay.
4. At the scheduled time, `ScheduledJobProcessor` generates a personalized message with Claude and delivers it to the user.

---

## Available Tools

### Productivity

| Tool | Description | Requires |
|:--|:--|:--|
| `save_fact` | Persist a permanent fact about the user | -- |
| `create_note` | Create notes or lists | -- |
| `get_notes` | View active notes and lists | -- |
| `update_note` | Modify, check items, archive or delete notes | -- |
| `save_contact` | Store a contact (name, phone, email, relationship) | -- |
| `search_contacts` | Search contacts by name or relationship | -- |
| `create_reminder` | Schedule a future reminder | Redis |
| `configure_daily_briefing` | Enable/disable daily morning summary | -- |

### Finance

| Tool | Description | Requires |
|:--|:--|:--|
| `add_credit_card` | Register a credit card with cut-off and payment dates | -- |
| `get_credit_cards` | View registered cards with balances | -- |
| `record_transaction` | Log income or expense | -- |
| `get_finance_summary` | Monthly financial summary by category | -- |
| `get_recent_transactions` | View recent transactions | -- |
| `create_savings_goal` | Create a savings goal with target amount | -- |
| `get_savings_goals` | View savings progress | -- |

### Communication

| Tool | Description | Requires |
|:--|:--|:--|
| `connect_google` | Generate Google OAuth link (Calendar + Gmail) | Google OAuth |
| `list_calendar_events` | List upcoming calendar events | Google OAuth |
| `create_calendar_event` | Create a new calendar event | Google OAuth |
| `list_emails` | List recent emails | Google OAuth |
| `read_email` | Read full email content | Google OAuth |
| `send_email` | Send an email from user's Gmail | Google OAuth |

### Health

| Tool | Description | Requires |
|:--|:--|:--|
| `add_medication` | Register a medication with schedule | -- |
| `get_medications` | View active medications | -- |
| `create_habit` | Create a habit to track daily | -- |
| `log_habit` | Log progress on a habit | -- |
| `get_habit_progress` | View today's habit completion | -- |
| `add_emergency_contact` | Register an emergency contact | -- |
| `get_emergency_contacts` | View emergency contacts | -- |

### Utility

| Tool | Description | Requires |
|:--|:--|:--|
| `web_search` | Up-to-date web search | `BRAVE_SEARCH_API_KEY` |
| `summarize_news` | Search and summarize current news | `BRAVE_SEARCH_API_KEY` |
| `get_weather` | Current weather for a city | -- |
| `translate` | Translate text between languages | -- |
| `calculate_exchange_rate` | Live currency conversion | -- |
| `draft_message` | Generate formal/informal messages | -- |

---

## Token Optimization

Evva is designed to minimize LLM token consumption per message:

| Optimization | Before | After | Savings |
|:--|:--|:--|:--|
| Conversation history window | 12 messages | 6 messages | ~480 tokens |
| maxSteps (tool call rounds) | 3 | 2 | ~5,400 tokens |
| System prompt (behavioral block) | 225 tokens | 80 tokens | ~145 tokens |
| OAuth skill filtering | All 42 tools always loaded | Only connected tools loaded | ~2,000 tokens |
| Provider query | 2 DB calls per message | 1 cached call (Redis 5min TTL) | Latency |
| Skill registry | env check on every call | Cached after first call | CPU |

**Estimated total reduction: ~55% (from ~23K to ~10K tokens per message)**

```
Before:  [system ~1,400] + [42 tools ~3,000] + [history ~960] x 3 steps = ~23,000 tokens
After:   [system ~1,200] + [~20 tools ~1,500] + [history ~480] x 2 steps = ~10,000 tokens
```

---

## Configuration

### Required Environment Variables

| Variable | Where to get it |
|:--|:--|
| `TELEGRAM_BOT_TOKEN` | [@BotFather](https://t.me/BotFather) on Telegram |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `VOYAGE_API_KEY` | [dash.voyageai.com](https://dash.voyageai.com) |
| `DATABASE_URL` | `postgresql://localhost:5432/evva` for local dev |
| `REDIS_URL` | `redis://localhost:6379` for local dev |

### Optional Environment Variables

| Variable | Purpose |
|:--|:--|
| `BRAVE_SEARCH_API_KEY` | Web search tool ([brave.com/search/api](https://brave.com/search/api/)) |
| `GROQ_API_KEY` | Voice note transcription via Whisper |
| `GOOGLE_CLIENT_ID` | Google Calendar and Gmail integration |
| `GOOGLE_CLIENT_SECRET` | Google Calendar and Gmail integration |
| `APP_BRAND_NAME` | Custom assistant brand name (default: "Evva") |
| `LLM_MODEL` | Override the default Claude model |
| `TELEGRAM_WEBHOOK_URL` | Production only |
| `TELEGRAM_SECRET_TOKEN` | Production only -- generate with `openssl rand -hex 32` |

---

## Development

```bash
pnpm build              # Build all packages and apps
pnpm build:gateway      # Build gateway only
pnpm build:worker       # Build worker only

pnpm test               # Run all tests
pnpm test:watch         # Run tests in watch mode
pnpm test:cov           # Run tests with coverage

pnpm lint               # Lint all packages
pnpm lint:fix           # Lint and auto-fix

pnpm db:migrate         # Run pending migrations
pnpm db:migrate:new     # Create a new migration file
```

### Telegram Commands

| Command | Action |
|:--|:--|
| `/start` | Welcome message and onboarding |
| `/reset` | Start a new conversation session |
| `/memory` | Show what the assistant remembers |
| `/help` | List available commands |

---

## Contributing

Contributions are welcome! Fork the repo, create a feature branch, and open a pull request. Please ensure all tests pass (`pnpm test`) and linting is clean (`pnpm lint`) before submitting. For bugs and feature requests, open an issue.

---

## License

[MIT](LICENSE)

---

<p align="center">
  Made by <a href="https://laca-soft.com">LACA-SOFT</a> · <a href="https://github.com/lacasoft">GitHub</a>
</p>
