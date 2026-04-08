<p align="center">
  <img src="assets/evva-logo.png" alt="Evva" width="250" />
</p>

<h1 align="center">Evva</h1>

<p align="center">
  <strong>Asistente personal con IA, memoria real y acciones proactivas.</strong><br/>
  <em>Vive en Telegram y WhatsApp. Recuerda todo. Actua antes de que lo pidas.</em>
</p>

<p align="center">
  <a href="https://github.com/lacasoft/evva-ai/releases"><img src="https://img.shields.io/github/v/release/lacasoft/evva-ai?style=flat-square" alt="Release" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License" /></a>
  <img src="https://img.shields.io/badge/node-%3E%3D22-green?style=flat-square" alt="Node" />
  <img src="https://img.shields.io/badge/skills-28-purple?style=flat-square" alt="Skills" />
  <img src="https://img.shields.io/badge/tools-60-orange?style=flat-square" alt="Tools" />
  <img src="https://img.shields.io/badge/channels-2-teal?style=flat-square" alt="Channels" />
</p>

<p align="center">
  <a href="README.md">Read in English</a> &middot; <a href="docs/SETUP.es.md">Guia de Instalacion</a> &middot; <a href="https://github.com/lacasoft/evva-ai/releases">Releases</a>
</p>

<p align="center">
  <strong>Prueba Evva ahora — sin instalar nada:</strong> <a href="https://t.me/evva_dev_bot">t.me/evva_dev_bot</a>
</p>

<p align="center">
  <img src="assets/intro.gif" alt="Evva Demo" width="350" />
</p>

---

## Caracteristicas

| | |
|:--|:--|
| **Brain** Memoria semantica persistente | **Bell** Recordatorios programados y mensajes proactivos |
| **Note** Notas, listas y tareas | **Person** Gestion de contactos |
| **Calendar** Integracion con Google Calendar | **Mail** Gmail: leer, buscar y enviar |
| **Dollar** Finanzas personales y metas de ahorro | **Mic** Transcripcion de notas de voz (Groq Whisper) |
| **Camera** Analisis de fotos y documentos (Claude Vision) | **Sun** Resumen proactivo diario |
| **Globe** Busqueda web (Brave) y resumenes de noticias | **Cloud** Clima para cualquier ciudad |
| **Pill** Seguimiento de medicamentos y habitos | **Phone** Contactos de emergencia |
| **Language** Traduccion y dictado inteligente | **Music** Integracion con Spotify |
| **Exchange** Conversion de divisas en tiempo real | **Birthday** Recordatorios proactivos de cumpleanos |
| **Recipe** Sugerencias de recetas desde listas de compras | **WhatsApp** Multi-canal (Telegram + WhatsApp) |
| **Plane** Busqueda de vuelos (SerpAPI) + autobuses (Firecrawl) | **Broom** Desuscripcion automatica de newsletters |
| **Speaker** Respuestas por voz (OpenAI TTS) | **Puzzle** Skills auto-extensibles en tiempo de ejecucion |
| **Pencil** Actualizar y eliminar datos de usuario | |

---

## Stack Tecnologico

| Capa | Tecnologia |
|:--|:--|
| Framework | NestJS + TypeScript |
| Bot | grammY |
| LLM | Claude Sonnet (Vercel AI SDK) |
| Embeddings | Voyage AI (voyage-3-lite, 512 dims) |
| Base de datos | PostgreSQL + pgvector |
| Cola | BullMQ + Redis |
| Transcripcion | Groq (Whisper) |
| Vision | Claude Vision |
| Busqueda | Brave Search API |
| Monorepo | pnpm workspaces |

---

## Arquitectura

Evva sigue una separacion gateway/worker. El gateway maneja todas las interacciones con el usuario -- recibiendo mensajes, orquestando el ciclo del agente LLM y devolviendo respuestas. El trabajo pesado o programado (recordatorios, extraccion de hechos, resumenes diarios) se delega a un worker asincrono via BullMQ, manteniendo al bot responsivo en todo momento.

