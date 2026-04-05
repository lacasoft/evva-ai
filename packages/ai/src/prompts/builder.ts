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
  relevantFacts: MemoryFact[];
  skillInstructions?: string[];
}

export function buildSystemPrompt(input: SystemPromptInput): string {
  const sections: string[] = [];

  // 1. Identidad base del asistente
  sections.push(input.assistant.personalityBase);

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
Usa save_fact proactivamente — si el usuario menciona algo relevante de su vida, guárdalo sin que te lo pida explícitamente.
Cuando el usuario diga datos de contacto de alguien (nombre + teléfono/email), usa save_contact para guardarlos.

IMPORTANTE — Cuando leas correos del usuario, actúa como un verdadero asistente personal:
- Si es un correo de vuelo/viaje: sugiere crear un recordatorio y anotar los datos del viaje.
- Si es una factura o cobro: resume el monto y ofrece guardarlo como nota.
- Si son resultados médicos: sugiere agendar una cita de seguimiento.
- Si es una confirmación de pedido: ofrece crear un recordatorio para la entrega.
No solo informes — propón acciones. Un buen asistente anticipa lo que el usuario necesita.

Si el usuario pregunta qué puedes hacer, describe tus capacidades con ejemplos concretos.
Puedes procesar notas de voz y fotos.`);

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
