import { tool } from "ai";
import { z } from "zod";
import type { SkillDefinition } from "../base-skill.js";
import { searchFlights, searchAirport, searchWeb, scrapePage } from "@evva/ai";

const IATA_MAP: Record<string, string> = {
  monterrey: "MTY", cdmx: "MEX", "ciudad de mexico": "MEX", mexico: "MEX",
  cancun: "CUN", guadalajara: "GDL", tijuana: "TIJ", merida: "MID",
  "san jose del cabo": "SJD", "los cabos": "SJD", "puerto vallarta": "PVR",
  oaxaca: "OAX", leon: "BJX", queretaro: "QRO", chihuahua: "CUU",
  hermosillo: "HMO", mazatlan: "MZT", villahermosa: "VSA",
  "tuxtla gutierrez": "TGZ", acapulco: "ACA", veracruz: "VER",
};

function resolveIATA(city: string): string | undefined {
  return IATA_MAP[city.toLowerCase().trim()];
}

export const travelSkill: SkillDefinition = {
  name: "travel",
  description: "Busqueda y reservacion de vuelos y autobuses",
  category: "utility",
  forProfiles: ["young", "adult"],
  keywords: ["vuelo", "viaje", "avion", "hotel", "camion", "autobus", "aeropuerto", "boleto", "reservar", "viajar", "volar"],
  requiredEnv: ["SERPAPI_API_KEY"],

  buildTools: () => ({
    search_flights: tool({
      description:
        "Busca vuelos entre ciudades con precios. " +
        "Acepta nombres de ciudades mexicanas o codigos IATA.",
      parameters: z.object({
        origin: z.string().describe("Ciudad o codigo IATA de origen"),
        destination: z.string().describe("Ciudad o codigo IATA de destino"),
        departure_date: z.string().describe("Fecha de salida YYYY-MM-DD"),
        return_date: z.string().optional().describe("Fecha de regreso YYYY-MM-DD"),
        adults: z.number().min(1).max(9).default(1).describe("Pasajeros adultos"),
        min_departure_hour: z.number().min(0).max(23).optional().describe("Hora minima de salida (0-23, ej: 16 para despues de las 4pm)"),
        min_return_hour: z.number().min(0).max(23).optional().describe("Hora minima de regreso (0-23, ej: 17 para despues de las 5pm)"),
      }),
      execute: async ({ origin, destination, departure_date, return_date, adults, min_departure_hour, min_return_hour }) => {
        try {
          let originCode = resolveIATA(origin) ?? origin.toUpperCase();
          let destCode = resolveIATA(destination) ?? destination.toUpperCase();

          if (originCode.length !== 3) {
            try {
              const airports = await searchAirport(origin);
              if (airports.length > 0) originCode = airports[0].iataCode;
            } catch { /* use as-is */ }
          }
          if (destCode.length !== 3) {
            try {
              const airports = await searchAirport(destination);
              if (airports.length > 0) destCode = airports[0].iataCode;
            } catch { /* use as-is */ }
          }

          const flights = await searchFlights({
            origin: originCode,
            destination: destCode,
            departureDate: departure_date,
            returnDate: return_date,
            adults,
            maxResults: min_departure_hour ? 15 : 5,
            currencyCode: "MXN",
          });

          // Filter by minimum departure hour if specified
          let filtered = flights;
          if (min_departure_hour !== undefined) {
            filtered = filtered.filter((f) => {
              const hourMatch = f.departure.match(/(\d{1,2}):/);
              if (!hourMatch) return true;
              return parseInt(hourMatch[1]) >= min_departure_hour;
            });
          }

          if (filtered.length === 0 && flights.length > 0) {
            return {
              success: true,
              flights: flights.slice(0, 3).map((f) => ({
                airline: f.airline,
                price: `$${f.price} ${f.currency}`,
                departure: f.departure,
                arrival: f.arrival,
                duration: f.duration,
                stops: f.stops === 0 ? "Directo" : `${f.stops} escala(s)`,
                route: `${f.origin} -> ${f.destination}`,
              })),
              message: `No encontre vuelos despues de las ${min_departure_hour}:00. Estos son los disponibles para esa fecha:`,
            };
          }

          if (filtered.length === 0) {
            return {
              success: true,
              flights: [],
              message: `No encontre vuelos de ${origin} a ${destination} para el ${departure_date}. Intenta con fechas flexibles.`,
            };
          }

          return {
            success: true,
            flights: filtered.map((f) => ({
              airline: f.airline,
              price: `$${f.price} ${f.currency}`,
              departure: f.departure,
              arrival: f.arrival,
              duration: f.duration,
              stops: f.stops === 0 ? "Directo" : `${f.stops} escala(s)`,
              route: `${f.origin} -> ${f.destination}`,
            })),
            message: min_departure_hour
              ? `Vuelos despues de las ${min_departure_hour}:00:`
              : undefined,
          };
        } catch (error) {
          return {
            success: false,
            error: `Error buscando vuelos: ${error instanceof Error ? error.message : "desconocido"}`,
          };
        }
      },
    }),

    search_airport: tool({
      description: "Busca el codigo IATA de un aeropuerto por nombre de ciudad.",
      parameters: z.object({
        city: z.string().describe("Nombre de la ciudad"),
      }),
      execute: async ({ city }) => {
        try {
          const quick = resolveIATA(city);
          if (quick) {
            return { success: true, airports: [{ iataCode: quick, name: city }] };
          }
          const airports = await searchAirport(city);
          return {
            success: true,
            airports: airports.map((a) => ({ iataCode: a.iataCode, name: a.name, city: a.city })),
          };
        } catch (error) {
          return { success: false, error: `Error: ${error instanceof Error ? error.message : "desconocido"}` };
        }
      },
    }),

    get_booking_link: tool({
      description: "Genera link directo para reservar un vuelo elegido.",
      parameters: z.object({
        airline: z.string().describe("Codigo de aerolinea (Y4, VB, AM)"),
        origin: z.string().describe("Codigo IATA de origen"),
        destination: z.string().describe("Codigo IATA de destino"),
        date: z.string().describe("Fecha YYYY-MM-DD"),
      }),
      execute: async ({ airline, origin, destination, date }) => {
        const links: Record<string, string> = {
          Y4: `https://www.volaris.com/es/vuelos/${origin.toLowerCase()}-${destination.toLowerCase()}`,
          VB: `https://www.vivaaerobus.com/es-mx/vuelos/${origin}-${destination}`,
          AM: "https://www.aeromexico.com/es-mx/reserva",
        };
        const airlineLink = links[airline.toUpperCase()];
        const googleLink = `https://www.google.com/travel/flights?q=flights+from+${origin}+to+${destination}+on+${date}`;
        return {
          success: true,
          airline_link: airlineLink,
          google_flights_link: googleLink,
          message: airlineLink
            ? `Reserva en la aerolinea: ${airlineLink}\nO compara en Google Flights: ${googleLink}`
            : `Busca aqui: ${googleLink}`,
        };
      },
    }),

    search_buses: tool({
      description: "Busca autobuses/camiones entre ciudades mexicanas via Firecrawl.",
      parameters: z.object({
        origin: z.string().describe("Ciudad de origen"),
        destination: z.string().describe("Ciudad de destino"),
        date: z.string().describe("Fecha de viaje"),
      }),
      execute: async ({ origin, destination, date }) => {
        if (!process.env.FIRECRAWL_API_KEY) {
          return {
            success: false,
            error: "Busqueda de autobuses no disponible. Busca en ado.com.mx o flixbus.com.mx",
          };
        }
        try {
          const results = await searchWeb(
            `camiones autobus ${origin} a ${destination} ${date} precio horarios`,
            5,
          );
          if (results.length === 0) {
            return { success: true, results: [], message: `No encontre autobuses de ${origin} a ${destination}.` };
          }
          return { success: true, results };
        } catch (error) {
          return { success: false, error: `Error: ${error instanceof Error ? error.message : "desconocido"}` };
        }
      },
    }),

    get_travel_page_info: tool({
      description: "Analiza una pagina de reservas de viajes con Firecrawl.",
      parameters: z.object({
        url: z.string().describe("URL de la pagina a analizar"),
      }),
      execute: async ({ url }) => {
        if (!process.env.FIRECRAWL_API_KEY) {
          return { success: false, error: "Firecrawl no disponible" };
        }
        try {
          const page = await scrapePage(url);
          return { success: true, url, content: page.markdown };
        } catch (error) {
          return { success: false, error: `Error: ${error instanceof Error ? error.message : "desconocido"}` };
        }
      },
    }),
  }),

  promptInstructions: [
    "- search_flights: Busca vuelos con precios entre ciudades. Acepta nombres de ciudades o IATA. Usa min_departure_hour para filtrar por hora.",
    "- search_airport: Resuelve nombre de ciudad a codigo IATA.",
    "- get_booking_link: Genera link directo para reservar un vuelo elegido.",
    "- search_buses: Busca camiones/autobuses entre ciudades via Firecrawl.",
    "- get_travel_page_info: Analiza una pagina de reservas.",
    "  FLUJO: 1) Busca vuelos 2) Muestra opciones con precio, horario, escalas 3) Usuario elige 4) Link de reserva.",
    "  Despues de que compre, pregunta si quiere registrar el gasto en finanzas.",
  ],
};
