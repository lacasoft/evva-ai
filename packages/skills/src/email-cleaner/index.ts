import { tool } from "ai";
import { z } from "zod";
import type { SkillDefinition } from "../base-skill.js";
import {
  listPromotionalEmails,
  getEmailUnsubscribeInfo,
  executeUnsubscribe,
  refreshGoogleToken,
} from "@evva/ai";
import { getOAuthToken, upsertOAuthToken } from "@evva/database";

export const emailCleanerSkill: SkillDefinition = {
  name: "email-cleaner",
  description:
    "Analiza correos promocionales y ejecuta desuscripciones automaticas",
  category: "communication",
  forProfiles: ["young", "adult"],
  requiresOAuth: "google",

  buildTools: (ctx) => {
    const getGoogleAccessToken = async (): Promise<string | null> => {
      const token = await getOAuthToken(ctx.user.id, "google");
      if (!token) return null;

      if (token.expiresAt && token.expiresAt > new Date()) {
        return token.accessToken;
      }

      if (!token.refreshToken) return null;

      try {
        const refreshed = await refreshGoogleToken(token.refreshToken);
        const expiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);
        await upsertOAuthToken({
          userId: ctx.user.id,
          provider: "google",
          accessToken: refreshed.accessToken,
          expiresAt,
        });
        return refreshed.accessToken;
      } catch (err) {
        console.error(
          `[EmailCleaner] Failed to refresh token: ${err}`,
        );
        return null;
      }
    };

    return {
      scan_promotional_emails: tool({
        description:
          "Escanea los correos promocionales y newsletters del usuario para encontrar " +
          "los que tienen opcion de desuscripcion. " +
          "Usalo cuando el usuario diga 'limpia mis correos', 'desuscribeme de todo', " +
          "'tengo mucho spam', 'quiero dejar de recibir newsletters'.",
        parameters: z.object({
          max_results: z
            .number()
            .min(1)
            .max(20)
            .default(10)
            .describe("Cantidad de correos a analizar"),
        }),
        execute: async ({ max_results }) => {
          try {
            const accessToken = await getGoogleAccessToken();
            if (!accessToken) {
              return {
                success: false,
                not_connected: true,
                error:
                  "No tienes Google conectado. Usa connect_google primero.",
              };
            }

            const promotionals = await listPromotionalEmails(
              accessToken,
              max_results,
            );

            if (promotionals.length === 0) {
              return {
                success: true,
                emails: [],
                message:
                  "No encontre correos promocionales con opcion de desuscripcion.",
              };
            }

            // Group by sender domain
            const bySender = new Map<string, typeof promotionals>();
            for (const email of promotionals) {
              const domain =
                email.from.match(/@([^>]+)/)?.[1] ?? email.from;
              const list = bySender.get(domain) ?? [];
              list.push(email);
              bySender.set(domain, list);
            }

            const summary = Array.from(bySender.entries()).map(
              ([domain, emails]) => ({
                sender: domain,
                count: emails.length,
                example_subject: emails[0].subject,
                can_unsubscribe: emails.some((e) => e.hasUnsubscribe),
                email_ids: emails.map((e) => e.emailId),
                unsubscribe_url: emails.find((e) => e.unsubscribeUrl)
                  ?.unsubscribeUrl,
              }),
            );

            return {
              success: true,
              total_found: promotionals.length,
              senders: summary,
              message: `Encontre ${promotionals.length} correos promocionales de ${summary.length} remitentes. ¿De cuales quieres desuscribirte?`,
            };
          } catch (error) {
            return {
              success: false,
              error: `Error escaneando correos: ${error instanceof Error ? error.message : "desconocido"}`,
            };
          }
        },
      }),

      unsubscribe_from_sender: tool({
        description:
          "Ejecuta la desuscripcion de un remitente especifico. " +
          "SIEMPRE pide confirmacion antes de ejecutar. " +
          "Muestra el remitente y pregunta '¿Te desuscribo de [remitente]?'",
        parameters: z.object({
          sender: z
            .string()
            .describe("Nombre o dominio del remitente"),
          unsubscribe_url: z
            .string()
            .optional()
            .describe(
              "URL de desuscripcion (obtenida de scan_promotional_emails)",
            ),
          email_id: z
            .string()
            .optional()
            .describe(
              "ID del correo para buscar el link de desuscripcion",
            ),
        }),
        execute: async ({ sender, unsubscribe_url, email_id }) => {
          try {
            let url = unsubscribe_url;

            // If no URL provided, try to get it from the email
            if (!url && email_id) {
              const accessToken = await getGoogleAccessToken();
              if (!accessToken) {
                return {
                  success: false,
                  error: "No tienes Google conectado.",
                };
              }

              const info = await getEmailUnsubscribeInfo(
                accessToken,
                email_id,
              );
              if (info?.unsubscribeUrl) {
                url = info.unsubscribeUrl;
              }
            }

            if (!url) {
              return {
                success: false,
                error: `No encontre link de desuscripcion para ${sender}. Puede que necesites entrar manualmente al correo.`,
              };
            }

            const result = await executeUnsubscribe(url);

            if (result.success) {
              return {
                success: true,
                sender,
                message: `Desuscrito de ${sender} exitosamente. Ya no deberian llegarte correos de ellos.`,
              };
            }

            return {
              success: false,
              error: `No se pudo desuscribir de ${sender}: ${result.error}. Puede que necesites hacerlo manualmente.`,
              unsubscribe_url: url,
            };
          } catch (error) {
            return {
              success: false,
              error: `Error al desuscribir: ${error instanceof Error ? error.message : "desconocido"}`,
            };
          }
        },
      }),

      bulk_unsubscribe: tool({
        description:
          "Desuscribe de multiples remitentes a la vez. " +
          "SIEMPRE muestra la lista completa y pide confirmacion antes de ejecutar. " +
          "Pregunta: '¿Te desuscribo de estos N remitentes?'",
        parameters: z.object({
          unsubscribe_urls: z
            .array(
              z.object({
                sender: z.string(),
                url: z.string(),
              }),
            )
            .describe(
              "Lista de remitentes con sus URLs de desuscripcion",
            ),
        }),
        execute: async ({ unsubscribe_urls }) => {
          const results: Array<{
            sender: string;
            success: boolean;
            error?: string;
          }> = [];

          for (const item of unsubscribe_urls) {
            const result = await executeUnsubscribe(item.url);
            results.push({
              sender: item.sender,
              success: result.success,
              error: result.error,
            });
            // Small delay to avoid rate limiting
            await new Promise((r) => setTimeout(r, 500));
          }

          const successful = results.filter((r) => r.success).length;
          const failed = results.filter((r) => !r.success).length;

          return {
            success: true,
            total: results.length,
            successful,
            failed,
            details: results,
            message: `Desuscrito de ${successful}/${results.length} remitentes.${failed > 0 ? ` ${failed} fallaron — puede que necesites hacerlo manualmente.` : ""}`,
          };
        },
      }),
    };
  },

  promptInstructions: [
    "- scan_promotional_emails: Escanea correos promocionales y newsletters con opcion de desuscripcion.",
    "- unsubscribe_from_sender: Desuscribe de un remitente especifico. PIDE CONFIRMACION antes.",
    "- bulk_unsubscribe: Desuscribe de multiples remitentes a la vez. MUESTRA LISTA y PIDE CONFIRMACION.",
    "  Cuando el usuario pida limpiar su correo o dejar de recibir spam, primero escanea con scan_promotional_emails, muestra los resultados, y pregunta de cuales quiere desuscribirse.",
  ],
};
