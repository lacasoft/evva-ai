import { tool } from "ai";
import { z } from "zod";
import { saveMemoryFact } from "@evva/database";
import { embedText } from "@evva/ai";
import type { MemoryCategory } from "@evva/core";
import type { SkillDefinition } from "../base-skill.js";

export const memorySkill: SkillDefinition = {
  name: "memory",
  description:
    "Guarda hechos importantes sobre el usuario en su memoria permanente",
  category: "productivity",
  forProfiles: ["young", "adult", "senior"],
  keywords: ["recordar", "olvidar", "acuerdo", "dato", "informacion", "fact"],

  buildTools: (ctx) => ({
    save_fact: tool({
      description:
        "Guarda un hecho importante sobre el usuario en su memoria permanente. " +
        "Úsalo cuando el usuario comparta información personal relevante como " +
        "nombres de familiares, preferencias, fechas importantes, o cualquier " +
        "dato que sea útil recordar en futuras conversaciones.",
      parameters: z.object({
        content: z
          .string()
          .describe("El hecho a guardar, escrito de forma clara y concisa"),
        category: z
          .string()
          .describe("Categoria: personal, relationship, work, preference, goal, reminder, other"),
        importance: z
          .number()
          .min(0.1)
          .max(1.0)
          .default(0.5)
          .describe(
            "Importancia del hecho (0.1 = poco importante, 1.0 = muy importante)",
          ),
      }),
      execute: async ({ content, category, importance }) => {
        try {
          const { embedding } = await embedText(content);

          await saveMemoryFact({
            userId: ctx.user.id,
            content,
            category: category as MemoryCategory,
            importance,
            embedding,
          });

          return { success: true, saved: content };
        } catch (error) {
          return { success: false, error: "No se pudo guardar el hecho" };
        }
      },
    }),
  }),

  promptInstructions: [
    "- save_fact: Guarda hechos permanentes del usuario (nombre de familiares, preferencias, alergias, gustos).",
    "  Usa save_fact PROACTIVAMENTE cuando el usuario comparta info personal. NO lo uses para cumpleanos (usa birthdays), contactos (usa contacts), ni medicamentos (usa health).",
    "  Importancia: 0.9 critico, 0.5 preferencias, 0.3 datos casuales.",
  ],
};
