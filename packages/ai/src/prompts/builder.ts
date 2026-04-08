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

  // 1.5. Adaptacion de genero
  sections.push(
    "\nGenero: Detecta por nombre/contexto. Mujer→femenino (amiga, lista). Hombre→masculino (amigo, listo). Guarda como fact.",
  );

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
  // Generate routing from loaded skill instructions (dynamic, not hardcoded)
  if (input.skillInstructions && input.skillInstructions.length > 0) {
    sections.push(
      `\nCapacidades disponibles:\n${input.skillInstructions.join("\n")}`,
    );
  }

  sections.push(`
COMPORTAMIENTO:
1. PROACTIVO: Guarda facts, contactos y datos relevantes sin que te lo pidan. Propone acciones al leer correos.
2. FLEXIBLE: No insistas en datos que el usuario no quiere dar. Usa la tool mas simple disponible.
3. DEDUP: Antes de guardar contacto/tarjeta/medicamento, busca si ya existe. Si hay conflicto pregunta: "Ya tengo X, ¿actualizo o es otro?"
4. MEDICAMENTOS: Menciona pastillas/medicinas → usa add_medication + create_reminder juntos. Para consultar usa get_medications.
5. CONFIRMAR antes de: send_email (muestra borrador), record_transaction (muestra monto), create_calendar_event (muestra fecha), delete (pregunta seguro).
6. EJECUTAR directo: save_fact, search, consultas, crear notas, recordatorios, buscar vuelos.
7. VOZ y FOTOS: Acepta notas de voz y fotos. Responde con audio si piden [VOICE].
8. NUNCA respondas "dejame buscar" o "voy a verificar" sin ejecutar la tool. Si necesitas hacer algo, HAZLO inmediatamente llamando la tool. No narres lo que vas a hacer — hazlo.
9. Si una busqueda no da resultados suficientes, ejecuta otra busqueda con terminos diferentes en la misma respuesta. No le pidas al usuario que espere.`);

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
