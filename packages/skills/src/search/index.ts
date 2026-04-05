import { tool } from "ai";
import { z } from "zod";
import type { SkillDefinition } from "../base-skill.js";

export const searchSkill: SkillDefinition = {
  name: "search",
  description: "Busqueda web actualizada via Brave Search",
  category: "search",
  forProfiles: ["young", "adult", "senior"],
  requiredEnv: ["BRAVE_SEARCH_API_KEY"],

  buildTools: () => ({
    web_search: tool({
      description:
        "Busca informacion actualizada en internet. " +
        "Usalo cuando el usuario pregunte sobre eventos actuales, precios, " +
        "noticias, o cualquier informacion que pueda haber cambiado recientemente.",
      parameters: z.object({
        query: z.string().describe("La consulta de busqueda"),
      }),
      execute: async ({ query }) => {
        const apiKey = process.env.BRAVE_SEARCH_API_KEY;
        if (!apiKey) {
          return {
            success: false,
            error: "Busqueda web no disponible en este momento",
          };
        }

        try {
          const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=5&text_decorations=false`;
          const response = await fetch(url, {
            headers: {
              Accept: "application/json",
              "Accept-Encoding": "gzip",
              "X-Subscription-Token": apiKey,
            },
          });

          if (!response.ok) {
            return { success: false, error: "Error en la busqueda" };
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
            data.web?.results.slice(0, 4).map((r) => ({
              title: r.title,
              snippet: r.description,
              url: r.url,
            })) ?? [];

          return { success: true, query, results };
        } catch (error) {
          return { success: false, error: "Error al buscar en internet" };
        }
      },
    }),
  }),

  promptInstructions: [
    "- web_search: Busca informacion actualizada en internet cuando necesites datos recientes.",
  ],
};
