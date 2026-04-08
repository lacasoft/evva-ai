import { tool } from "ai";
import { z } from "zod";
import { saveFactForRAG } from "../rag-helper.js";
import {
  createMedication,
  getUserMedications,
  updateMedication,
  createHabit,
  getUserHabits,
  logHabit,
  getTodayProgress,
} from "@evva/database";
import type { SkillDefinition } from "../base-skill.js";

export const healthSkill: SkillDefinition = {
  name: "health",
  description: "Seguimiento de medicamentos y hábitos de salud diarios",
  category: "health",
  forProfiles: ["adult", "senior"],
  keywords: ["medicamento", "medicina", "pastilla", "habito", "salud", "doctor", "tratamiento", "ejercicio", "agua", "meditacion"],

  buildTools: (ctx) => ({
    add_medication: tool({
      description:
        "Registra un medicamento que el usuario toma regularmente. Úsalo cuando diga que toma alguna medicina, pastilla o tratamiento.",
      parameters: z.object({
        name: z
          .string()
          .describe('Nombre del medicamento (ej: "Metformina 500mg")'),
        dosage: z
          .string()
          .optional()
          .describe('Dosis (ej: "1 pastilla", "10ml")'),
        frequency: z
          .string()
          .default("daily")
          .describe("Frecuencia: daily, twice_daily, three_times, weekly, monthly, as_needed"),
        times: z
          .array(z.string())
          .optional()
          .default([])
          .describe('Horas de toma en formato HH:MM (ej: ["08:00", "20:00"])'),
        notes: z
          .string()
          .optional()
          .describe('Notas (ej: "Tomar con alimentos")'),
      }),
      execute: async ({ name, dosage, frequency, times, notes }) => {
        try {
          const med = await createMedication({
            userId: ctx.user.id,
            name,
            dosage,
            frequency,
            times,
            notes,
          });
          await saveFactForRAG({
            userId: ctx.user.id,
            content: `Medicamento: ${name}${dosage ? ", dosis: " + dosage : ""}, frecuencia: ${frequency}, horarios: ${times.join(", ")}`,
            category: "personal",
            importance: 0.9,
          });
          return { success: true, medicationId: med.id, name, times };
        } catch (error) {
          return {
            success: false,
            error: "No se pudo registrar el medicamento",
          };
        }
      },
    }),

    get_medications: tool({
      description:
        "Muestra los medicamentos activos del usuario. Úsalo cuando pregunte por sus medicinas o tratamiento.",
      parameters: z.object({}),
      execute: async () => {
        try {
          const meds = await getUserMedications(ctx.user.id);
          if (meds.length === 0)
            return {
              success: true,
              medications: [],
              message: "No tienes medicamentos registrados.",
            };
          return {
            success: true,
            medications: meds.map((m) => ({
              id: m.id,
              name: m.name,
              dosage: m.dosage,
              frequency: m.frequency,
              times: m.times,
              notes: m.notes,
            })),
          };
        } catch (error) {
          return {
            success: false,
            error: "No se pudieron obtener los medicamentos",
          };
        }
      },
    }),

    create_habit: tool({
      description:
        "Crea un hábito para trackear diariamente. Úsalo cuando el usuario quiera llevar control de agua, ejercicio, lectura, etc.",
      parameters: z.object({
        name: z
          .string()
          .describe('Nombre del hábito (ej: "Tomar agua", "Ejercicio")'),
        target_per_day: z
          .number()
          .min(1)
          .default(1)
          .describe("Meta diaria (ej: 8 vasos, 30 minutos)"),
        unit: z
          .string()
          .optional()
          .describe('Unidad (ej: "vasos", "minutos", "veces")'),
      }),
      execute: async ({ name, target_per_day, unit }) => {
        try {
          const habit = await createHabit({
            userId: ctx.user.id,
            name,
            targetPerDay: target_per_day,
            unit,
          });
          await saveFactForRAG({
            userId: ctx.user.id,
            content: `Habito: ${name}, meta diaria: ${target_per_day}${unit ? " " + unit : ""}`,
            category: "goal",
            importance: 0.7,
          });
          return {
            success: true,
            habitId: habit.id,
            name,
            target: target_per_day,
            unit,
          };
        } catch (error) {
          return { success: false, error: "No se pudo crear el hábito" };
        }
      },
    }),

    log_habit: tool({
      description:
        'Registra progreso en un hábito. Úsalo cuando el usuario diga "ya tomé agua", "hice ejercicio", "ya medité", etc.',
      parameters: z.object({
        habit_name: z.string().describe("Nombre del hábito"),
        count: z.number().min(1).default(1).describe("Cantidad a registrar"),
      }),
      execute: async ({ habit_name, count }) => {
        try {
          const habits = await getUserHabits(ctx.user.id);
          const habit = habits.find((h) =>
            h.name.toLowerCase().includes(habit_name.toLowerCase()),
          );
          if (!habit)
            return {
              success: false,
              error: `No encontré un hábito llamado "${habit_name}"`,
            };
          const today = new Date().toLocaleDateString("en-CA", {
            timeZone: ctx.user.timezone,
          });
          await logHabit(habit.id, ctx.user.id, today, count);
          return {
            success: true,
            habit: habit.name,
            logged: count,
            unit: habit.unit,
          };
        } catch (error) {
          return { success: false, error: "No se pudo registrar el progreso" };
        }
      },
    }),

    get_habit_progress: tool({
      description:
        'Muestra el progreso de los hábitos del día. Úsalo cuando pregunte "¿cómo voy con mis hábitos?" o "¿ya tomé agua hoy?".',
      parameters: z.object({}),
      execute: async () => {
        try {
          const progress = await getTodayProgress(ctx.user.id);
          if (progress.length === 0)
            return {
              success: true,
              habits: [],
              message: "No tienes hábitos configurados.",
            };
          return {
            success: true,
            habits: progress.map((p) => ({
              name: p.habit.name,
              logged: p.logged,
              target: p.target,
              unit: p.habit.unit,
              completed: p.logged >= p.target,
            })),
          };
        } catch (error) {
          return { success: false, error: "No se pudo obtener el progreso" };
        }
      },
    }),
  }),

  promptInstructions: [
    "- add_medication: Registra medicamento con nombre, dosis, frecuencia y horas de toma.",
    "- get_medications: Muestra medicamentos activos del usuario.",
    "- create_habit: Crea habito para trackear diariamente (agua, ejercicio, lectura).",
    "- log_habit: Registra progreso en un habito. Usalo proactivamente cuando diga 'ya tome agua', 'hice ejercicio'.",
    "- get_habit_progress: Muestra progreso de todos los habitos del dia.",
    "  Despues de registrar un medicamento con horarios, ofrece crear recordatorios con create_reminder.",
  ],
};
