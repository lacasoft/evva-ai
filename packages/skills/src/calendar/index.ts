import { tool } from "ai";
import { z } from "zod";
import type { SkillDefinition } from "../base-skill.js";
import {
  getGoogleAuthUrl,
  refreshGoogleToken,
  listCalendarEvents,
  createCalendarEvent,
} from "@evva/ai";
import { getOAuthToken, upsertOAuthToken } from "@evva/database";

export const calendarSkill: SkillDefinition = {
  name: "calendar",
  description: "Integración con Google Calendar: ver eventos y crear citas.",
  category: "communication",
  forProfiles: ["young", "adult", "senior"],
  requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
  requiresOAuth: true,

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
      } catch {
        return null;
      }
    };

    return {
      connect_google: tool({
        description:
          "Genera un link para que el usuario conecte su cuenta de Google (Calendar + Gmail). " +
          "Un solo link conecta ambos servicios. " +
          "Úsalo cuando el usuario quiera conectar Google, su calendario, su correo/Gmail, o cualquier servicio de Google.",
        parameters: z.object({}),
        execute: async () => {
          try {
            const existingToken = await getOAuthToken(ctx.user.id, "google");
            if (existingToken) {
              return {
                success: true,
                already_connected: true,
                message: "Tu calendario de Google ya está conectado.",
              };
            }

            const authUrl = getGoogleAuthUrl(ctx.user.id);
            return {
              success: true,
              auth_url: authUrl,
              message: "Abre este link para conectar tu calendario de Google.",
            };
          } catch {
            return {
              success: false,
              error: "La integración con Google Calendar no está configurada.",
            };
          }
        },
      }),

      list_calendar_events: tool({
        description:
          "Lista los próximos eventos del calendario de Google del usuario. " +
          "Úsalo cuando el usuario pregunte qué tiene en su agenda, calendario, o eventos.",
        parameters: z.object({
          days_ahead: z
            .number()
            .min(1)
            .max(30)
            .default(7)
            .describe("Cuántos días hacia adelante buscar (default: 7)"),
        }),
        execute: async ({ days_ahead }) => {
          try {
            const accessToken = await getGoogleAccessToken(ctx.user.id);
            if (!accessToken) {
              return {
                success: false,
                not_connected: true,
                error:
                  "No tienes Google Calendar conectado. Usa connect_google primero.",
              };
            }

            const timeMin = new Date().toISOString();
            const timeMax = new Date(
              Date.now() + days_ahead * 24 * 60 * 60 * 1000,
            ).toISOString();

            const events = await listCalendarEvents(accessToken, {
              timeMin,
              timeMax,
              maxResults: 15,
            });

            if (events.length === 0) {
              return {
                success: true,
                events: [],
                message: `No tienes eventos en los próximos ${days_ahead} días.`,
              };
            }

            return {
              success: true,
              events: events.map((e) => ({
                summary: e.summary,
                start: e.start,
                end: e.end,
                location: e.location,
                allDay: e.allDay,
              })),
            };
          } catch {
            return {
              success: false,
              error: "No se pudieron obtener los eventos del calendario.",
            };
          }
        },
      }),

      create_calendar_event: tool({
        description:
          "Crea un evento en el Google Calendar del usuario. " +
          "Úsalo cuando el usuario pida agendar algo, crear una cita, o bloquear tiempo.",
        parameters: z.object({
          summary: z.string().describe("Título del evento"),
          description: z
            .string()
            .optional()
            .describe("Descripción o notas del evento"),
          location: z.string().optional().describe("Ubicación del evento"),
          start_datetime: z
            .string()
            .describe(
              "Inicio del evento en ISO 8601 (ej: 2026-04-05T10:00:00)",
            ),
          end_datetime: z
            .string()
            .describe("Fin del evento en ISO 8601 (ej: 2026-04-05T11:00:00)"),
        }),
        execute: async ({
          summary,
          description,
          location,
          start_datetime,
          end_datetime,
        }) => {
          try {
            const accessToken = await getGoogleAccessToken(ctx.user.id);
            if (!accessToken) {
              return {
                success: false,
                not_connected: true,
                error:
                  "No tienes Google Calendar conectado. Usa connect_google primero.",
              };
            }

            const event = await createCalendarEvent(accessToken, {
              summary,
              description,
              location,
              startDateTime: start_datetime,
              endDateTime: end_datetime,
              timeZone: ctx.user.timezone,
            });

            return {
              success: true,
              eventId: event.id,
              summary,
              start: event.start,
              end: event.end,
            };
          } catch {
            return {
              success: false,
              error: "No se pudo crear el evento en el calendario.",
            };
          }
        },
      }),
    };
  },

  promptInstructions: [
    "Puedes conectar, listar y crear eventos en Google Calendar del usuario.",
    "Si el usuario no tiene Google conectado, usa connect_google para generar el link de conexión.",
  ],
};
