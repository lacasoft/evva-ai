import { tool } from "ai";
import { z } from "zod";
import type { SkillDefinition } from "../base-skill.js";

export const translatorSkill: SkillDefinition = {
  name: "translator",
  description: "Traduce texto entre idiomas usando el LLM.",
  category: "utility",
  forProfiles: ["young", "adult", "senior"],
  keywords: ["traducir", "traduccion", "como se dice", "idioma"],

  buildTools: () => ({
    translate: tool({
      description:
        "Traduce texto entre idiomas. Úsalo cuando el usuario pida traducir algo.",
      parameters: z.object({
        text: z.string().describe("Texto a traducir"),
        target_language: z
          .string()
          .describe('Idioma destino (ej: "inglés", "francés", "portugués")'),
        source_language: z
          .string()
          .optional()
          .describe(
            "Idioma origen (se detecta automáticamente si no se especifica)",
          ),
      }),
      execute: async ({ text, target_language, source_language }) => {
        return {
          success: true,
          instruction: `Traduce el siguiente texto ${source_language ? "de " + source_language : ""} a ${target_language}: "${text}"`,
          note: "El LLM traduce directamente, no se necesita API externa",
        };
      },
    }),
  }),

  promptInstructions: [
    "Puedes traducir texto entre idiomas con translate. El LLM realiza la traducción directamente.",
  ],
};
