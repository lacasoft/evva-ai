// ============================================================
// Firecrawl API client — web scraping for travel sites
// Docs: https://docs.firecrawl.dev
// ============================================================

const FIRECRAWL_API = "https://api.firecrawl.dev/v1";

function getFirecrawlKey(): string {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("Missing FIRECRAWL_API_KEY");
  return key;
}

export async function scrapePage(
  url: string,
): Promise<{ markdown: string; metadata?: Record<string, string> }> {
  const response = await fetch(`${FIRECRAWL_API}/scrape`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getFirecrawlKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, formats: ["markdown"] }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Firecrawl scrape failed: ${response.status} ${error}`);
  }

  const data = (await response.json()) as {
    success: boolean;
    data: { markdown: string; metadata?: Record<string, string> };
  };

  return {
    markdown: data.data.markdown?.slice(0, 3000) ?? "",
    metadata: data.data.metadata,
  };
}

export async function searchWeb(
  query: string,
  limit = 5,
): Promise<Array<{ title: string; url: string; content: string }>> {
  const response = await fetch(`${FIRECRAWL_API}/search`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getFirecrawlKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, limit }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Firecrawl search failed: ${response.status} ${error}`);
  }

  const data = (await response.json()) as {
    success: boolean;
    data: Array<{
      title: string;
      url: string;
      markdown?: string;
      description?: string;
    }>;
  };

  return (data.data ?? []).map((r) => ({
    title: r.title ?? "",
    url: r.url,
    content: (r.markdown ?? r.description ?? "").slice(0, 500),
  }));
}
