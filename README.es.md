# Evva

Asistente personal con IA, memoria real y acciones proactivas. Vive en Telegram.

> :globe_with_meridians: [Read in English](README.md)

---

## Caracteristicas

- **Memoria semantica persistente** — Recuerda todo lo que le cuentas usando embeddings y busqueda vectorial. Cada dato relevante se almacena como un fact categorizado con nivel de importancia.
- **Recordatorios programados y mensajes proactivos** — Programa recordatorios en lenguaje natural ("recuerdame X el viernes a las 8am") y recibe el mensaje en el momento exacto, redactado por el LLM de forma personalizada.
- **Notas y listas** — Crea, edita, tacha y archiva notas de texto libre o listas con items. Todo persiste entre sesiones.
- **Gestion de contactos** — Guarda nombres, telefonos, emails y relaciones. Busca contactos por nombre o por rol ("mi dentista").
- **Google Calendar** — Consulta tus proximos eventos y crea citas directamente desde la conversacion. Requiere conexion OAuth una sola vez.
- **Gmail** — Lee correos recientes, busca por remitente o asunto, lee el contenido completo y envia correos. Usa la misma conexion OAuth de Google.
- **Finanzas personales** — Registra tarjetas de credito con fechas de corte y pago, lleva control de ingresos y gastos por categoria, consulta resumenes mensuales y crea metas de ahorro con seguimiento de progreso.
- **Notas de voz** — Envia audios y Evva los transcribe usando Whisper via Groq, luego procesa el contenido como cualquier mensaje de texto.
- **Analisis de fotos** — Envia imagenes y Evva las analiza usando Claude Vision para describir, extraer texto o responder preguntas sobre el contenido visual.
- **Resumen diario proactivo** — Activa un briefing matutino y recibe cada dia un mensaje con tus pendientes, eventos del calendario y contexto relevante.
- **Busqueda web** — Consulta informacion actualizada de internet via Brave Search cuando necesites datos recientes, precios o noticias.
- **Clima** — Pregunta el clima de cualquier ciudad y obtiene temperatura, sensacion termica, humedad y viento en tiempo real.
- **Seguimiento de medicamentos** — Registra medicamentos con horarios y dosis. Ideal para adultos mayores.
- **Seguimiento de habitos** — Trackea habitos diarios como agua, ejercicio, meditacion con progreso visible.
- **Contactos de emergencia** — Registra y accede rapidamente a contactos de emergencia.
- **Analisis de documentos** — Envia PDFs o archivos y Evva los analiza con Claude Vision.
- **Ubicacion** — Comparte tu ubicacion y Evva sugiere acciones.
- **Traductor** — Traduce texto entre idiomas directamente en la conversacion.
- **Tipo de cambio** — Conversion de divisas en tiempo real.
- **Dictado inteligente** — Genera mensajes formales o informales a pedido.
- **Resumen de noticias** — Busca y resume noticias actuales.
- **Modelo LLM configurable** — Haiku para desarrollo, Sonnet para produccion.
- **Rebrandeable** — Cambia el nombre del sistema con `APP_BRAND_NAME` en el `.env`.

---

## Arquitectura

```
Telegram
   |
   v
+----------------------------------+
|  Gateway (NestJS)                |
|                                  |
|  TelegramModule                  |  <- recibe mensajes, responde
|  ConversationModule              |  <- orquesta el loop del agente
|  MemoryModule                    |  <- RAG sobre facts del usuario
|  PersonaModule                   |  <- system prompt dinamico
|  ToolsModule                     |  <- web_search, reminders, etc.
|  SchedulerModule                 |  <- encola jobs en BullMQ
|  UsersModule                     |  <- CRUD de usuarios y asistentes
+----------------------------------+
           | BullMQ (Redis)
           v
+----------------------------------+
|  Worker (NestJS)                 |
|                                  |
|  ScheduledJobProcessor           |  <- ejecuta recordatorios
|  FactExtractionProcessor         |  <- extrae facts de conversaciones
+----------------------------------+
           |
           v
+----------------------------------+
|  PostgreSQL + pgvector           |
|                                  |
|  users                           |
|  assistant_config                |
|  messages                        |
|  memory_facts (pgvector)         |
|  onboarding_state                |
+----------------------------------+
```

