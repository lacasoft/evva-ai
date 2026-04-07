// ============================================================
// Gmail API client
// Docs: https://developers.google.com/gmail/api/reference/rest
// ============================================================

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1";

export interface EmailSummary {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  isUnread: boolean;
}

export interface EmailDetail {
  id: string;
  from: string;
  to: string;
  subject: string;
  body: string;
  date: string;
}

// ============================================================
// Listar correos recientes
// ============================================================

export async function listEmails(
  accessToken: string,
  params?: { query?: string; maxResults?: number; unreadOnly?: boolean },
): Promise<EmailSummary[]> {
  const queryParts: string[] = [];
  if (params?.unreadOnly) queryParts.push("is:unread");
  if (params?.query) queryParts.push(params.query);

  const searchParams = new URLSearchParams({
    maxResults: String(params?.maxResults ?? 10),
  });
  if (queryParts.length > 0) {
    searchParams.set("q", queryParts.join(" "));
  }

  const response = await fetch(
    `${GMAIL_API}/users/me/messages?${searchParams.toString()}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gmail list failed: ${response.status} ${error}`);
  }

  const data = (await response.json()) as {
    messages?: Array<{ id: string; threadId: string }>;
  };

  if (!data.messages || data.messages.length === 0) return [];

  // Fetch headers de cada mensaje en paralelo (max 10)
  const emails = await Promise.all(
    data.messages
      .slice(0, 10)
      .map((msg) => getEmailSummary(accessToken, msg.id)),
  );

  return emails.filter((e): e is EmailSummary => e !== null);
}

