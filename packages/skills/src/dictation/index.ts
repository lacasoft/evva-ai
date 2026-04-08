import { tool } from "ai";
import { z } from "zod";
import type { SkillDefinition } from "../base-skill.js";

export const dictationSkill: SkillDefinition = {
  name: "dictation",
  description: "Genera mensajes formales o informales para el usuario.",
  category: "utility",
  forProfiles: ["young", "adult", "senior"],
  keywords: ["redactar", "escribir mensaje", "formal", "cortes", "mensaje profesional"],

  buildTools: () => ({
    draft_message: tool({
      description:
        'Genera un mensaje formal o informal para el usuario. Úsalo cuando pida "escribe un mensaje para mi jefe", "redacta un correo", "ayúdame a escribir...".',
      parameters: z.object({
        recipient: z
          .string()
          .describe("Para quién es el mensaje (jefe, doctor, cliente, etc.)"),
        purpose: z
          .string()
          .describe(
            "Propósito del mensaje (pedir permiso, agradecer, reclamar, etc.)",
          ),
        tone: z
          .string()
          .default("professional")
          .describe("Tono: formal, informal, friendly, professional, casual, urgent, etc."),
        key_points: z
          .array(z.string())
          .optional()
          .describe("Puntos clave que debe incluir"),
        context: z.string().optional().describe("Contexto adicional"),
      }),
      execute: async ({ recipient, purpose, tone, key_points, context }) => {
        return {
          success: true,
          instruction: `Genera un mensaje ${tone} para ${recipient}. Propósito: ${purpose}.${key_points ? " Puntos clave: " + key_points.join(", ") : ""}${context ? " Contexto: " + context : ""}`,
        };
      },
    }),
  }),

  promptInstructions: [
    "Puedes redactar mensajes con draft_message. El LLM genera el texto directamente basándose en los parámetros.",
  ],
};
