import { tool } from "ai";
import { z } from "zod";
import type { SkillDefinition } from "../base-skill.js";
import { upsertPreferences } from "@evva/database";

export const briefingSkill: SkillDefinition = {
  name: "briefing",
  description:
    "Configura el resumen diario matutino con pendientes, notas y contexto del día.",
  category: "productivity",
  forProfiles: ["young", "adult", "senior"],
  keywords: ["resumen diario", "briefing", "resumen manana"],

  buildTools: (ctx) => ({
    configure_daily_briefing: tool({
      description:
        "Activa o configura el resumen diario matutino. " +
        "El asistente enviará un mensaje cada mañana con pendientes, notas y contexto del día. " +
        "Úsalo cuando el usuario pida activar el resumen diario o cambiar la hora.",
      parameters: z.object({
        enabled: z
          .boolean()
          .describe("true para activar, false para desactivar"),
        hour: z
          .number()
          .min(0)
          .max(23)
          .default(8)
          .describe("Hora del resumen (0-23, formato 24h, UTC)"),
        minute: z
          .number()
          .min(0)
          .max(59)
          .default(0)
          .describe("Minuto del resumen (0-59)"),
      }),
      execute: async ({ enabled, hour, minute }) => {
        try {
          await upsertPreferences(ctx.user.id, {
            dailyBriefingEnabled: enabled,
            dailyBriefingHour: hour,
            dailyBriefingMinute: minute,
          });
          const formatted = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
          return {
            success: true,
            enabled,
            time: formatted,
            message: enabled
              ? `Resumen diario activado a las ${formatted} (hora del usuario)`
              : "Resumen diario desactivado",
          };
        } catch {
          return {
            success: false,
            error: "No se pudo configurar el resumen diario",
          };
        }
      },
    }),
  }),

  promptInstructions: [
    "- configure_daily_briefing: Activa o configura el resumen diario matutino.",
    "  Usalo cuando diga 'resumen diario', 'quiero un briefing', 'mandame un resumen cada manana'.",
    "  Despues de activar, confirma la hora y describe que incluira: pendientes, calendario, clima, cumpleanos proximos.",
  ],
};
