// ============================================================
// Google Calendar API client
// Docs: https://developers.google.com/calendar/api/v3/reference
// ============================================================

const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  start: string; // ISO date or datetime
  end: string;
  allDay: boolean;
  status: string;
}

export interface CreateEventParams {
  summary: string;
  description?: string;
  location?: string;
  startDateTime: string; // ISO 8601
  endDateTime: string;
  timeZone: string;
}

// ============================================================
// OAuth2 helpers
// ============================================================

export function getGoogleAuthUrl(state: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw new Error("Missing GOOGLE_CLIENT_ID");

  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ??
    "http://localhost:3000/api/oauth/google/callback";

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope:
      "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string): Promise<{
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope: string;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri =
    process.env.GOOGLE_REDIRECT_URI ??
    "http://localhost:3000/api/oauth/google/callback";

  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Google token exchange failed: ${response.status} ${error}`,
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    scope: data.scope,
  };
}

export async function refreshGoogleToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google token refresh failed: ${response.status} ${error}`);
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  };
}

// ============================================================
// Calendar API
// ============================================================

export async function listCalendarEvents(
  accessToken: string,
  params?: { timeMin?: string; timeMax?: string; maxResults?: number },
): Promise<CalendarEvent[]> {
  const queryParams = new URLSearchParams({
    orderBy: "startTime",
    singleEvents: "true",
    maxResults: String(params?.maxResults ?? 10),
  });

  if (params?.timeMin) queryParams.set("timeMin", params.timeMin);
  if (params?.timeMax) queryParams.set("timeMax", params.timeMax);

  // Default: desde ahora hasta 7 días
  if (!params?.timeMin) {
    queryParams.set("timeMin", new Date().toISOString());
  }
  if (!params?.timeMax) {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    queryParams.set("timeMax", nextWeek.toISOString());
  }

  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/primary/events?${queryParams.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Calendar list failed: ${response.status} ${error}`);
  }

  const data = (await response.json()) as {
    items: Array<{
      id: string;
      summary?: string;
      description?: string;
      location?: string;
      start: { dateTime?: string; date?: string };
      end: { dateTime?: string; date?: string };
      status: string;
    }>;
  };

  return (data.items ?? []).map((item) => ({
    id: item.id,
    summary: item.summary ?? "(sin título)",
    description: item.description,
    location: item.location,
    start: item.start.dateTime ?? item.start.date ?? "",
    end: item.end.dateTime ?? item.end.date ?? "",
    allDay: !item.start.dateTime,
    status: item.status,
  }));
}

export async function createCalendarEvent(
  accessToken: string,
  params: CreateEventParams,
): Promise<CalendarEvent> {
  const response = await fetch(
    `${GOOGLE_CALENDAR_API}/calendars/primary/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: params.summary,
        description: params.description,
        location: params.location,
        start: {
          dateTime: params.startDateTime,
          timeZone: params.timeZone,
        },
        end: {
          dateTime: params.endDateTime,
          timeZone: params.timeZone,
        },
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Google Calendar create failed: ${response.status} ${error}`,
    );
  }

  const item = (await response.json()) as {
    id: string;
    summary: string;
    description?: string;
    location?: string;
    start: { dateTime?: string; date?: string };
    end: { dateTime?: string; date?: string };
    status: string;
  };

  return {
    id: item.id,
    summary: item.summary,
    description: item.description,
    location: item.location,
    start: item.start.dateTime ?? item.start.date ?? "",
    end: item.end.dateTime ?? item.end.date ?? "",
    allDay: !item.start.dateTime,
    status: item.status,
  };
}
