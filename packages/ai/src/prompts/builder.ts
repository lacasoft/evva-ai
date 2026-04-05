import type { Assistant, MemoryFact, Message } from '@evva/core';
import { PROMPT_TOKENS } from '@evva/core';

// ============================================================
// buildSystemPrompt — arma el system prompt completo por usuario
// ============================================================

export interface SystemPromptInput {
  assistant: Assistant;
  userFirstName?: string;
  timezone: string;
  language: 'es' | 'en';
  relevantFacts: MemoryFact[];
}

export function buildSystemPrompt(input: SystemPromptInput): string {
  const sections: string[] = [];

  // 1. Identidad base del asistente
  sections.push(input.assistant.personalityBase);

  // 2. Preferencias aprendidas (si existen)
  if (input.assistant.learnedPreferences?.trim()) {
    sections.push(`\nPreferencias del usuario:\n${input.assistant.learnedPreferences}`);
  }

  // 3. Facts relevantes recuperados de memoria
  if (input.relevantFacts.length > 0) {
    const factsText = input.relevantFacts
      .map((f) => `- ${f.content}`)
      .join('\n');

    sections.push(
      `\n${PROMPT_TOKENS.FACTS_SECTION_START}\nEstos son hechos que recuerdas sobre el usuario:\n${factsText}\n${PROMPT_TOKENS.FACTS_SECTION_END}`,
    );
  }

  // 4. Contexto temporal
  const now = new Date().toLocaleString(
    input.language === 'es' ? 'es-MX' : 'en-US',
    {
      timeZone: input.timezone,
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  );
  sections.push(`\nFecha y hora actual para el usuario: ${now}`);

  // 5. Instrucciones de tools
  sections.push(`
Tienes acceso a las siguientes capacidades:
- save_fact: Cuando el usuario comparta información personal importante (nombre de familiar, preferencia, fecha importante, etc.), usa esta tool para guardarla en su memoria permanente.
- create_reminder: Cuando el usuario pida que le recuerdes algo en un momento específico, usa esta tool para programar el recordatorio.
- create_note: Crea notas o listas (de compras, pendientes, etc.) para el usuario.
- get_notes: Muestra las notas y listas activas del usuario.
- update_note: Modifica una nota existente: agregar items, tachar, archivar o eliminar.
- save_contact: Guarda datos de una persona (nombre, teléfono, email, relación).
- search_contacts: Busca contactos por nombre o relación.
- connect_google: Genera un link para conectar Google (Calendar + Gmail). Un solo link conecta ambos servicios.
- list_calendar_events: Muestra los próximos eventos del calendario del usuario.
- create_calendar_event: Crea un evento en el calendario del usuario.
- list_emails: Muestra los correos recientes del Gmail del usuario. Requiere la misma conexión de Google.
- read_email: Lee el contenido completo de un correo específico.
- add_credit_card: Registra una tarjeta de crédito (nombre, últimos 4 dígitos, fecha de corte/pago).
- get_credit_cards: Muestra tarjetas registradas con saldos y fechas.
- record_transaction: Registra un ingreso o gasto (con categoría y método de pago).
- get_finance_summary: Resumen financiero del mes (ingresos, gastos, balance, por categoría).
- get_recent_transactions: Movimientos recientes del usuario.
- create_savings_goal: Crea una meta de ahorro con monto objetivo y fecha.
- get_savings_goals: Muestra metas de ahorro activas con progreso.
- configure_daily_briefing: Activa/desactiva el resumen diario matutino con pendientes y contexto.

Cuando el usuario mencione gastos, compras, pagos, o dinero, usa record_transaction proactivamente.
Cuando pregunte con qué tarjeta pagar, consulta get_credit_cards y recomienda según fechas de corte y saldos.
- web_search: Cuando necesites información actual que no tienes, puedes buscar en internet.
- get_weather: Para consultar el clima actual de una ciudad.

Usa save_fact proactivamente — si el usuario menciona algo relevante de su vida, guárdalo sin que te lo pida explícitamente.
Cuando el usuario diga datos de contacto de alguien (nombre + teléfono/email), usa save_contact para guardarlos.

IMPORTANTE — Cuando leas correos del usuario, actúa como un verdadero asistente personal:
- Si es un correo de vuelo/viaje: sugiere crear un recordatorio para el vuelo y anotar los datos del viaje.
- Si es una promoción (cine, restaurante, tienda): sugiere si quiere aprovecharla o agendarla.
- Si es una factura o cobro: resume el monto, fecha y concepto, y ofrece guardarlo como nota.
- Si son resultados médicos o citas: sugiere agendar una cita de seguimiento con el doctor.
- Si es una confirmación de pedido: ofrece crear un recordatorio para la fecha de entrega.
- Si es un correo laboral importante: sugiere acciones concretas (responder, agendar reunión, etc.).
No solo informes — propón acciones. Un buen asistente anticipa lo que el usuario necesita.

Si el usuario pregunta qué puedes hacer o pide ayuda, describe tus capacidades con ejemplos concretos:
- Notas y listas (crear, ver, modificar, tachar items)
- Recordatorios programados (en X minutos, mañana a las 9am)
- Guardar y buscar contactos (nombre, teléfono, email)
- Memoria permanente (recuerdas todo lo que te cuentan)
- Búsqueda web y clima
- Procesar notas de voz`);

  return sections.join('\n');
}

// ============================================================
// buildConversationMessages — formatea el historial para el LLM
// ============================================================

export function buildConversationMessages(
  messages: Message[],
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));
}

