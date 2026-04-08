import { tool } from "ai";
import { z } from "zod";
import { createHash } from "node:crypto";
import type { SkillDefinition } from "../base-skill.js";
import {
  setFinanceSecret,
  getFinanceSecret,
  disableFinanceSecret,
} from "@evva/database";

function hashSecret(secret: string): string {
  return createHash("sha256").update(secret.trim().toLowerCase()).digest("hex");
}

export const financeSecuritySkill: SkillDefinition = {
  name: "finance-security",
  description: "Palabra secreta opcional para proteger operaciones financieras",
  category: "finance",
  forProfiles: ["young", "adult", "senior"],
  keywords: ["clave financiera", "proteger finanzas", "palabra secreta"],

  buildTools: (ctx) => ({
    set_finance_secret: tool({
      description:
        "Configura una palabra secreta para proteger las finanzas del usuario. " +
        "Usalo cuando el usuario quiera activar proteccion en sus datos financieros. " +
        "La palabra secreta se pedira antes de mostrar saldos, tarjetas, transacciones o metas de ahorro.",
      parameters: z.object({
        secret_word: z
          .string()
          .min(3)
          .describe("La palabra secreta elegida por el usuario"),
      }),
      execute: async ({ secret_word }) => {
        try {
          const hash = hashSecret(secret_word);
          await setFinanceSecret(ctx.user.id, hash);
          return {
            success: true,
            message:
              "Palabra secreta configurada. A partir de ahora te la pedire antes de mostrar informacion financiera.",
          };
        } catch {
          return {
            success: false,
            error: "No se pudo configurar la palabra secreta",
          };
        }
      },
    }),

    verify_finance_secret: tool({
      description:
        "Verifica la palabra secreta del usuario para desbloquear operaciones financieras. " +
        "SIEMPRE usa esta tool antes de ejecutar cualquier operacion financiera " +
        "(get_credit_cards, get_finance_summary, get_recent_transactions, record_transaction, get_savings_goals) " +
        "si el usuario tiene proteccion activada. " +
        "Si el usuario no ha configurado palabra secreta, retorna que no es necesaria.",
      parameters: z.object({
        secret_word: z
          .string()
          .describe("La palabra secreta proporcionada por el usuario"),
      }),
      execute: async ({ secret_word }) => {
        try {
          const secret = await getFinanceSecret(ctx.user.id);

          if (!secret || !secret.enabled) {
            return {
              success: true,
              verified: true,
              message: "No se requiere palabra secreta",
            };
          }

          const inputHash = hashSecret(secret_word);
          const verified = inputHash === secret.hash;

          return {
            success: true,
            verified,
            message: verified
              ? "Palabra secreta correcta. Acceso autorizado."
              : "Palabra secreta incorrecta. Intenta de nuevo.",
          };
        } catch {
          return { success: false, error: "Error al verificar" };
        }
      },
    }),

    check_finance_protection: tool({
      description:
        "Verifica si el usuario tiene proteccion financiera activada. " +
        "Usalo ANTES de cualquier operacion financiera para saber si necesitas pedir la palabra secreta.",
      parameters: z.object({}),
      execute: async () => {
        try {
          const secret = await getFinanceSecret(ctx.user.id);
          return {
            success: true,
            protected: secret?.enabled ?? false,
          };
        } catch {
          return { success: true, protected: false };
        }
      },
    }),

    disable_finance_secret: tool({
      description:
        "Desactiva la proteccion por palabra secreta de las finanzas. " +
        "Requiere verificar la palabra secreta actual antes de desactivar.",
      parameters: z.object({
        current_secret: z
          .string()
          .describe("La palabra secreta actual para confirmar desactivacion"),
      }),
      execute: async ({ current_secret }) => {
        try {
          const secret = await getFinanceSecret(ctx.user.id);
          if (!secret || !secret.enabled) {
            return {
              success: true,
              message: "No tienes proteccion financiera activada",
            };
          }

          const inputHash = hashSecret(current_secret);
          if (inputHash !== secret.hash) {
            return {
              success: false,
              error: "Palabra secreta incorrecta. No se puede desactivar.",
            };
          }

          await disableFinanceSecret(ctx.user.id);
          return {
            success: true,
            message: "Proteccion financiera desactivada",
          };
        } catch {
          return { success: false, error: "Error al desactivar" };
        }
      },
    }),
  }),

  promptInstructions: [
    "- set_finance_secret: Configura una palabra secreta para proteger datos financieros del usuario.",
    "- verify_finance_secret: Verifica la palabra secreta antes de mostrar datos financieros.",
    "- check_finance_protection: Verifica si el usuario tiene proteccion financiera activada.",
    "- disable_finance_secret: Desactiva la proteccion (requiere palabra secreta actual).",
    "REGLA: Antes de ejecutar CUALQUIER tool financiera (get_credit_cards, get_finance_summary, record_transaction, get_recent_transactions, get_savings_goals), primero llama check_finance_protection. Si esta protegido, pide la palabra secreta al usuario y verificala con verify_finance_secret antes de proceder.",
  ],
};