```
Telegram / WhatsApp
        |
        v
+-----------------------------------+
|  Gateway (NestJS)                 |
|                                   |
|  TelegramModule    -- recibe mensajes, envia respuestas
|  ConversationModule -- orquesta el ciclo del agente
|  MemoryModule      -- RAG sobre hechos del usuario
|  PersonaModule     -- prompt de sistema dinamico
|  ToolsModule       -- web_search, reminders, etc.
|  SchedulerModule   -- encola trabajos via BullMQ
|  UsersModule       -- CRUD de usuarios y asistente
+-----------------------------------+
        | BullMQ (Redis)
        v
+-----------------------------------+
|  Worker (NestJS)                  |
|                                   |
|  ScheduledJobProcessor   -- ejecuta recordatorios
|  FactExtractionProcessor -- extrae hechos de conversaciones
|  DailyBriefingProcessor  -- envia resumenes matutinos
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

## Inicio Rapido

Para instrucciones detalladas paso a paso, consulta [`docs/SETUP.es.md`](docs/SETUP.es.md).

**Requisitos previos:** Node.js >= 22, pnpm >= 9, PostgreSQL con pgvector, Redis.

### Opcion A -- Docker Compose (recomendado)

```bash
git clone https://github.com/lacasoft/evva-ai.git
cd evva-ai
cp .env.example .env
# Edita .env con tus credenciales (consulta .env.example para todas las variables)

docker compose up
```

PostgreSQL, Redis, migraciones, gateway y worker inician automaticamente.

<details>
<summary><strong>Opcion B -- Instalacion manual</strong></summary>

```bash
git clone https://github.com/lacasoft/evva-ai.git
cd evva-ai
pnpm install
cp .env.example .env
# Edita .env con tus credenciales

pnpm db:migrate

# Terminal 1 -- Gateway (bot de Telegram)
pnpm dev:gateway

