import { tool } from "ai";
import { z } from "zod";
import type { SkillDefinition } from "../base-skill.js";
import { getUserNotes } from "@evva/database";

export const recipesSkill: SkillDefinition = {
  name: "recipes",
  description:
    "Sugiere recetas basadas en los ingredientes disponibles del usuario",
  category: "utility",
  forProfiles: ["young", "adult", "senior"],

  buildTools: (ctx) => ({
    suggest_recipes: tool({
      description:
        "Sugiere recetas basadas en ingredientes disponibles. " +
        "Puede leer la lista del super o de ingredientes del usuario, " +
        "o recibir ingredientes directamente. " +
        'Usalo cuando diga "que puedo cocinar", "que hago de comer", ' +
        '"dame una receta con...".',
      parameters: z.object({
        ingredients: z
          .array(z.string())
          .optional()
          .describe(
            "Lista de ingredientes disponibles (si no se dan, busca en las notas del usuario)",
          ),
        cuisine: z
          .string()
          .optional()
          .describe(
            "Tipo de cocina preferida (mexicana, italiana, asiatica, etc.)",
          ),
        dietary: z
          .string()
          .optional()
          .describe(
            "Restricciones alimentarias (vegetariano, sin gluten, etc.)",
          ),
        max_time: z
          .number()
          .optional()
          .describe("Tiempo maximo de preparacion en minutos"),
        servings: z
          .number()
          .default(2)
          .describe("Numero de porciones"),
      }),
      execute: async ({ ingredients, cuisine, dietary, max_time, servings }) => {
        try {
          let availableIngredients = ingredients ?? [];

          // Si no se dieron ingredientes, buscar en las listas del usuario
          if (availableIngredients.length === 0) {
            const notes = await getUserNotes(ctx.user.id);
            const groceryLists = notes.filter(
              (n) =>
                n.isList &&
                (n.title.toLowerCase().includes("super") ||
                  n.title.toLowerCase().includes("compras") ||
                  n.title.toLowerCase().includes("ingredientes") ||
                  n.title.toLowerCase().includes("despensa") ||
                  n.title.toLowerCase().includes("grocery")),
            );

            if (groceryLists.length > 0) {
              // Tomar items no tachados de las listas
              for (const list of groceryLists) {
                const items = (list.items ?? [])
                  .filter((i) => !i.checked)
                  .map((i) => i.text);
                availableIngredients.push(...items);
              }
            }
          }

          return {
            success: true,
            ingredients: availableIngredients,
            cuisine: cuisine ?? "cualquiera",
            dietary: dietary ?? "sin restricciones",
            maxTime: max_time,
            servings,
            instruction:
              availableIngredients.length > 0
                ? `Sugiere 2-3 recetas que se puedan hacer con estos ingredientes: ${availableIngredients.join(", ")}. ` +
                  `Cocina: ${cuisine ?? "cualquiera"}. ` +
                  `Restricciones: ${dietary ?? "ninguna"}. ` +
                  `${max_time ? `Tiempo maximo: ${max_time} minutos. ` : ""}` +
                  `Porciones: ${servings}. ` +
                  `Para cada receta incluye: nombre, ingredientes necesarios (marcando cuales ya tiene), pasos breves y tiempo estimado.`
                : "El usuario quiere sugerencias de recetas pero no tiene listas de ingredientes guardadas. " +
                  "Preguntale que ingredientes tiene disponibles o que tipo de comida quiere preparar.",
          };
        } catch (error) {
          return {
            success: false,
            error: "No se pudieron buscar ingredientes para recetas",
          };
        }
      },
    }),
  }),

  promptInstructions: [
    "- suggest_recipes: Sugiere recetas basadas en los ingredientes del usuario. Lee automaticamente su lista del super si tiene una.",
    '  Usalo cuando diga "que cocino", "que hago de comer", "dame una receta", etc.',
  ],
};
