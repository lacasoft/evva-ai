import { tool } from "ai";
import { z } from "zod";
import type { SkillDefinition } from "../base-skill.js";
import {
  getSpotifyAuthUrl,
  refreshSpotifyToken,
  getCurrentlyPlaying,
  getRecentlyPlayed,
  getTopTracks,
  searchTracks,
} from "@evva/ai";
import { getOAuthToken, upsertOAuthToken } from "@evva/database";

export const spotifySkill: SkillDefinition = {
  name: "spotify",
  description:
    "Integración con Spotify: ver qué estás escuchando, historial reciente, top tracks y buscar música.",
  category: "utility",
  forProfiles: ["young", "adult"],
  requiredEnv: ["SPOTIFY_CLIENT_ID", "SPOTIFY_CLIENT_SECRET"],
  requiresOAuth: "spotify",

  buildTools: (ctx) => {
    const getSpotifyAccessToken = async (
      userId: string,
    ): Promise<string | null> => {
      const token = await getOAuthToken(userId, "spotify");
      if (!token) return null;

      if (token.expiresAt && token.expiresAt > new Date()) {
        return token.accessToken;
      }

      if (!token.refreshToken) return null;

      try {
        const refreshed = await refreshSpotifyToken(token.refreshToken);
        const expiresAt = new Date(Date.now() + refreshed.expiresIn * 1000);
        await upsertOAuthToken({
          userId,
          provider: "spotify",
          accessToken: refreshed.accessToken,
          expiresAt,
        });
        return refreshed.accessToken;
      } catch {
        return null;
      }
    };

    return {
      connect_spotify: tool({
        description:
          "Genera un link para que el usuario conecte su cuenta de Spotify. " +
          "Úsalo cuando el usuario quiera conectar Spotify o ver su música.",
        parameters: z.object({}),
        execute: async () => {
          try {
            const existingToken = await getOAuthToken(ctx.user.id, "spotify");
            if (existingToken) {
              return {
                success: true,
                already_connected: true,
                message: "Tu cuenta de Spotify ya está conectada.",
              };
            }

            const authUrl = getSpotifyAuthUrl(ctx.user.id);
            return {
              success: true,
              auth_url: authUrl,
              message: "Abre este link para conectar tu cuenta de Spotify.",
            };
          } catch {
            return {
              success: false,
              error: "La integración con Spotify no está configurada.",
            };
          }
        },
      }),

      now_playing: tool({
        description:
          "Muestra qué canción está escuchando el usuario en Spotify ahora mismo. " +
          "Úsalo cuando el usuario pregunte qué está sonando o qué está escuchando.",
        parameters: z.object({}),
        execute: async () => {
          try {
            const accessToken = await getSpotifyAccessToken(ctx.user.id);
            if (!accessToken) {
              return {
                success: false,
                not_connected: true,
                error:
                  "No tienes Spotify conectado. Usa connect_spotify primero.",
              };
            }

            const playing = await getCurrentlyPlaying(accessToken);
            if (!playing) {
              return {
                success: true,
                playing: null,
                message: "No estás escuchando nada en Spotify ahora mismo.",
              };
            }

            return {
              success: true,
              playing,
            };
          } catch {
            return {
              success: false,
              error: "No se pudo obtener la reproducción actual.",
            };
          }
        },
      }),

      recent_tracks: tool({
        description:
          "Muestra las canciones que el usuario escuchó recientemente en Spotify. " +
          "Úsalo cuando el usuario pregunte qué ha escuchado últimamente.",
        parameters: z.object({
          limit: z
            .number()
            .min(1)
            .max(50)
            .default(10)
            .describe(
              "Cantidad de canciones recientes a mostrar (default: 10)",
            ),
        }),
        execute: async ({ limit }) => {
          try {
            const accessToken = await getSpotifyAccessToken(ctx.user.id);
            if (!accessToken) {
              return {
                success: false,
                not_connected: true,
                error:
                  "No tienes Spotify conectado. Usa connect_spotify primero.",
              };
            }

            const tracks = await getRecentlyPlayed(accessToken, limit);
            return {
              success: true,
              tracks,
            };
          } catch {
            return {
              success: false,
              error: "No se pudieron obtener las canciones recientes.",
            };
          }
        },
      }),

      top_tracks: tool({
        description:
          "Muestra las canciones más escuchadas del usuario en Spotify. " +
          "Úsalo cuando el usuario pregunte por su música favorita o más escuchada.",
        parameters: z.object({
          time_range: z
            .enum(["short_term", "medium_term", "long_term"])
            .default("short_term")
            .describe(
              "Período: short_term (último mes), medium_term (6 meses), long_term (todo el tiempo)",
            ),
          limit: z
            .number()
            .min(1)
            .max(50)
            .default(10)
            .describe("Cantidad de canciones a mostrar (default: 10)"),
        }),
        execute: async ({ time_range, limit }) => {
          try {
            const accessToken = await getSpotifyAccessToken(ctx.user.id);
            if (!accessToken) {
              return {
                success: false,
                not_connected: true,
                error:
                  "No tienes Spotify conectado. Usa connect_spotify primero.",
              };
            }

            const tracks = await getTopTracks(accessToken, time_range, limit);
            return {
              success: true,
              time_range,
              tracks,
            };
          } catch {
            return {
              success: false,
              error: "No se pudieron obtener las canciones top.",
            };
          }
        },
      }),

      search_music: tool({
        description:
          "Busca canciones en Spotify por nombre, artista o álbum. " +
          "Úsalo cuando el usuario quiera buscar una canción o artista.",
        parameters: z.object({
          query: z
            .string()
            .describe("Texto de búsqueda (canción, artista, etc.)"),
          limit: z
            .number()
            .min(1)
            .max(20)
            .default(5)
            .describe("Cantidad de resultados (default: 5)"),
        }),
        execute: async ({ query, limit }) => {
          try {
            const accessToken = await getSpotifyAccessToken(ctx.user.id);
            if (!accessToken) {
              return {
                success: false,
                not_connected: true,
                error:
                  "No tienes Spotify conectado. Usa connect_spotify primero.",
              };
            }

            const results = await searchTracks(accessToken, query, limit);
            return {
              success: true,
              results,
            };
          } catch {
            return {
              success: false,
              error: "No se pudo realizar la búsqueda en Spotify.",
            };
          }
        },
      }),
    };
  },

  promptInstructions: [
    "Puedes conectar Spotify del usuario, ver qué está escuchando, su historial reciente, sus canciones top y buscar música.",
    "Si el usuario no tiene Spotify conectado, usa connect_spotify para generar el link de conexión.",
  ],
};