// ============================================================
// buildFactExtractionPrompt — para el worker de extracción asíncrona
// ============================================================

export function buildFactExtractionPrompt(
  messages: Array<{ role: string; content: string }>,
): string {
  const conversation = messages
    .map((m) => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`)
    .join('\n');

  return `Analiza esta conversación y extrae SOLO los hechos importantes y permanentes sobre el usuario.

Conversación:
${conversation}

Extrae únicamente información que sea:
- Personal y específica del usuario (NO información general)
- Duradera (no información temporal o de un momento puntual)
- Útil para futuras conversaciones

Para cada hecho, determina su categoría:
- personal: nombre, edad, ubicación, datos biográficos
- relationship: familia, pareja, amigos, mascotas
- work: trabajo, empresa, rol, proyectos
- preference: gustos, hábitos, estilo de vida
- goal: objetivos, planes, sueños
- reminder: cosas importantes que no quiere olvidar
- other: cualquier otra información relevante

Responde ÚNICAMENTE con un JSON válido en este formato exacto:
{
  "facts": [
    {
      "content": "descripción clara del hecho",
      "category": "personal|relationship|work|preference|goal|reminder|other",
      "importance": 0.1-1.0
    }
  ]
}

Si no hay hechos relevantes que extraer, responde: {"facts": []}`;
}

// ============================================================
// buildProactiveMessagePrompt — para heartbeats y recordatorios
// ============================================================

export interface ProactivePromptInput {
  assistantName: string;
  userFirstName?: string;
  reminderMessage: string;
  additionalContext?: string;
  timezone: string;
  language: 'es' | 'en';
}

export function buildProactiveMessagePrompt(input: ProactivePromptInput): string {
  const now = new Date().toLocaleString(
    input.language === 'es' ? 'es-MX' : 'en-US',
    {
      timeZone: input.timezone,
      weekday: 'long',
      hour: '2-digit',
      minute: '2-digit',
    },
  );

  return `Eres ${input.assistantName}, el asistente personal de ${input.userFirstName ?? 'tu usuario'}.

Es ${now} y tienes que enviarle este mensaje al usuario:
"${input.reminderMessage}"

${input.additionalContext ? `Contexto adicional: ${input.additionalContext}` : ''}

Escribe el mensaje de manera natural y cálida, como lo haría un asistente de confianza. 
Sé conciso y directo. No añadas información que no se te pidió.
Responde SOLO con el mensaje a enviar, sin explicaciones adicionales.`;
}
