import { tool } from "ai";
import { z } from "zod";
import type { SkillDefinition } from "../base-skill.js";
import { listEmails, getEmail, sendEmail, refreshGoogleToken } from "@evva/ai";
import { getOAuthToken, upsertOAuthToken } from "@evva/database";

export const gmailSkill: SkillDefinition = {
  name: "gmail",
  description: "Integración con Gmail: leer y enviar correos electrónicos.",
  category: "communication",
  forProfiles: ["young", "adult", "senior"],
  keywords: ["correo", "email", "mail", "gmail", "inbox", "enviar correo", "bandeja"],
  requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  requiresOAuth: "google",

  buildTools: (ctx) => {
    const getGoogleAccessToken = async (
      userId: string,
    ): Promise<string | null> => {
      const token = await getOAuthToken(userId, "google");
      if (!token) return null;

      if (token.expiresAt && token.expiresAt > new Date()) {
        return token.accessToken;
      }

      if (!token.refreshToken) return null;

      try {
        const refreshed = await refreshGoogleToken(token.refreshToken);
        const expiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);
        await upsertOAuthToken({
          userId,
          provider: "google",
          accessToken: refreshed.accessToken,
          expiresAt,
        });
        return refreshed.accessToken;
      } catch (err) {
        console.error(
          `[Gmail] Failed to refresh Google token for user ${userId}:`,
          err,
        );
        return null;
      }
    };

    return {
      list_emails: tool({
        description:
          "Lista los correos recientes del Gmail del usuario. " +
          "Úsalo cuando el usuario pregunte por sus correos, emails, o si le llegó algo.",
        parameters: z.object({
          query: z
            .string()
            .optional()
            .describe(
              'Filtro de búsqueda (ej: "from:amazon", "subject:factura")',
            ),
          unread_only: z
            .boolean()
            .default(false)
            .describe("Solo correos no leídos"),
          max_results: z
            .number()
            .min(1)
            .max(10)
            .default(5)
            .describe("Cantidad de correos a mostrar"),
        }),
        execute: async ({ query, unread_only, max_results }) => {
          try {
            const accessToken = await getGoogleAccessToken(ctx.user.id);
            if (!accessToken) {
              return {
                success: false,
                not_connected: true,
                error:
                  "No tienes Google conectado. Usa connect_google primero.",
              };
            }

            const emails = await listEmails(accessToken, {
              query,
              unreadOnly: unread_only,
              maxResults: max_results,
            });

            if (emails.length === 0) {
              return {
                success: true,
                emails: [],
                message: "No hay correos que coincidan.",
              };
            }

            return {
              success: true,
              emails: emails.map((e) => ({
                id: e.id,
                from: e.from,
                subject: e.subject,
                snippet: e.snippet,
                date: e.date,
                unread: e.isUnread,
              })),
            };
          } catch {
            return {
              success: false,
              error: "No se pudieron obtener los correos.",
            };
          }
        },
      }),

      read_email: tool({
        description:
          "Lee el contenido completo de un correo específico. " +
          "Úsalo después de list_emails cuando el usuario quiera ver el detalle de un correo.",
        parameters: z.object({
          email_id: z
            .string()
            .describe("ID del correo (obtenido de list_emails)"),
        }),
        execute: async ({ email_id }) => {
          try {
            const accessToken = await getGoogleAccessToken(ctx.user.id);
            if (!accessToken) {
              return {
                success: false,
                not_connected: true,
                error: "No tienes Google conectado.",
              };
            }

            const email = await getEmail(accessToken, email_id);
            if (!email) {
              return {
                success: false,
                error: "No se encontró el correo.",
              };
            }

            return {
              success: true,
              from: email.from,
              to: email.to,
              subject: email.subject,
              date: email.date,
              body: email.body,
            };
          } catch {
            return {
              success: false,
              error: "No se pudo leer el correo.",
            };
          }
        },
      }),

      send_email: tool({
        description:
          "Envía un correo electrónico desde el Gmail del usuario. " +
          "Úsalo cuando el usuario quiera enviar un email, responder un correo, o mandar un mensaje por correo.",
        parameters: z.object({
          to: z.string().describe("Email del destinatario"),
          subject: z.string().describe("Asunto del correo"),
          body: z.string().describe("Contenido del correo en texto plano"),
        }),
        execute: async ({ to, subject, body }) => {
          try {
            const accessToken = await getGoogleAccessToken(ctx.user.id);
            if (!accessToken) {
              return {
                success: false,
                not_connected: true,
                error:
                  "No tienes Google conectado. Usa connect_google primero.",
              };
            }

            const result = await sendEmail(accessToken, {
              to,
              subject,
              body,
            });
            return {
              success: true,
              messageId: result.id,
              to,
              subject,
            };
          } catch {
            return {
              success: false,
              error: "No se pudo enviar el correo.",
            };
          }
        },
      }),
    };
  },

  promptInstructions: [
    "- list_emails: Lista correos recientes del Gmail del usuario. Filtra por no leidos o busqueda.",
    "- read_email: Lee el contenido completo de un correo especifico.",
    "- send_email: Envia un correo desde el Gmail del usuario.",
    "  REGLA: Antes de enviar con send_email, muestra destinatario, asunto y contenido, y pide confirmacion.",
    "  Si Google no esta conectado, usa connect_google del skill calendar.",
    "  Al leer correos, propone acciones: recordatorios, notas, agendar citas.",
  ],
};
