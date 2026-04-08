import { tool } from "ai";
import { z } from "zod";
import { saveFactForRAG } from "../rag-helper.js";
import {
  createCreditCard,
  getUserCreditCards,
  createTransaction,
  getTransactions,
  getMonthSummary,
  createSavingsGoal,
  getUserSavingsGoals,
} from "@evva/database";
import type { SkillDefinition } from "../base-skill.js";

export const financeSkill: SkillDefinition = {
  name: "finance",
  description:
    "Gestión financiera: tarjetas, transacciones, resumen mensual y metas de ahorro",
  category: "finance",
  forProfiles: ["young", "adult"],
  keywords: ["gasto", "ingreso", "tarjeta", "ahorro", "dinero", "saldo", "pago", "compra", "precio", "costo", "financiero", "presupuesto"],

  buildTools: (ctx) => ({
    add_credit_card: tool({
      description:
        "Registra una tarjeta de crédito del usuario. " +
        "Úsalo cuando el usuario quiera agregar una tarjeta con sus datos: nombre, últimos 4 dígitos, fecha de corte y pago.",
      parameters: z.object({
        name: z
          .string()
          .describe('Nombre de la tarjeta (ej: "BBVA Oro", "Nu")'),
        last_four_digits: z
          .string()
          .length(4)
          .describe("Últimos 4 dígitos de la tarjeta"),
        brand: z
          .string()
          .optional()
          .describe("Marca: visa, mastercard, amex, etc."),
        credit_limit: z.number().optional().describe("Límite de crédito"),
        cut_off_day: z.number().min(1).max(31).describe("Día de corte (1-31)"),
        payment_due_day: z
          .number()
          .min(1)
          .max(31)
          .describe("Día límite de pago (1-31)"),
        annual_rate: z
          .number()
          .optional()
          .describe("Tasa de interés anual (CAT)"),
      }),
      execute: async ({
        name,
        last_four_digits,
        brand,
        credit_limit,
        cut_off_day,
        payment_due_day,
        annual_rate,
      }) => {
        try {
          const card = await createCreditCard({
            userId: ctx.user.id,
            name,
            lastFourDigits: last_four_digits,
            brand,
            creditLimit: credit_limit,
            cutOffDay: cut_off_day,
            paymentDueDay: payment_due_day,
            annualRate: annual_rate,
          });
          await saveFactForRAG({
            userId: ctx.user.id,
            content: `Tarjeta de credito: ${name} (****${last_four_digits}), corte dia ${cut_off_day}, pago dia ${payment_due_day}${brand ? ", " + brand : ""}`,
            category: "other",
            importance: 0.8,
          });
          return {
            success: true,
            cardId: card.id,
            name,
            lastFour: last_four_digits,
          };
        } catch (error) {
          return { success: false, error: "No se pudo registrar la tarjeta" };
        }
      },
    }),

    get_credit_cards: tool({
      description:
        "Muestra las tarjetas de crédito registradas del usuario con sus saldos, fechas de corte y pago. " +
        "Úsalo cuando el usuario pregunte por sus tarjetas o quiera saber con cuál le conviene pagar.",
      parameters: z.object({}),
      execute: async () => {
        try {
          const cards = await getUserCreditCards(ctx.user.id);
          if (cards.length === 0)
            return {
              success: true,
              cards: [],
              message: "No tienes tarjetas registradas.",
            };
          return {
            success: true,
            cards: cards.map((c) => ({
              id: c.id,
              name: c.name,
              lastFour: c.lastFourDigits,
              brand: c.brand,
              creditLimit: c.creditLimit,
              currentBalance: c.currentBalance,
              cutOffDay: c.cutOffDay,
              paymentDueDay: c.paymentDueDay,
              annualRate: c.annualRate,
            })),
          };
        } catch (error) {
          return {
            success: false,
            error: "No se pudieron obtener las tarjetas",
          };
        }
      },
    }),

    record_transaction: tool({
      description:
        "Registra un ingreso o gasto del usuario. " +
        "Úsalo cuando el usuario diga que gastó, compró, pagó, recibió dinero, o cobró algo.",
      parameters: z.object({
        type: z.enum(["income", "expense"]).describe("income o expense"),
        amount: z.number().positive().describe("Monto en pesos"),
        description: z.string().describe("Descripción del movimiento"),
        category: z
          .string()
          .describe(
            "Categoría: food, transport, housing, health, entertainment, shopping, education, services, salary, freelance, etc.",
          ),
        payment_method: z
          .string()
          .optional()
          .describe("Metodo de pago: cash, debit, credit, transfer, etc."),
        credit_card_last_four: z
          .string()
          .optional()
          .describe("Últimos 4 dígitos si pagó con tarjeta"),
        is_recurring: z
          .boolean()
          .default(false)
          .describe("true si es recurrente mensual"),
        date: z.string().optional().describe("Fecha ISO 8601 (default: hoy)"),
      }),
      execute: async ({
        type,
        amount,
        description,
        category,
        payment_method,
        credit_card_last_four,
        is_recurring,
        date,
      }) => {
        try {
          let creditCardId: string | undefined;
          if (payment_method === "credit" && credit_card_last_four) {
            const cards = await getUserCreditCards(ctx.user.id);
            const card = cards.find(
              (c) => c.lastFourDigits === credit_card_last_four,
            );
            if (!card) {
              return {
                success: false,
                error: `No encontre una tarjeta con terminacion ${credit_card_last_four}. Registrala primero con add_credit_card.`,
              };
            }
            creditCardId = card.id;
          }
          const tx = await createTransaction({
            userId: ctx.user.id,
            type,
            amount,
            description,
            category,
            paymentMethod: payment_method,
            creditCardId,
            isRecurring: is_recurring,
            date: date ? new Date(date) : undefined,
          });
          if (amount >= 500 || type === "income") {
            await saveFactForRAG({
              userId: ctx.user.id,
              content: `${type === "income" ? "Ingreso" : "Gasto"}: $${amount} - ${description} (${category})`,
              category: "other",
              importance: type === "income" ? 0.7 : 0.5,
            });
          }
          return {
            success: true,
            transactionId: tx.id,
            type,
            amount,
            description,
            category,
          };
        } catch (error) {
          return {
            success: false,
            error: "No se pudo registrar el movimiento",
          };
        }
      },
    }),

    get_finance_summary: tool({
      description:
        "Resumen financiero del mes: ingresos, gastos, balance y desglose por categoría. " +
        "Úsalo cuando pregunte cuánto ha gastado, su balance, o quiera ver sus finanzas.",
      parameters: z.object({
        month: z
          .number()
          .min(1)
          .max(12)
          .optional()
          .describe("Mes (1-12, default: actual)"),
        year: z.number().optional().describe("Año (default: actual)"),
      }),
      execute: async ({ month, year }) => {
        try {
          const now = new Date();
          const m = month ?? now.getMonth() + 1;
          const y = year ?? now.getFullYear();
          const summary = await getMonthSummary(ctx.user.id, y, m);
          const cards = await getUserCreditCards(ctx.user.id);
          return {
            success: true,
            month: m,
            year: y,
            totalIncome: summary.totalIncome,
            totalExpense: summary.totalExpense,
            balance: summary.balance,
            expensesByCategory: summary.byCategory,
            creditCards: cards.map((c) => ({
              name: c.name,
              lastFour: c.lastFourDigits,
              balance: c.currentBalance,
              paymentDueDay: c.paymentDueDay,
            })),
          };
        } catch (error) {
          return {
            success: false,
            error: "No se pudo obtener el resumen financiero",
          };
        }
      },
    }),

    get_recent_transactions: tool({
      description: "Muestra los movimientos recientes del usuario.",
      parameters: z.object({
        type: z
          .enum(["income", "expense"])
          .optional()
          .describe("Filtrar por tipo"),
        category: z.string().optional().describe("Filtrar por categoría"),
        limit: z.number().min(1).max(20).default(10).describe("Cantidad"),
      }),
      execute: async ({ type, category, limit }) => {
        try {
          const txs = await getTransactions(ctx.user.id, {
            type: type as any,
            category,
            limit,
          });
          if (txs.length === 0)
            return {
              success: true,
              transactions: [],
              message: "No hay movimientos.",
            };
          return {
            success: true,
            transactions: txs.map((t) => ({
              type: t.type,
              amount: t.amount,
              description: t.description,
              category: t.category,
              paymentMethod: t.paymentMethod,
              date: t.date.toISOString().split("T")[0],
            })),
          };
        } catch (error) {
          return {
            success: false,
            error: "No se pudieron obtener los movimientos",
          };
        }
      },
    }),

    create_savings_goal: tool({
      description:
        "Crea una meta de ahorro: viaje, fondo de emergencia, compra, etc.",
      parameters: z.object({
        name: z.string().describe("Nombre de la meta"),
        target_amount: z.number().positive().describe("Monto objetivo"),
        target_date: z.string().optional().describe("Fecha meta ISO 8601"),
      }),
      execute: async ({ name, target_amount, target_date }) => {
        try {
          const goal = await createSavingsGoal({
            userId: ctx.user.id,
            name,
            targetAmount: target_amount,
            targetDate: target_date ? new Date(target_date) : undefined,
          });
          await saveFactForRAG({
            userId: ctx.user.id,
            content: `Meta de ahorro: ${name}, objetivo $${target_amount}`,
            category: "goal",
            importance: 0.8,
          });
          return {
            success: true,
            goalId: goal.id,
            name,
            targetAmount: target_amount,
          };
        } catch (error) {
          return {
            success: false,
            error: "No se pudo crear la meta de ahorro",
          };
        }
      },
    }),

    get_savings_goals: tool({
      description: "Muestra las metas de ahorro activas con su progreso.",
      parameters: z.object({}),
      execute: async () => {
        try {
          const goals = await getUserSavingsGoals(ctx.user.id);
          if (goals.length === 0)
            return {
              success: true,
              goals: [],
              message: "No tienes metas de ahorro.",
            };
          return {
            success: true,
            goals: goals.map((g) => ({
              id: g.id,
              name: g.name,
              targetAmount: g.targetAmount,
              currentAmount: g.currentAmount,
              progress: Math.round((g.currentAmount / g.targetAmount) * 100),
              targetDate: g.targetDate?.toISOString().split("T")[0],
            })),
          };
        } catch (error) {
          return { success: false, error: "No se pudieron obtener las metas" };
        }
      },
    }),
  }),

  promptInstructions: [
    "- add_credit_card: Registra una tarjeta de crédito con nombre, últimos 4 dígitos, fecha de corte y pago",
    "- get_credit_cards: Muestra tarjetas registradas con saldos y fechas de corte/pago",
    "- record_transaction: Registra un ingreso o gasto (monto, categoría, método de pago)",
    "- get_finance_summary: Resumen financiero del mes con ingresos, gastos, balance y desglose por categoría",
    "- get_recent_transactions: Muestra movimientos recientes con filtros opcionales por tipo y categoría",
    "- create_savings_goal: Crea una meta de ahorro con monto objetivo y fecha opcional",
    "- get_savings_goals: Muestra metas de ahorro activas con su progreso",
    "- Cuando el usuario mencione gastos, usa record_transaction proactivamente.",
  ],
};