# Terminal 2 -- Worker (procesadores BullMQ)
pnpm dev:worker
```

El bot inicia en modo **long polling** -- no se requiere configuracion de webhook para desarrollo local.

</details>

---

## Estructura del Proyecto

```
evva/
├── apps/
│   ├── gateway/                 # App principal -- bot de Telegram + API
│   │   └── src/
│   │       ├── telegram/             # Manejador de mensajes de Telegram
│   │       ├── conversation/         # Ciclo del agente + onboarding
│   │       ├── memory/              # Busqueda y almacenamiento de hechos
│   │       ├── persona/             # Construccion del prompt de sistema
│   │       ├── tools/               # Herramientas disponibles para el LLM
│   │       ├── scheduler/           # Programacion de trabajos BullMQ
│   │       ├── users/               # CRUD de usuarios y asistente
│   │       ├── health/              # Endpoints de health check
│   │       └── config/              # Validacion de variables de entorno
│   │
│   └── worker/                  # Worker BullMQ -- trabajos asincronos
│       └── src/
│           ├── processors/           # ScheduledJob + FactExtraction
│           └── handlers/             # TelegramSender
│
├── packages/
│   ├── core/                    # Tipos, constantes y utilidades compartidas
│   ├── database/                # Cliente PostgreSQL (pg) y repositorios
│   ├── ai/                      # LLM (Claude), embeddings (Voyage), prompts
│   └── skills/                  # Plugins de skills modulares (28 skills)
│       └── src/
│           ├── registry.ts           # Registro central de skills
│           ├── base-skill.ts         # Interfaz SkillDefinition
│           ├── rag-helper.ts         # Guardado de hechos RAG entre skills
│           ├── runtime-loader.ts     # Motor de skills en tiempo de ejecucion
│           ├── memory/               # Memoria semantica persistente
│           ├── notes/                # Notas y listas
│           ├── contacts/             # Gestion de contactos
│           ├── data-management/      # Actualizar y eliminar datos de usuario
│           ├── reminders/            # Recordatorios programados
│           ├── finance/              # Tarjetas, transacciones, ahorros
│           ├── finance-security/     # Proteccion con palabra secreta
│           ├── health/               # Seguimiento de medicamentos y habitos
│           ├── emergency/            # Contactos de emergencia
│           ├── calendar/             # Google Calendar
│           ├── gmail/                # Gmail (leer, buscar, enviar)
│           ├── spotify/              # Integracion con Spotify
│           ├── weather/              # Consulta de clima
│           ├── search/               # Busqueda web (Brave)
│           ├── news/                 # Resumen de noticias
│           ├── translator/           # Traduccion de idiomas
│           ├── exchange/             # Tasas de cambio de divisas
│           ├── dictation/            # Redaccion inteligente de mensajes
│           ├── briefing/             # Resumen proactivo diario
│           ├── birthdays/            # Recordatorios de cumpleanos
│           ├── recipes/              # Sugerencias de recetas
│           ├── voice/                # Transcripcion de notas de voz
│           ├── vision/               # Analisis de fotos y documentos
│           ├── travel/               # Busqueda de vuelos y autobuses
│           ├── email-cleaner/        # Desuscripcion automatica de newsletters
│           ├── tts/                  # Respuestas de voz texto-a-habla
│           └── skill-creator/        # Skills en tiempo de ejecucion auto-extensibles
│
└── docs/                        # Guias de instalacion y documentacion
```

<details>
<summary><strong>Agregar un Nuevo Skill</strong></summary>

Cada skill es un modulo independiente. Para agregar uno nuevo:

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

Luego registralo en `packages/skills/src/index.ts`:

```typescript
export { mySkill } from './my-skill/index.js';
import { mySkill } from './my-skill/index.js';
skillRegistry.register(mySkill);
```

El skill queda automaticamente disponible para el LLM. No es necesario modificar ningun otro archivo.

</details>

---

## Como Funciona

### Flujo de Mensajes

1. El usuario envia un mensaje en Telegram o WhatsApp.
2. `TelegramService` recibe el mensaje y crea o actualiza el usuario en PostgreSQL.
3. Si el usuario es nuevo, se inicia el flujo de onboarding (elegir nombre del asistente).
4. Para usuarios existentes: se buscan hechos relevantes por busqueda semantica (Voyage + pgvector), se construye un prompt de sistema dinamico, se carga el historial reciente, y se llama a Claude con todas las herramientas disponibles.
5. Si el LLM invoca una herramienta, se ejecuta y el resultado se retroalimenta.
6. La respuesta final se envia al usuario. El mensaje se persiste, y la extraccion de hechos se encola en BullMQ (asincrono).

### Flujo Proactivo (Recordatorios)

1. El usuario dice "recuerdame X el viernes a las 8am".
2. Claude llama a la herramienta `create_reminder`.
3. `SchedulerService` crea un trabajo en BullMQ con el retraso calculado.
4. En el momento programado, `ScheduledJobProcessor` genera un mensaje personalizado con Claude y lo entrega al usuario.

---

## Herramientas Disponibles

### Productividad

| Herramienta | Descripcion | Requiere |
|:--|:--|:--|
| `save_fact` | Persistir un hecho permanente sobre el usuario | -- |
| `create_note` | Crear notas o listas | -- |
| `get_notes` | Ver notas y listas activas | -- |
| `update_note` | Modificar, marcar items, archivar o eliminar notas | -- |
| `save_contact` | Guardar un contacto (nombre, telefono, email, relacion) | -- |
| `search_contacts` | Buscar contactos por nombre o relacion | -- |
| `create_reminder` | Programar un recordatorio futuro | Redis |
| `configure_daily_briefing` | Habilitar/deshabilitar resumen matutino diario | -- |

### Finanzas

| Herramienta | Descripcion | Requiere |
|:--|:--|:--|
| `add_credit_card` | Registrar una tarjeta de credito con fechas de corte y pago | -- |
| `get_credit_cards` | Ver tarjetas registradas con saldos | -- |
| `record_transaction` | Registrar ingreso o gasto | -- |
| `get_finance_summary` | Resumen financiero mensual por categoria | -- |
| `get_recent_transactions` | Ver transacciones recientes | -- |
| `create_savings_goal` | Crear una meta de ahorro con monto objetivo | -- |
| `get_savings_goals` | Ver progreso de ahorros | -- |

### Comunicacion

| Herramienta | Descripcion | Requiere |
|:--|:--|:--|
| `connect_google` | Generar enlace OAuth de Google (Calendar + Gmail) | Google OAuth |
| `list_calendar_events` | Listar eventos proximos del calendario | Google OAuth |
| `create_calendar_event` | Crear un nuevo evento de calendario | Google OAuth |
| `list_emails` | Listar correos recientes | Google OAuth |
| `read_email` | Leer contenido completo de un correo | Google OAuth |
| `send_email` | Enviar un correo desde el Gmail del usuario | Google OAuth |

### Salud

| Herramienta | Descripcion | Requiere |
|:--|:--|:--|
| `add_medication` | Registrar un medicamento con horario | -- |
| `get_medications` | Ver medicamentos activos | -- |
| `create_habit` | Crear un habito para seguimiento diario | -- |
| `log_habit` | Registrar progreso de un habito | -- |
| `get_habit_progress` | Ver cumplimiento de habitos del dia | -- |
| `add_emergency_contact` | Registrar un contacto de emergencia | -- |
| `get_emergency_contacts` | Ver contactos de emergencia | -- |

### Utilidades

| Herramienta | Descripcion | Requiere |
|:--|:--|:--|
| `web_search` | Busqueda web actualizada | `BRAVE_SEARCH_API_KEY` |
| `summarize_news` | Buscar y resumir noticias actuales | `BRAVE_SEARCH_API_KEY` |
| `get_weather` | Clima actual para una ciudad | -- |
| `translate` | Traducir texto entre idiomas | -- |
| `calculate_exchange_rate` | Conversion de divisas en tiempo real | -- |
| `draft_message` | Generar mensajes formales/informales | -- |
| `save_birthday` | Guardar una fecha de cumpleanos | -- |
| `check_upcoming_birthdays` | Consultar cumpleanos proximos | -- |
| `suggest_recipes` | Sugerir recetas desde lista de compras | -- |

### Media

| Herramienta | Descripcion | Requiere |
|:--|:--|:--|
| `connect_spotify` | Generar enlace OAuth de Spotify | Spotify OAuth |
| `now_playing` | Mostrar cancion en reproduccion | Spotify OAuth |
| `recent_tracks` | Mostrar canciones reproducidas recientemente | Spotify OAuth |
| `top_tracks` | Mostrar canciones mas escuchadas del usuario | Spotify OAuth |
| `search_music` | Buscar en el catalogo de Spotify | Spotify OAuth |

### Viajes

| Herramienta | Descripcion | Requiere |
|:--|:--|:--|
| `search_flights` | Buscar vuelos entre ciudades | `SERPAPI_API_KEY` |
| `search_airport` | Encontrar codigos de aeropuerto por ciudad | `SERPAPI_API_KEY` |
| `get_booking_link` | Obtener enlace de reserva para un vuelo | `SERPAPI_API_KEY` |
| `search_buses` | Buscar rutas de autobus entre ciudades | `FIRECRAWL_API_KEY` |
| `get_travel_page_info` | Extraer detalles de una pagina de viajes | `FIRECRAWL_API_KEY` |

### Gestion de Datos

| Herramienta | Descripcion | Requiere |
|:--|:--|:--|
| `update_user_data` | Actualizar contactos, emergencia, tarjetas, medicamentos, habitos | -- |
| `delete_user_data` | Eliminar contactos, hechos, medicamentos, habitos | -- |
| `set_finance_secret` | Establecer una palabra secreta para proteccion financiera | -- |
| `verify_finance_secret` | Verificar palabra secreta antes de operaciones financieras | -- |
| `create_runtime_skill` | Crear un skill personalizado via conversacion | -- |
| `list_runtime_skills` | Listar skills personalizados del usuario | -- |

---

## Optimizacion de Tokens

Evva esta disenado para minimizar el consumo de tokens LLM por mensaje:

| Optimizacion | Antes | Despues | Ahorro |
|:--|:--|:--|:--|
| Ventana de historial de conversacion | 12 mensajes | 6 mensajes | ~480 tokens |
| maxSteps (rondas de llamadas a herramientas) | 3 | 2 | ~5,400 tokens |
| Prompt de sistema (bloque de comportamiento) | 225 tokens | 80 tokens | ~145 tokens |
| Filtrado de skills OAuth | Las 60 herramientas siempre cargadas | Solo herramientas conectadas cargadas | ~2,000 tokens |
| Consulta de proveedor | 2 llamadas a BD por mensaje | 1 llamada cacheada (Redis 5min TTL) | Latencia |
| Registro de skills | Verificacion de env en cada llamada | Cacheado despues de la primera llamada | CPU |

**Reduccion total estimada: ~55% (de ~23K a ~10K tokens por mensaje)**

```
Antes:   [system ~1,400] + [60 tools ~4,200] + [history ~960] x 3 steps = ~27,000 tokens
Despues: [system ~1,200] + [~25 tools ~1,800] + [history ~480] x 2 steps = ~11,000 tokens
```

---

## Configuracion

### Variables de Entorno Requeridas

| Variable | Donde obtenerla |
|:--|:--|
| `TELEGRAM_BOT_TOKEN` | [@BotFather](https://t.me/BotFather) en Telegram |
| `ANTHROPIC_API_KEY` | [console.anthropic.com](https://console.anthropic.com) |
| `VOYAGE_API_KEY` | [dash.voyageai.com](https://dash.voyageai.com) |
| `DATABASE_URL` | `postgresql://localhost:5432/evva` para desarrollo local |
| `REDIS_URL` | `redis://localhost:6379` para desarrollo local |

