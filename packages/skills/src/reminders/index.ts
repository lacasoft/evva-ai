import { tool } from "ai";
import { z } from "zod";
import type { SkillDefinition } from "../base-skill.js";

export const remindersSkill: SkillDefinition = {
  name: "reminders",
  description:
    "Programa recordatorios para enviar al usuario en un momento específico",
  category: "productivity",
  forProfiles: ["young", "adult", "senior"],

  buildTools: (ctx) => ({
    create_reminder: tool({
      description:
        "Programa un recordatorio para enviarle un mensaje al usuario en un momento específico. " +
        "Úsalo cuando el usuario pida que le recuerdes algo.",
      parameters: z.object({
        message: z
          .string()
          .describe("El mensaje del recordatorio que se enviará al usuario"),
        trigger_at: z
          .string()
          .describe(
            "Fecha y hora del recordatorio en formato ISO 8601 (ej: 2026-04-05T08:00:00)",
          ),
        context: z
          .string()
          .optional()
          .describe("Contexto adicional para el recordatorio"),
      }),
      execute: async ({ message, trigger_at, context }) => {
        // Reminders require the SchedulerService from the gateway.
        // This skill currently serves as a placeholder until gateway
        // integration passes a scheduleReminder function through the context.
        return {
          success: false,
          error: "Reminders require gateway integration",
        };
      },
    }),
  }),

  promptInstructions: [
    "- create_reminder: Programa un recordatorio para una fecha y hora específica",
  ],
};
