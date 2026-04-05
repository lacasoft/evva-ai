import { tool } from "ai";
import { z } from "zod";
import type { SkillDefinition } from "../base-skill.js";

export const exchangeSkill: SkillDefinition = {
  name: "exchange",
  description: "Consulta tipos de cambio y convierte entre divisas.",
  category: "utility",
  forProfiles: ["young", "adult"],

  buildTools: () => ({
    calculate_exchange_rate: tool({
      description:
        "Obtiene el tipo de cambio actual entre divisas. Úsalo cuando pregunten por tipo de cambio, conversión de moneda, o cuánto vale el dólar.",
      parameters: z.object({
        from: z
          .string()
          .default("USD")
          .describe("Moneda origen (código ISO: USD, EUR, MXN, etc.)"),
        to: z.string().default("MXN").describe("Moneda destino"),
        amount: z.number().default(1).describe("Cantidad a convertir"),
      }),
      execute: async ({ from, to, amount }) => {
        try {
          const response = await fetch(
            `https://api.exchangerate-api.com/v4/latest/${from.toUpperCase()}`,
          );
          if (!response.ok) {
            return {
              success: false,
              error: "No se pudo obtener el tipo de cambio",
            };
          }
          const data = (await response.json()) as {
            rates: Record<string, number>;
          };
          const rate = data.rates[to.toUpperCase()];
          if (!rate) {
            return {
              success: false,
              error: `No se encontró la moneda ${to}`,
            };
          }
          return {
            success: true,
            from: from.toUpperCase(),
            to: to.toUpperCase(),
            rate,
            amount,
            result: Math.round(amount * rate * 100) / 100,
          };
        } catch {
          return {
            success: false,
            error: "Error al consultar tipo de cambio",
          };
        }
      },
    }),
  }),

  promptInstructions: [
    "Puedes consultar tipos de cambio entre divisas con calculate_exchange_rate.",
  ],
};