---

## Stack tecnologico

| Capa | Tecnologia |
|---|---|
| Framework | NestJS + TypeScript |
| Bot de Telegram | grammY |
| LLM | Claude Sonnet (Vercel AI SDK) |
| Embeddings | Voyage AI (voyage-3-lite, 512 dims) |
| Transcripcion de voz | Whisper via Groq |
| Vision | Claude Vision (Anthropic) |
| Base de datos | PostgreSQL + pgvector |
| Cola de tareas | BullMQ + Redis |
| Monorepo | pnpm workspaces |

---

## Inicio rapido

Para instrucciones detalladas paso a paso, consulta [`docs/SETUP.es.md`](docs/SETUP.es.md).

### Prerrequisitos

```bash
node --version   # >= 22.0.0
pnpm --version   # >= 9.0.0
```

PostgreSQL con pgvector y Redis deben estar corriendo localmente.

### Instalacion

### Opcion A — Docker Compose (recomendado)

```bash
git clone https://github.com/lacasoft/evva-ai.git
cd evva-ai
cp .env.example .env
# Edita .env con tus credenciales (ver .env.example para todas las variables)

docker compose up
```

Listo. PostgreSQL, Redis, migraciones, gateway y worker arrancan automaticamente.

### Opcion B — Setup manual

```bash
git clone https://github.com/lacasoft/evva-ai.git
cd evva-ai
pnpm install
cp .env.example .env
# Edita .env con tus credenciales

pnpm db:migrate

# Terminal 1 — Gateway (bot de Telegram)
pnpm dev:gateway

# Terminal 2 — Worker (procesadores de BullMQ)
pnpm dev:worker
```

El bot arranca en modo **long polling** en desarrollo. No necesitas configurar webhooks.

---

## Estructura del proyecto

```
evva/
├── apps/
│   ├── gateway/          # App principal — bot de Telegram + API
│   │   └── src/
│   │       ├── telegram/       # Handler de mensajes de Telegram
│   │       ├── conversation/   # Loop del agente + onboarding
│   │       ├── memory/         # Busqueda y guardado de facts
│   │       ├── persona/        # Construccion de system prompts
│   │       ├── tools/          # Tools disponibles para el LLM
│   │       ├── scheduler/      # Encolado de jobs en BullMQ
│   │       ├── users/          # CRUD de usuarios y asistentes
│   │       ├── health/         # Endpoints de health check
│   │       └── config/         # Validacion de variables de entorno
│   │
│   └── worker/           # Worker de BullMQ — jobs asincronos
│       └── src/
│           ├── processors/     # ScheduledJob + FactExtraction
│           └── handlers/       # TelegramSender
│
└── packages/
    ├── core/             # Tipos, constantes y utils compartidos
    ├── database/         # Cliente PostgreSQL (pg) y repositories
    ├── ai/               # LLM (Claude), embeddings (Voyage), prompts
    └── skills/           # Skills modulares (18 plugins)
        └── src/
            ├── registry.ts        # Registro central de skills
            ├── base-skill.ts      # Interfaz SkillDefinition
            ├── memory/            # Memoria semantica persistente
            ├── notes/             # Notas y listas
            ├── contacts/          # Gestion de contactos
            ├── reminders/         # Recordatorios programados
            ├── finance/           # Finanzas personales
            ├── health/            # Medicamentos y habitos
            ├── emergency/         # Contactos de emergencia
            ├── calendar/          # Google Calendar
            ├── gmail/             # Gmail (leer, buscar, enviar)
            ├── weather/           # Clima
            ├── search/            # Busqueda web (Brave)
            ├── news/              # Resumen de noticias
            ├── translator/        # Traduccion
            ├── exchange/          # Tipo de cambio
            ├── dictation/         # Dictado inteligente
            ├── briefing/          # Resumen diario proactivo
            ├── voice/             # Transcripcion de voz
            └── vision/            # Analisis de fotos y documentos
```

