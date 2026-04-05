import { tool } from "ai";
import { z } from "zod";
import type { SkillDefinition } from "../base-skill.js";

export const remindersSkill: SkillDefinition = {
  name: "reminders",
  description:
    "Programa recordatorios para enviar al usuario en un momento especifico",
  category: "productivity",
  forProfiles: ["young", "adult", "senior"],

  buildTools: (ctx) => ({
    create_reminder: tool({
      description:
        "Programa un recordatorio para enviarle un mensaje al usuario en un momento especifico. " +
        "Usalo cuando el usuario pida que le recuerdes algo. " +
        "Ejemplos: 'recuerdame en 10 minutos', 'avisame manana a las 9am'.",
      parameters: z.object({
        message: z
          .string()
          .describe("El mensaje del recordatorio que se enviara al usuario"),
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
        const scheduleReminder = ctx.services?.scheduleReminder;
        if (!scheduleReminder) {
          return {
            success: false,
            error: "El servicio de recordatorios no esta disponible",
          };
        }

        try {
          const triggerDate = new Date(trigger_at);
          if (isNaN(triggerDate.getTime())) {
            return { success: false, error: "Fecha invalida" };
          }

          if (triggerDate.getTime() <= Date.now()) {
            return {
              success: false,
              error: "No se puede programar un recordatorio en el pasado",
            };
          }

          const jobId = await scheduleReminder({
            userId: ctx.user.id,
            telegramId: ctx.user.telegramId,
            message,
            assistantName: ctx.assistant.name,
            triggerAt: triggerDate,
            additionalContext: context,
          });

          const formatted = triggerDate.toLocaleString("es-MX", {
            timeZone: ctx.user.timezone,
            weekday: "long",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          });

          return {
            success: true,
            jobId,
            scheduledFor: formatted,
          };
        } catch (error) {
          return {
            success: false,
            error: "No se pudo programar el recordatorio",
          };
        }
      },
    }),
  }),

  promptInstructions: [
    "- create_reminder: Programa un recordatorio para una fecha y hora especifica. Funciona con lenguaje natural.",
  ],
};
