import { tool } from "ai";
import { z } from "zod";
import type { SkillDefinition } from "../base-skill.js";

export const weatherSkill: SkillDefinition = {
  name: "weather",
  description: "Consulta el clima actual de cualquier ciudad.",
  category: "utility",
  forProfiles: ["young", "adult", "senior"],

  buildTools: () => ({
    get_weather: tool({
      description: "Obtiene el clima actual de una ciudad.",
      parameters: z.object({
        city: z.string().describe("El nombre de la ciudad"),
        country: z
          .string()
          .optional()
          .describe("El código de país (ej: MX, US, ES)"),
      }),
      execute: async ({ city, country }) => {
        try {
          const location = country ? `${city},${country}` : city;
          const url = `https://wttr.in/${encodeURIComponent(location)}?format=j1`;

          const response = await fetch(url, {
            headers: { Accept: "application/json" },
          });

          if (!response.ok) {
            return {
              success: false,
              error: "No se pudo obtener el clima",
            };
          }

          const data = (await response.json()) as {
            current_condition: Array<{
              temp_C: string;
              FeelsLikeC: string;
              weatherDesc: Array<{ value: string }>;
              humidity: string;
              windspeedKmph: string;
            }>;
            nearest_area: Array<{
              areaName: Array<{ value: string }>;
              country: Array<{ value: string }>;
            }>;
          };

          const current = data.current_condition[0];
          const area = data.nearest_area[0];

          return {
            success: true,
            city: area.areaName[0].value,
            country: area.country[0].value,
            temperature: `${current.temp_C}°C`,
            feelsLike: `${current.FeelsLikeC}°C`,
            description: current.weatherDesc[0].value,
            humidity: `${current.humidity}%`,
            wind: `${current.windspeedKmph} km/h`,
          };
        } catch {
          return {
            success: false,
            error: "No se pudo obtener el clima",
          };
        }
      },
    }),
  }),

  promptInstructions: [
    "Puedes consultar el clima actual de cualquier ciudad usando get_weather.",
  ],
};
