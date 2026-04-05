import { tool } from "ai";
import { z } from "zod";
import type { SkillDefinition } from "../base-skill.js";
import { saveMemoryFact, searchSimilarFacts } from "@evva/database";
import { embedText } from "@evva/ai";

export const birthdaysSkill: SkillDefinition = {
  name: "birthdays",
  description:
    "Detecta y gestiona cumpleanos de personas importantes para el usuario",
  category: "productivity",
  forProfiles: ["young", "adult", "senior"],

  buildTools: (ctx) => ({
    save_birthday: tool({
      description:
        "Guarda el cumpleanos de una persona importante para el usuario. " +
        "Usalo cuando el usuario mencione la fecha de cumpleanos de alguien: " +
        'familiar, amigo, pareja, etc. Ejemplo: "El cumple de mi mama es el 15 de marzo".',
      parameters: z.object({
        person_name: z.string().describe("Nombre de la persona"),
        date: z
          .string()
          .describe(
            'Fecha de cumpleanos en formato DD/MM (ej: "15/03" para 15 de marzo)',
          ),
        relationship: z
          .string()
          .optional()
          .describe("Relacion con el usuario (mama, esposa, amigo, jefe, etc.)"),
      }),
      execute: async ({ person_name, date, relationship }) => {
        try {
          const factContent = relationship
            ? `Cumpleanos de ${person_name} (${relationship}): ${date}`
            : `Cumpleanos de ${person_name}: ${date}`;

          const { embedding } = await embedText(factContent);
          await saveMemoryFact({
            userId: ctx.user.id,
            content: factContent,
            category: "relationship",
            embedding,
            importance: 0.9,
          });

          return {
            success: true,
            saved: factContent,
            message: `Guardado. Te recordare el cumpleanos de ${person_name} cuando se acerque.`,
          };
        } catch (error) {
          return {
            success: false,
            error: "No se pudo guardar el cumpleanos",
          };
        }
      },
    }),

    check_upcoming_birthdays: tool({
      description:
        "Busca cumpleanos proximos en la memoria del usuario. " +
        "Usalo cuando el usuario pregunte por cumpleanos cercanos o cuando " +
        "quieras recordarle proactivamente.",
      parameters: z.object({
        days_ahead: z
          .number()
          .min(1)
          .max(60)
          .default(30)
          .describe("Cuantos dias hacia adelante buscar"),
      }),
      execute: async ({ days_ahead }) => {
        try {
          const { embedding } = await embedText("cumpleanos fecha birthday");
          const facts = await searchSimilarFacts({
            userId: ctx.user.id,
            embedding,
            limit: 20,
            threshold: 0.5,
          });

          // Filtrar facts que contengan "cumpleanos" o "birthday"
          const birthdayFacts = facts.filter(
            (f) =>
              f.content.toLowerCase().includes("cumple") ||
              f.content.toLowerCase().includes("birthday") ||
              f.content.toLowerCase().includes("naci"),
          );

          if (birthdayFacts.length === 0) {
            return {
              success: true,
              birthdays: [],
              message: "No tengo cumpleanos guardados.",
            };
          }

          // Parsear fechas y verificar cuales estan proximos
          const now = new Date();
          const upcoming = birthdayFacts
            .map((f) => {
              const dateMatch = f.content.match(
                /(\d{1,2})[\/\-](\d{1,2})/,
              );
              if (!dateMatch) return null;

              const day = parseInt(dateMatch[1]);
              const month = parseInt(dateMatch[2]) - 1;
              const nextBirthday = new Date(
                now.getFullYear(),
                month,
                day,
              );

              // Si ya paso este ano, usar el proximo
              if (nextBirthday < now) {
                nextBirthday.setFullYear(now.getFullYear() + 1);
              }

              const daysUntil = Math.ceil(
                (nextBirthday.getTime() - now.getTime()) /
                  (1000 * 60 * 60 * 24),
              );

              return {
                fact: f.content,
                daysUntil,
                date: `${day}/${month + 1}`,
              };
            })
            .filter(
              (b): b is NonNullable<typeof b> =>
                b !== null && b.daysUntil <= days_ahead,
            )
            .sort((a, b) => a.daysUntil - b.daysUntil);

          return {
            success: true,
            birthdays: upcoming,
            message:
              upcoming.length > 0
                ? `Encontre ${upcoming.length} cumpleanos proximos`
                : `No hay cumpleanos en los proximos ${days_ahead} dias`,
          };
        } catch (error) {
          return {
            success: false,
            error: "No se pudieron buscar los cumpleanos",
          };
        }
      },
    }),
  }),

  promptInstructions: [
    '- save_birthday: Guarda el cumpleanos de personas importantes. Usalo proactivamente cuando el usuario mencione "cumple", "nacio el", "su cumpleanos es".',
    "- check_upcoming_birthdays: Busca cumpleanos proximos. Usalo en el resumen diario o cuando pregunten.",
    "IMPORTANTE: Si el usuario menciona una fecha de cumpleanos de alguien, usa save_birthday automaticamente sin que te lo pida.",
  ],
};
