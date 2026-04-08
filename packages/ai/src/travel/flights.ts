// ============================================================
// Flight Search via SerpAPI (Google Flights scraper)
// Docs: https://serpapi.com/google-flights-api
// Free: 250 searches/month
// ============================================================

const SERPAPI_URL = "https://serpapi.com/search.json";

export interface FlightOffer {
  id: string;
  airline: string;
  price: number;
  currency: string;
  departure: string;
  arrival: string;
  origin: string;
  destination: string;
  duration: string;
  stops: number;
  segments: Array<{
    airline: string;
    flightNumber: string;
    departure: string;
    arrival: string;
    origin: string;
    destination: string;
  }>;
}

export async function searchFlights(params: {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  adults?: number;
  maxResults?: number;
  currencyCode?: string;
}): Promise<FlightOffer[]> {
  const apiKey = process.env.SERPAPI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing SERPAPI_API_KEY. Get one free at https://serpapi.com");
  }

  const searchParams = new URLSearchParams({
    engine: "google_flights",
    api_key: apiKey,
    departure_id: params.origin.toUpperCase(),
    arrival_id: params.destination.toUpperCase(),
    outbound_date: params.departureDate,
    adults: String(params.adults ?? 1),
    currency: params.currencyCode ?? "MXN",
    hl: "es",
    type: params.returnDate ? "1" : "2", // 1=round-trip, 2=one-way
  });

  if (params.returnDate) {
    searchParams.set("return_date", params.returnDate);
  }

  const response = await fetch(`${SERPAPI_URL}?${searchParams.toString()}`);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`SerpAPI flight search failed: ${response.status} ${error}`);
  }

  const data = (await response.json()) as {
    best_flights?: Array<SerpApiFlight>;
    other_flights?: Array<SerpApiFlight>;
    error?: string;
  };

  if (data.error) {
    throw new Error(`SerpAPI error: ${data.error}`);
  }

  const allFlights = [
    ...(data.best_flights ?? []),
    ...(data.other_flights ?? []),
  ];

  const maxResults = params.maxResults ?? 5;

  return allFlights.slice(0, maxResults).map((flight, idx) => {
    const firstLeg = flight.flights[0];
    const lastLeg = flight.flights[flight.flights.length - 1];

    return {
      id: `flight-${idx}`,
      airline: firstLeg.airline ?? "Unknown",
      price: flight.price ?? 0,
      currency: params.currencyCode ?? "MXN",
      departure: firstLeg.departure_airport?.time ?? "",
      arrival: lastLeg.arrival_airport?.time ?? "",
      origin: firstLeg.departure_airport?.id ?? params.origin,
      destination: lastLeg.arrival_airport?.id ?? params.destination,
      duration: `${flight.total_duration ?? 0} min`,
      stops: flight.flights.length - 1,
      segments: flight.flights.map((seg) => ({
        airline: seg.airline ?? "",
        flightNumber: seg.flight_number ?? "",
        departure: seg.departure_airport?.time ?? "",
        arrival: seg.arrival_airport?.time ?? "",
        origin: seg.departure_airport?.id ?? "",
        destination: seg.arrival_airport?.id ?? "",
      })),
    };
  });
}

interface SerpApiFlight {
  flights: Array<{
    airline?: string;
    flight_number?: string;
    departure_airport?: { id: string; name: string; time: string };
    arrival_airport?: { id: string; name: string; time: string };
    duration?: number;
  }>;
  total_duration?: number;
  price?: number;
}

/**
 * Search for airport IATA code by city name.
 * Uses a local map of Mexican airports + SerpAPI fallback.
 */
export async function searchAirport(
  keyword: string,
): Promise<
  Array<{ iataCode: string; name: string; city: string; country: string }>
> {
  // Common Mexican airports
  const AIRPORTS: Record<string, { iataCode: string; name: string; city: string }> = {
    monterrey: { iataCode: "MTY", name: "Monterrey International", city: "Monterrey" },
    "ciudad de mexico": { iataCode: "MEX", name: "Benito Juarez International", city: "Ciudad de Mexico" },
    cdmx: { iataCode: "MEX", name: "Benito Juarez International", city: "Ciudad de Mexico" },
    mexico: { iataCode: "MEX", name: "Benito Juarez International", city: "Ciudad de Mexico" },
    cancun: { iataCode: "CUN", name: "Cancun International", city: "Cancun" },
    guadalajara: { iataCode: "GDL", name: "Miguel Hidalgo International", city: "Guadalajara" },
    tijuana: { iataCode: "TIJ", name: "General Abelardo L. Rodriguez", city: "Tijuana" },
    merida: { iataCode: "MID", name: "Manuel Crescencio Rejon", city: "Merida" },
    "los cabos": { iataCode: "SJD", name: "Los Cabos International", city: "San Jose del Cabo" },
    "san jose del cabo": { iataCode: "SJD", name: "Los Cabos International", city: "San Jose del Cabo" },
    "puerto vallarta": { iataCode: "PVR", name: "Gustavo Diaz Ordaz", city: "Puerto Vallarta" },
    oaxaca: { iataCode: "OAX", name: "Xoxocotlan International", city: "Oaxaca" },
    leon: { iataCode: "BJX", name: "Del Bajio International", city: "Leon" },
    queretaro: { iataCode: "QRO", name: "Queretaro International", city: "Queretaro" },
    chihuahua: { iataCode: "CUU", name: "Roberto Fierro Villalobos", city: "Chihuahua" },
    hermosillo: { iataCode: "HMO", name: "General Ignacio Pesqueira Garcia", city: "Hermosillo" },
    mazatlan: { iataCode: "MZT", name: "General Rafael Buelna", city: "Mazatlan" },
    veracruz: { iataCode: "VER", name: "General Heriberto Jara", city: "Veracruz" },
    acapulco: { iataCode: "ACA", name: "General Juan N. Alvarez", city: "Acapulco" },
    villahermosa: { iataCode: "VSA", name: "Carlos Rovirosa Perez", city: "Villahermosa" },
    "tuxtla gutierrez": { iataCode: "TGZ", name: "Angel Albino Corzo", city: "Tuxtla Gutierrez" },
    // International
    "nueva york": { iataCode: "JFK", name: "John F. Kennedy", city: "New York" },
    "new york": { iataCode: "JFK", name: "John F. Kennedy", city: "New York" },
    miami: { iataCode: "MIA", name: "Miami International", city: "Miami" },
    "los angeles": { iataCode: "LAX", name: "Los Angeles International", city: "Los Angeles" },
    houston: { iataCode: "IAH", name: "George Bush Intercontinental", city: "Houston" },
    madrid: { iataCode: "MAD", name: "Adolfo Suarez Madrid-Barajas", city: "Madrid" },
    bogota: { iataCode: "BOG", name: "El Dorado International", city: "Bogota" },
    lima: { iataCode: "LIM", name: "Jorge Chavez International", city: "Lima" },
  };

  const key = keyword.toLowerCase().trim();
  const match = AIRPORTS[key];

  if (match) {
    return [{ ...match, country: "Mexico" }];
  }

  // Partial match
  const partials = Object.entries(AIRPORTS)
    .filter(([k]) => k.includes(key) || key.includes(k))
    .map(([, v]) => ({ ...v, country: "Mexico" }));

  if (partials.length > 0) return partials;

  // If 3 letters, assume it's already an IATA code
  if (key.length === 3) {
    return [{ iataCode: key.toUpperCase(), name: key.toUpperCase(), city: keyword, country: "" }];
  }

  return [];
}
