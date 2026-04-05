// ============================================================
// Spotify API client
// Docs: https://developer.spotify.com/documentation/web-api
// ============================================================

const SPOTIFY_API = "https://api.spotify.com/v1";

// ============================================================
// Types
// ============================================================

export interface SpotifyCurrentlyPlaying {
  track: string;
  artist: string;
  album: string;
  isPlaying: boolean;
}

export interface SpotifyRecentTrack {
  track: string;
  artist: string;
  playedAt: string;
}

export interface SpotifyTopTrack {
  track: string;
  artist: string;
}

export interface SpotifySearchResult {
  track: string;
  artist: string;
  album: string;
  uri: string;
}

// ============================================================
// OAuth2 helpers
// ============================================================

export function getSpotifyAuthUrl(state: string): string {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) throw new Error("Missing SPOTIFY_CLIENT_ID");

  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI ??
    "http://localhost:3000/api/oauth/spotify/callback";

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope:
      "user-read-currently-playing user-read-recently-played user-top-read playlist-read-private",
    state,
  });

  return `https://accounts.spotify.com/authorize?${params.toString()}`;
}

export async function exchangeSpotifyCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirectUri =
    process.env.SPOTIFY_REDIRECT_URI ??
    "http://localhost:3000/api/oauth/spotify/callback";

  if (!clientId || !clientSecret) {
    throw new Error("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET");
  }

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Spotify token exchange failed: ${response.status} ${error}`,
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
  };
}

export async function refreshSpotifyToken(refreshToken: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET");
  }

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Spotify token refresh failed: ${response.status} ${error}`,
    );
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
// Spotify API
// ============================================================

export async function getCurrentlyPlaying(
  accessToken: string,
): Promise<SpotifyCurrentlyPlaying | null> {
  const response = await fetch(`${SPOTIFY_API}/me/player/currently-playing`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  // 204 = nothing playing
  if (response.status === 204 || !response.ok) {
    return null;
  }

  const data = (await response.json()) as {
    is_playing: boolean;
    item?: {
      name: string;
      artists: Array<{ name: string }>;
      album: { name: string };
    };
  };

  if (!data.item) return null;

  return {
    track: data.item.name,
    artist: data.item.artists.map((a) => a.name).join(", "),
    album: data.item.album.name,
    isPlaying: data.is_playing,
  };
}

export async function getRecentlyPlayed(
  accessToken: string,
  limit = 10,
): Promise<SpotifyRecentTrack[]> {
  const params = new URLSearchParams({ limit: String(limit) });

  const response = await fetch(
    `${SPOTIFY_API}/me/player/recently-played?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Spotify recently played failed: ${response.status} ${error}`,
    );
  }

  const data = (await response.json()) as {
    items: Array<{
      track: {
        name: string;
        artists: Array<{ name: string }>;
      };
      played_at: string;
    }>;
  };

  return (data.items ?? []).map((item) => ({
    track: item.track.name,
    artist: item.track.artists.map((a) => a.name).join(", "),
    playedAt: item.played_at,
  }));
}

export async function getTopTracks(
  accessToken: string,
  timeRange = "short_term",
  limit = 10,
): Promise<SpotifyTopTrack[]> {
  const params = new URLSearchParams({
    time_range: timeRange,
    limit: String(limit),
  });

  const response = await fetch(
    `${SPOTIFY_API}/me/top/tracks?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Spotify top tracks failed: ${response.status} ${error}`,
    );
  }

  const data = (await response.json()) as {
    items: Array<{
      name: string;
      artists: Array<{ name: string }>;
    }>;
  };

  return (data.items ?? []).map((item) => ({
    track: item.name,
    artist: item.artists.map((a) => a.name).join(", "),
  }));
}

export async function searchTracks(
  accessToken: string,
  query: string,
  limit = 5,
): Promise<SpotifySearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    type: "track",
    limit: String(limit),
  });

  const response = await fetch(
    `${SPOTIFY_API}/search?${params.toString()}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Spotify search failed: ${response.status} ${error}`,
    );
  }

  const data = (await response.json()) as {
    tracks: {
      items: Array<{
        name: string;
        artists: Array<{ name: string }>;
        album: { name: string };
        uri: string;
      }>;
    };
  };

  return (data.tracks.items ?? []).map((item) => ({
    track: item.name,
    artist: item.artists.map((a) => a.name).join(", "),
    album: item.album.name,
    uri: item.uri,
  }));
}