async function getEmailSummary(
  accessToken: string,
  messageId: string,
): Promise<EmailSummary | null> {
  const response = await fetch(
    `${GMAIL_API}/users/me/messages/${messageId}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) return null;

  const data = (await response.json()) as {
    id: string;
    threadId: string;
    snippet: string;
    labelIds: string[];
    payload: {
      headers: Array<{ name: string; value: string }>;
    };
  };

  const headers = data.payload.headers;
  const getHeader = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ??
    "";

  return {
    id: data.id,
    threadId: data.threadId,
    from: getHeader("From"),
    subject: getHeader("Subject"),
    snippet: data.snippet,
    date: getHeader("Date"),
    isUnread: data.labelIds?.includes("UNREAD") ?? false,
  };
}

// ============================================================
// Leer un correo completo
// ============================================================

export async function getEmail(
  accessToken: string,
  messageId: string,
): Promise<EmailDetail | null> {
  const response = await fetch(
    `${GMAIL_API}/users/me/messages/${messageId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) return null;

  const data = (await response.json()) as {
    id: string;
    payload: {
      headers: Array<{ name: string; value: string }>;
      body?: { data?: string };
      parts?: Array<{
        mimeType: string;
        body?: { data?: string };
      }>;
    };
  };

  const headers = data.payload.headers;
  const getHeader = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ??
    "";

  // Extraer body — puede estar en payload.body o en parts
  let body = "";
  if (data.payload.body?.data) {
    body = decodeBase64Url(data.payload.body.data);
  } else if (data.payload.parts) {
    const textPart = data.payload.parts.find(
      (p) => p.mimeType === "text/plain",
    );
    if (textPart?.body?.data) {
      body = decodeBase64Url(textPart.body.data);
    } else {
      const htmlPart = data.payload.parts.find(
        (p) => p.mimeType === "text/html",
      );
      if (htmlPart?.body?.data) {
        // Strip HTML tags para obtener texto plano
        body = decodeBase64Url(htmlPart.body.data).replace(/<[^>]*>/g, "");
      }
    }
  }

  // Truncar body largo
  if (body.length > 2000) {
    body = body.slice(0, 2000) + "... (truncado)";
  }

  return {
    id: data.id,
    from: getHeader("From"),
    to: getHeader("To"),
    subject: getHeader("Subject"),
    body: body.trim(),
    date: getHeader("Date"),
  };
}

// ============================================================
// Enviar un correo
// ============================================================

export async function sendEmail(
  accessToken: string,
  params: {
    to: string;
    subject: string;
    body: string;
    replyToMessageId?: string;
  },
): Promise<{ id: string; threadId: string }> {
  // Construir mensaje RFC 2822 con UTF-8 correcto
  const encodedSubject = `=?UTF-8?B?${Buffer.from(params.subject, "utf-8").toString("base64")}?=`;

  const headers = [
    "MIME-Version: 1.0",
    `To: ${params.to}`,
    `Subject: ${encodedSubject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
  ];

  if (params.replyToMessageId) {
    headers.push(`In-Reply-To: ${params.replyToMessageId}`);
    headers.push(`References: ${params.replyToMessageId}`);
  }

  const message = headers.join("\r\n") + "\r\n\r\n" + params.body;
  const raw = Buffer.from(message, "utf-8").toString("base64url");

  const response = await fetch(`${GMAIL_API}/users/me/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gmail send failed: ${response.status} ${error}`);
  }

  const data = (await response.json()) as { id: string; threadId: string };
  return { id: data.id, threadId: data.threadId };
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(base64, "base64").toString("utf-8");
}

// ============================================================
// Analyze email for unsubscribe options
// ============================================================

export interface UnsubscribeInfo {
  emailId: string;
  from: string;
  subject: string;
  unsubscribeUrl?: string;
  unsubscribeEmail?: string;
  hasUnsubscribe: boolean;
}

export async function getEmailUnsubscribeInfo(
  accessToken: string,
  messageId: string,
): Promise<UnsubscribeInfo | null> {
  const response = await fetch(
    `${GMAIL_API}/users/me/messages/${messageId}?format=full&metadataHeaders=List-Unsubscribe&metadataHeaders=From&metadataHeaders=Subject`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) return null;

  const data = (await response.json()) as {
    id: string;
    payload: {
      headers: Array<{ name: string; value: string }>;
      body?: { data?: string };
      parts?: Array<{ mimeType: string; body?: { data?: string } }>;
    };
  };

  const headers = data.payload.headers;
  const getHeader = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ??
    "";

  const listUnsubscribe = getHeader("List-Unsubscribe");

  let unsubscribeUrl: string | undefined;
  let unsubscribeEmail: string | undefined;

  // Parse List-Unsubscribe header: <https://...>, <mailto:...>
  if (listUnsubscribe) {
    const urlMatch = listUnsubscribe.match(/<(https?:\/\/[^>]+)>/);
    if (urlMatch) unsubscribeUrl = urlMatch[1];

    const mailtoMatch = listUnsubscribe.match(/<mailto:([^>]+)>/);
    if (mailtoMatch) unsubscribeEmail = mailtoMatch[1];
  }

  // If no header, try to find unsubscribe link in body
  if (!unsubscribeUrl) {
    let body = "";
    if (data.payload.parts) {
      const htmlPart = data.payload.parts.find(
        (p) => p.mimeType === "text/html",
      );
      if (htmlPart?.body?.data) body = decodeBase64Url(htmlPart.body.data);
    } else if (data.payload.body?.data) {
      body = decodeBase64Url(data.payload.body.data);
    }

    // Common unsubscribe link patterns
    const patterns = [
      /href="(https?:\/\/[^"]*unsub[^"]*?)"/i,
      /href="(https?:\/\/[^"]*opt[_-]?out[^"]*?)"/i,
      /href="(https?:\/\/[^"]*desuscri[^"]*?)"/i,
      /href="(https?:\/\/[^"]*baja[^"]*?)"/i,
      /href="(https?:\/\/[^"]*remove[^"]*?)"/i,
      /href="(https?:\/\/[^"]*preferences[^"]*?)"/i,
    ];

    for (const pattern of patterns) {
      const match = body.match(pattern);
      if (match) {
        unsubscribeUrl = match[1];
        break;
      }
    }
  }

  return {
    emailId: data.id,
    from: getHeader("From"),
    subject: getHeader("Subject"),
    unsubscribeUrl,
    unsubscribeEmail,
    hasUnsubscribe: !!(unsubscribeUrl || unsubscribeEmail),
  };
}

/**
 * List promotional/newsletter emails with unsubscribe info.
 */
export async function listPromotionalEmails(
  accessToken: string,
  maxResults = 20,
): Promise<UnsubscribeInfo[]> {
  // Search for promotional emails (Gmail category:promotions)
  const response = await fetch(
    `${GMAIL_API}/users/me/messages?maxResults=${maxResults}&q=category:promotions OR label:promotions OR unsubscribe`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!response.ok) return [];

  const data = (await response.json()) as {
    messages?: Array<{ id: string }>;
  };

  if (!data.messages || data.messages.length === 0) return [];

  // Get unsubscribe info for each (limit to 10 to avoid rate limits)
  const results = await Promise.all(
    data.messages
      .slice(0, 10)
      .map((msg) => getEmailUnsubscribeInfo(accessToken, msg.id)),
  );

  return results.filter(
    (r): r is UnsubscribeInfo => r !== null && r.hasUnsubscribe,
  );
}

/**
 * Execute unsubscribe by visiting the URL.
 */
export async function executeUnsubscribe(
  unsubscribeUrl: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(unsubscribeUrl, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(10_000),
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; EvvaBot/1.0)",
      },
    });

    // Most unsubscribe pages return 200 on success
    // Some redirect to a confirmation page
    if (response.ok || response.status === 302 || response.status === 301) {
      return { success: true };
    }

    return {
      success: false,
      error: `HTTP ${response.status}`,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
