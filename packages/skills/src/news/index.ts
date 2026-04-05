import { tool } from "ai";
import { z } from "zod";
import type { SkillDefinition } from "../base-skill.js";

export const newsSkill: SkillDefinition = {
  name: "news",
  description: "Busca y resume noticias relevantes usando Brave Search.",
  category: "search",
  forProfiles: ["young", "adult", "senior"],
  requiredEnv: ["BRAVE_SEARCH_API_KEY"],

  buildTools: () => ({
    summarize_news: tool({
      description:
        "Busca y resume las noticias más relevantes del momento. Úsalo cuando el usuario pregunte por noticias, qué está pasando, o quiera un resumen informativo.",
      parameters: z.object({
        topic: z
          .string()
          .optional()
          .describe('Tema específico (ej: "México", "tecnología", "deportes")'),
        count: z
          .number()
          .min(1)
          .max(5)
          .default(3)
          .describe("Cantidad de noticias"),
      }),
      execute: async ({ topic, count }) => {
        const apiKey = process.env.BRAVE_SEARCH_API_KEY;
        if (!apiKey) {
          return {
            success: false,
            error:
              "Búsqueda de noticias no disponible (falta BRAVE_SEARCH_API_KEY)",
          };
        }
        try {
          const query = topic
            ? `noticias ${topic} hoy`
            : "noticias importantes hoy México";
          const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}&freshness=pd&text_decorations=false`;
          const response = await fetch(url, {
            headers: {
              Accept: "application/json",
              "X-Subscription-Token": apiKey,
            },
          });
          if (!response.ok) {
            return { success: false, error: "Error buscando noticias" };
          }
          const data = (await response.json()) as {
            web?: {
              results: Array<{
                title: string;
                description: string;
                url: string;
              }>;
            };
          };
          const results =
            data.web?.results.slice(0, count).map((r) => ({
              title: r.title,
              snippet: r.description,
              url: r.url,
            })) ?? [];
          return {
            success: true,
            topic: topic ?? "general",
            news: results,
          };
        } catch {
          return {
            success: false,
            error: "Error al buscar noticias",
          };
        }
      },
    }),
  }),

  promptInstructions: [
    "Puedes buscar noticias actuales con summarize_news. Presenta los resultados de forma clara y resumida.",
  ],
};
