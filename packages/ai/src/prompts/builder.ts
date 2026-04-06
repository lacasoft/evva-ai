import type { Assistant, MemoryFact, Message } from "@evva/core";
import { PROMPT_TOKENS } from "@evva/core";

// ============================================================
// buildSystemPrompt — arma el system prompt completo por usuario
// ============================================================

export interface SystemPromptInput {
  assistant: Assistant;
  userFirstName?: string;
  timezone: string;
  language: "es" | "en";
  gender?: "male" | "female" | "neutral";
  relevantFacts: MemoryFact[];
  skillInstructions?: string[];
}

export function buildSystemPrompt(input: SystemPromptInput): string {
  const sections: string[] = [];

  // 1. Identidad base del asistente
  sections.push(input.assistant.personalityBase);

  // 1.5. Adaptacion de lenguaje por genero
  sections.push(`
Adaptacion de genero: Detecta el genero del usuario por su nombre, contexto de conversacion, o si lo menciona explicitamente. Adapta tu lenguaje en espanol:
- Si es mujer: usa femenino (bienvenida, lista, conectada, amiga, jefa, etc.)
- Si es hombre: usa masculino (bienvenido, listo, conectado, amigo, jefe, etc.)
- Si no esta claro: usa lenguaje neutro hasta que puedas determinarlo.
Cuando detectes el genero, guardalo como fact con save_fact para recordarlo.`);

  // 2. Preferencias aprendidas (si existen)
  if (input.assistant.learnedPreferences?.trim()) {
    sections.push(
      `\nPreferencias del usuario:\n${input.assistant.learnedPreferences}`,
    );
  }

  // 3. Facts relevantes recuperados de memoria
  if (input.relevantFacts.length > 0) {
    const factsText = input.relevantFacts
      .map((f) => `- ${f.content}`)
      .join("\n");

    sections.push(
      `\n${PROMPT_TOKENS.FACTS_SECTION_START}\nEstos son hechos que recuerdas sobre el usuario:\n${factsText}\n${PROMPT_TOKENS.FACTS_SECTION_END}`,
    );
  }

  // 4. Contexto temporal
  const now = new Date().toLocaleString(
    input.language === "es" ? "es-MX" : "en-US",
    {
      timeZone: input.timezone,
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    },
  );
  sections.push(`\nFecha y hora actual para el usuario: ${now}`);

  // 5. Instrucciones de tools (dinámicas desde skill registry)
  if (input.skillInstructions && input.skillInstructions.length > 0) {
    sections.push(
      `\nTienes acceso a las siguientes capacidades:\n${input.skillInstructions.join("\n")}`,
    );
  }

  sections.push(`
Comportamiento proactivo:
- Guarda facts automaticamente cuando el usuario mencione datos personales relevantes.
- Guarda contactos cuando mencionen nombre + telefono/email.
- Al leer correos, propon acciones concretas (recordatorios, notas, citas).
- Acepta notas de voz y fotos.

REGLA CRITICA — Confirmacion antes de acciones sensibles:
SIEMPRE muestra un resumen y pide confirmacion ANTES de ejecutar estas acciones:
- Enviar correos (send_email): muestra destinatario, asunto y cuerpo, pregunta "¿Lo envio?"
- Registrar transacciones financieras (record_transaction): muestra monto, descripcion y metodo, pregunta "¿Lo registro?"
- Crear eventos de calendario (create_calendar_event): muestra titulo, fecha y hora, pregunta "¿Lo agendo?"
- Eliminar notas, contactos o datos (delete/archive): pregunta "¿Seguro que quieres eliminarlo?"
Solo ejecuta la tool cuando el usuario confirme explicitamente (si, dale, envialo, ok, etc.).
Para acciones no sensibles (guardar facts, buscar, consultar, crear notas) puedes ejecutar directamente.`);

  return sections.join("\n");
}

// ============================================================
// buildConversationMessages — formatea el historial para el LLM
// ============================================================

export function buildConversationMessages(
  messages: Message[],
): Array<{ role: "user" | "assistant"; content: string }> {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
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
    .map((m) => `${m.role === "user" ? "Usuario" : "Asistente"}: ${m.content}`)
    .join("\n");

  return `Analiza esta conversacion y extrae SOLO los hechos importantes y permanentes sobre el usuario.

Conversacion:
${conversation}

REGLAS de extraccion:
- Solo informacion personal y especifica del usuario (NO informacion general)
- Solo datos duraderos (no temporales o puntuales)
- Solo datos utiles para futuras conversaciones
- NO repitas hechos que ya se mencionaron en mensajes anteriores de esta misma conversacion
- Si el usuario CORRIGE informacion previa (ej: "en realidad vivo en Madrid", "mi esposa se llama Maria"), extrae el dato NUEVO y marcalo como correccion

Categorias:
- personal: nombre, edad, ubicacion, datos biograficos
- relationship: familia, pareja, amigos, mascotas
- work: trabajo, empresa, rol, proyectos
- preference: gustos, habitos, estilo de vida
- goal: objetivos, planes, suenos
- reminder: cosas importantes que no quiere olvidar
- other: cualquier otra informacion relevante

Responde UNICAMENTE con un JSON valido en este formato exacto:
{
  "facts": [
    {
      "content": "descripcion clara del hecho",
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
  language: "es" | "en";
}

export function buildProactiveMessagePrompt(
  input: ProactivePromptInput,
): string {
  const now = new Date().toLocaleString(
    input.language === "es" ? "es-MX" : "en-US",
    {
      timeZone: input.timezone,
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
    },
  );

  return `Eres ${input.assistantName}, el asistente personal de ${input.userFirstName ?? "tu usuario"}.

Es ${now} y tienes que enviarle este mensaje al usuario:
"${input.reminderMessage}"

${input.additionalContext ? `Contexto adicional: ${input.additionalContext}` : ""}

Escribe el mensaje de manera natural y cálida, como lo haría un asistente de confianza. 
Sé conciso y directo. No añadas información que no se te pidió.
Responde SOLO con el mensaje a enviar, sin explicaciones adicionales.`;
}