## Agregar un nuevo skill

Cada skill es un modulo independiente. Para agregar uno nuevo:

```typescript
// packages/skills/src/mi-skill/index.ts
import { tool } from 'ai';
import { z } from 'zod';
import type { SkillDefinition } from '../base-skill.js';

export const miSkill: SkillDefinition = {
  name: 'mi-skill',
  description: 'Lo que hace este skill',
  category: 'utility',
  forProfiles: ['young', 'adult', 'senior'],

  buildTools: (ctx) => ({
    mi_tool: tool({
      description: 'Descripcion para el LLM',
      parameters: z.object({ input: z.string() }),
      execute: async ({ input }) => {
        return { success: true, result: input };
      },
    }),
  }),

  promptInstructions: [
    '- mi_tool: Descripcion de lo que hace esta tool',
  ],
};
```

Luego registralo en `packages/skills/src/index.ts`:
```typescript
export { miSkill } from './mi-skill/index.js';
import { miSkill } from './mi-skill/index.js';
skillRegistry.register(miSkill);
```

El skill queda disponible automaticamente para el LLM. No hay que modificar ningun otro archivo.

---

## Como funciona

### Flujo de mensajes

1. El usuario escribe en Telegram.
2. `TelegramService` recibe el mensaje (texto, audio o imagen).
3. Si es audio, se transcribe con Whisper via Groq. Si es imagen, se analiza con Claude Vision.
4. Se verifica si el usuario existe (upsert en PostgreSQL).
5. Si es un usuario nuevo, entra al flujo de onboarding donde elige el nombre del asistente.
6. Si ya esta configurado:
   - Busqueda semantica de facts relevantes (Voyage + pgvector).
   - Construccion del system prompt dinamico con la persona del asistente.
   - Carga del historial reciente (ultimos 12 mensajes).
   - Llamada a Claude con las tools disponibles.
   - Si el LLM invoca tools, se ejecutan y se devuelve el resultado.
   - La respuesta final se envia por Telegram.
   - El mensaje se persiste en PostgreSQL.
   - La extraccion de facts se encola en BullMQ (asincrona).

### Flujo proactivo (recordatorios y resumen diario)

1. El usuario dice "recuerdame X el viernes a las 8am".
2. Claude llama la tool `create_reminder`.
3. `SchedulerService` crea un job en BullMQ con el delay calculado.
4. En el momento exacto, `ScheduledJobProcessor` despierta.
5. Genera el mensaje con Claude (personalizado, no texto plano).
6. `TelegramSenderService` lo entrega al usuario.

El resumen diario funciona de forma similar: un job recurrente revisa pendientes, eventos del calendario y facts relevantes, y envia un mensaje consolidado cada manana.

---

## Tools disponibles

