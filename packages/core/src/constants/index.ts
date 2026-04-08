// ============================================================
// Branding — configurable via APP_BRAND_NAME en .env
// ============================================================
export const BRAND = {
  get NAME() {
    return process.env.APP_BRAND_NAME ?? "Evva";
  },
  get NAME_LOWER() {
    return this.NAME.toLowerCase();
  },
} as const;

// ============================================================
// Límites del sistema
// ============================================================
export const LIMITS = {
  // Cuántos mensajes recientes incluir como contexto
  CONVERSATION_WINDOW: 6,

  // Cuántos facts recuperar por búsqueda semántica
  MEMORY_RETRIEVAL_TOP_K: 5,

  // Umbral de similaridad para búsqueda semántica (0.0 - 1.0)
  MEMORY_SEARCH_THRESHOLD: 0.65,

  // Umbral para considerar un fact como duplicado (0.0 - 1.0)
  MEMORY_DEDUP_THRESHOLD: 0.92,

  // Longitud máxima de un fact en caracteres
  MEMORY_FACT_MAX_LENGTH: 500,

  // Caracteres máximos de un mensaje de Telegram (límite de la API)
  TELEGRAM_MAX_MESSAGE_LENGTH: 4096,

  // Tiempo máximo de espera para respuesta del LLM (ms)
  LLM_TIMEOUT_MS: 60_000,

  // Reintentos máximos para jobs fallidos
  JOB_MAX_ATTEMPTS: 3,
} as const;

// ============================================================
// Tokens especiales en prompts
// ============================================================
export const PROMPT_TOKENS = {
  FACTS_SECTION_START: "<memory_facts>",
  FACTS_SECTION_END: "</memory_facts>",
  HISTORY_SECTION_START: "<conversation_history>",
  HISTORY_SECTION_END: "</conversation_history>",
} as const;