### Variables de Entorno Opcionales

| Variable | Proposito |
|:--|:--|
| `BRAVE_SEARCH_API_KEY` | Herramienta de busqueda web ([brave.com/search/api](https://brave.com/search/api/)) |
| `GROQ_API_KEY` | Transcripcion de notas de voz via Whisper |
| `GOOGLE_CLIENT_ID` | Integracion con Google Calendar y Gmail |
| `GOOGLE_CLIENT_SECRET` | Integracion con Google Calendar y Gmail |
| `APP_BRAND_NAME` | Nombre de marca personalizado del asistente (por defecto: "Evva") |
| `LLM_MODEL` | Sobreescribir el modelo de Claude por defecto |
| `TELEGRAM_WEBHOOK_URL` | Solo produccion |
| `TELEGRAM_SECRET_TOKEN` | Solo produccion -- generar con `openssl rand -hex 32` |

---

## Desarrollo

```bash
pnpm build              # Compilar todos los paquetes y apps
pnpm build:gateway      # Compilar solo gateway
pnpm build:worker       # Compilar solo worker

pnpm test               # Ejecutar todas las pruebas
pnpm test:watch         # Ejecutar pruebas en modo watch
pnpm test:cov           # Ejecutar pruebas con cobertura

pnpm lint               # Lint en todos los paquetes
pnpm lint:fix           # Lint y auto-correccion

pnpm db:migrate         # Ejecutar migraciones pendientes
pnpm db:migrate:new     # Crear un nuevo archivo de migracion
```

### Comandos de Telegram

| Comando | Accion |
|:--|:--|
| `/start` | Mensaje de bienvenida y onboarding |
| `/reset` | Iniciar una nueva sesion de conversacion |
| `/memory` | Mostrar lo que el asistente recuerda |
| `/help` | Listar comandos disponibles |

---

## Contribuir

Las contribuciones son bienvenidas! Haz fork del repositorio, crea una rama de feature y abre un pull request. Asegurate de que todas las pruebas pasen (`pnpm test`) y el linting este limpio (`pnpm lint`) antes de enviar. Para bugs y solicitudes de features, abre un issue.

---

## Licencia

Este proyecto esta bajo la [Licencia MIT](LICENSE).

---

<p align="center">
  Hecho por <a href="https://laca-soft.com">LACA-SOFT</a> &middot; <a href="https://github.com/lacasoft">GitHub</a>
</p>