| Tool | Descripcion | Requiere |
|---|---|---|
| `save_fact` | Guarda un hecho permanente del usuario en memoria semantica | -- |
| `create_reminder` | Programa un recordatorio para una fecha y hora futura | Redis |
| `web_search` | Busqueda web actualizada via Brave Search | `BRAVE_SEARCH_API_KEY` |
| `get_weather` | Clima actual de cualquier ciudad | -- (API publica) |
| `create_note` | Crea una nota de texto libre o una lista con items | -- |
| `get_notes` | Muestra las notas y listas activas del usuario | -- |
| `update_note` | Modifica, tacha items, archiva o elimina una nota | -- |
| `save_contact` | Guarda un contacto con nombre, telefono, email y relacion | -- |
| `search_contacts` | Busca contactos por nombre o relacion | -- |
| `add_credit_card` | Registra una tarjeta de credito con fechas de corte y pago | -- |
| `get_credit_cards` | Muestra las tarjetas registradas con saldos | -- |
| `record_transaction` | Registra un ingreso o gasto con categoria y metodo de pago | -- |
| `get_finance_summary` | Resumen financiero del mes: ingresos, gastos y balance | -- |
| `get_recent_transactions` | Lista movimientos recientes con filtros | -- |
| `create_savings_goal` | Crea una meta de ahorro con monto objetivo | -- |
| `get_savings_goals` | Muestra metas de ahorro activas con progreso | -- |
| `connect_google` | Genera link OAuth para conectar Google Calendar y Gmail | OAuth config |
| `list_calendar_events` | Lista proximos eventos del Google Calendar | Google OAuth |
| `create_calendar_event` | Crea un evento en Google Calendar | Google OAuth |
| `list_emails` | Lista correos recientes de Gmail con filtros | Google OAuth |
| `read_email` | Lee el contenido completo de un correo | Google OAuth |
| `send_email` | Envia un correo desde el Gmail del usuario | Google OAuth |
| `add_medication` | Registra un medicamento con horarios | -- |
| `get_medications` | Muestra medicamentos activos | -- |
| `create_habit` | Crea un habito para trackear diariamente | -- |
| `log_habit` | Registra progreso en un habito | -- |
| `get_habit_progress` | Muestra progreso de habitos de hoy | -- |
| `add_emergency_contact` | Registra un contacto de emergencia | -- |
| `get_emergency_contacts` | Muestra contactos de emergencia | -- |
| `configure_daily_briefing` | Activa o configura el resumen diario matutino | Redis |
| `translate` | Traduce texto entre idiomas | -- |
| `calculate_exchange_rate` | Conversion de divisas en tiempo real | -- |
| `draft_message` | Genera mensajes formales o informales | -- |
| `summarize_news` | Busca y resume noticias actuales | `BRAVE_SEARCH_API_KEY` |

---

## Configuracion

### Variables requeridas

| Variable | Descripcion | Donde obtenerla |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Token del bot de Telegram | [@BotFather](https://t.me/BotFather) |
| `ANTHROPIC_API_KEY` | Clave de API de Anthropic (Claude) | [console.anthropic.com](https://console.anthropic.com) |
| `VOYAGE_API_KEY` | Clave de API de Voyage AI (embeddings) | [dash.voyageai.com](https://dash.voyageai.com) |
| `DATABASE_URL` | Conexion a PostgreSQL | `postgresql://localhost:5432/evva` en desarrollo |
| `REDIS_URL` | Conexion a Redis | `redis://localhost:6379` en desarrollo |

### Variables opcionales

| Variable | Descripcion | Donde obtenerla |
|---|---|---|
| `BRAVE_SEARCH_API_KEY` | Busqueda web via Brave | [brave.com/search/api](https://brave.com/search/api/) |
| `GROQ_API_KEY` | Transcripcion de audio con Whisper | [console.groq.com](https://console.groq.com) |
| `GOOGLE_CLIENT_ID` | OAuth para Calendar y Gmail | [console.cloud.google.com](https://console.cloud.google.com) |
| `GOOGLE_CLIENT_SECRET` | OAuth para Calendar y Gmail | Google Cloud Console |
| `GOOGLE_REDIRECT_URI` | Callback URL para OAuth de Google | Configurado en tu proyecto de Google |
| `TELEGRAM_WEBHOOK_URL` | URL del webhook (solo produccion) | Tu dominio de deploy |
| `TELEGRAM_SECRET_TOKEN` | Token secreto para webhooks | `openssl rand -hex 32` |

---

## Desarrollo

### Build completo

```bash
pnpm build
```

### Build por aplicacion

```bash
pnpm build:gateway
pnpm build:worker
```

### Tests

```bash
pnpm test
```

### Lint y verificacion de tipos

```bash
pnpm lint
pnpm typecheck
```

### Migraciones de base de datos

```bash
pnpm db:migrate
```

---

## Contribuir

1. Haz fork del repositorio.
2. Crea una rama para tu feature (`git checkout -b feature/mi-feature`).
3. Haz commit de tus cambios.
4. Abre un Pull Request describiendo que cambiaste y por que.

Antes de enviar tu PR, asegurate de que:

- `pnpm build` pasa sin errores.
- `pnpm test` pasa sin errores.
- `pnpm lint` no reporta problemas.

---

## Licencia

[MIT](LICENSE)