// ============================================================
// Onboarding — mensajes del flujo de bienvenida
// ============================================================
export const ONBOARDING_MESSAGES = {
  WELCOME: (firstName: string) =>
    `Hola ${firstName}, soy tu nuevo asistente personal. Voy a hacerte unas preguntas rápidas para conocerte mejor.\n\nPrimero, ¿cómo quieres que me llame?`,

  ASK_USER_NAME: (assistantName: string) =>
    `Perfecto, seré ${assistantName}. ¿Y cómo te llamas tú? (tu nombre real, para dirigirme a ti)\n\n(Escribe "volver" si quieres cambiar mi nombre)`,

  ASK_AGE_RANGE: (userName: string) =>
    `Mucho gusto, ${userName}. Para mostrarte las funciones más útiles, ¿en qué rango de edad estás?\n\n1. Joven (18-30)\n2. Adulto (31-55)\n3. Adulto mayor (56+)\n\nResponde con el número. Escribe "volver" para corregir tu nombre.`,

  ASK_INTERESTS_YOUNG: (assistantName: string) =>
    `Genial. Como ${assistantName}, puedo ayudarte con muchas cosas. ¿Cuáles te interesan más?\n\n` +
    `1. Finanzas personales (gastos, tarjetas, ahorro)\n` +
    `2. Correo y calendario (Gmail, Google Calendar)\n` +
    `3. Notas y recordatorios\n` +
    `4. Búsqueda web y noticias\n` +
    `5. Todo lo anterior\n\n` +
    `Puedes elegir varios separados por coma (ej: 1, 3, 4)`,

  ASK_INTERESTS_ADULT: (assistantName: string) =>
    `Muy bien. Como ${assistantName}, tengo varias capacidades. ¿Cuáles te interesan más?\n\n` +
    `1. Finanzas personales (gastos, tarjetas, ahorro)\n` +
    `2. Correo y calendario (Gmail, Google Calendar)\n` +
    `3. Notas, listas y recordatorios\n` +
    `4. Seguimiento de hábitos y salud\n` +
    `5. Todo lo anterior\n\n` +
    `Puedes elegir varios separados por coma (ej: 1, 2, 3)`,

  ASK_INTERESTS_SENIOR: (assistantName: string) =>
    `Perfecto. Como ${assistantName}, estoy aquí para facilitarte la vida. ¿Qué te gustaría que haga por ti?\n\n` +
    `1. Recordatorios de medicamentos\n` +
    `2. Contactos de emergencia\n` +
    `3. Recordatorios y notas\n` +
    `4. Leer y enviar correos\n` +
    `5. Todo lo anterior\n\n` +
    `Puedes elegir varios separados por coma o decirme "todos"`,

  READY_YOUNG: (name: string, interests: string[]) =>
    `Listo, ${name} a tu servicio. Ya estoy configurado.\n\n` +
    `Esto es lo que puedo hacer por ti:\n` +
    (interests.includes("finance") ? `- Registrar gastos y tarjetas\n` : "") +
    (interests.includes("google")
      ? `- Conectar tu Gmail y Calendario (dime "Conecta mi Google")\n`
      : "") +
    (interests.includes("notes")
      ? `- Crear notas, listas y recordatorios\n`
      : "") +
    (interests.includes("search")
      ? `- Buscar en internet y darte noticias\n`
      : "") +
    `- Puedes enviarme notas de voz y fotos\n\n` +
    `¿En qué te ayudo?`,

  READY_ADULT: (name: string, interests: string[]) =>
    `Perfecto, ${name} listo para ayudarte.\n\n` +
    `Tus funciones principales:\n` +
    (interests.includes("finance")
      ? `- Gestión de finanzas (gastos, tarjetas, ahorro)\n`
      : "") +
    (interests.includes("google")
      ? `- Email y calendario (dime "Conecta mi Google")\n`
      : "") +
    (interests.includes("notes") ? `- Notas, listas y recordatorios\n` : "") +
    (interests.includes("health")
      ? `- Seguimiento de hábitos y medicamentos\n`
      : "") +
    `- Notas de voz y fotos\n\n` +
    `¿Qué necesitas?`,

  READY_SENIOR: (name: string, interests: string[]) =>
    `Listo, soy ${name} y estoy aquí para ti.\n\n` +
    `Te puedo ayudar con:\n` +
    (interests.includes("medications")
      ? `- Recordarte tus medicamentos a la hora indicada\n`
      : "") +
    (interests.includes("emergency")
      ? `- Guardar contactos de emergencia\n`
      : "") +
    (interests.includes("notes")
      ? `- Recordatorios y notas importantes\n`
      : "") +
    (interests.includes("google") ? `- Leer y enviar correos por ti\n` : "") +
    `- Puedes hablarme por nota de voz si prefieres no escribir\n\n` +
    `¿En qué te ayudo?`,

  NAME_CONFIRM: (name: string) =>
    `Me gusta. Seré ${name}. Voy a recordar todo lo que me cuentes.`,

  READY: (name: string) =>
    `Listo. Soy ${name} y estoy aquí cuando me necesites. Escribe /ayuda para ver todo lo que puedo hacer.`,
} as const;

// ============================================================
// Timezones disponibles (México primero)
// ============================================================
export const TIMEZONES = [
  "America/Mexico_City",
  "America/Monterrey",
  "America/Tijuana",
  "America/Bogota",
  "America/Lima",
  "America/Santiago",
  "America/Buenos_Aires",
  "America/New_York",
  "America/Los_Angeles",
  "Europe/Madrid",
  "UTC",
] as const;

export type Timezone = (typeof TIMEZONES)[number];

export const DEFAULT_TIMEZONE = (process.env.DEFAULT_TIMEZONE ??
  "America/Mexico_City") as string;
export const DEFAULT_LANGUAGE = (process.env.DEFAULT_LANGUAGE ?? "es") as
  | "es"
  | "en";
