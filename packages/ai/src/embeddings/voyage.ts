// ============================================================
// Voyage AI — embeddings optimizados para retrieval con Claude
// API Docs: https://docs.voyageai.com/reference/embeddings-api
// ============================================================

const VOYAGE_API_URL = "https://api.voyageai.com/v1/embeddings";
const VOYAGE_MODEL = "voyage-3-lite"; // Mejor balance calidad/costo para fase 1
const EMBEDDING_DIMS = 512; // voyage-3-lite produce 512 dimensiones

export { EMBEDDING_DIMS };

export interface EmbeddingResult {
  embedding: number[];
  tokenCount: number;
}

// ============================================================
// embedText — genera embedding para un texto
// ============================================================

export async function embedText(text: string): Promise<EmbeddingResult> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing VOYAGE_API_KEY environment variable.");
  }

  const response = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: [text],
      model: VOYAGE_MODEL,
      input_type: "document",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Voyage AI embedding failed: ${response.status} ${error}`);
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[] }>;
    usage: { total_tokens: number };
  };

  return {
    embedding: data.data[0].embedding,
    tokenCount: data.usage.total_tokens,
  };
}

// ============================================================
// embedQuery — para búsquedas (input_type diferente)
// ============================================================

export async function embedQuery(query: string): Promise<EmbeddingResult> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing VOYAGE_API_KEY environment variable.");
  }

  const response = await fetch(VOYAGE_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      input: [query],
      model: VOYAGE_MODEL,
      input_type: "query", // Diferente para búsquedas vs documentos
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `Voyage AI query embedding failed: ${response.status} ${error}`,
    );
  }

  const data = (await response.json()) as {
    data: Array<{ embedding: number[] }>;
    usage: { total_tokens: number };
  };

  return {
    embedding: data.data[0].embedding,
    tokenCount: data.usage.total_tokens,
  };
}

// ============================================================
// embedBatch — para procesar múltiples textos eficientemente
// ============================================================

export async function embedBatch(texts: string[]): Promise<EmbeddingResult[]> {
  const apiKey = process.env.VOYAGE_API_KEY;
  if (!apiKey) {
    throw new Error("Missing VOYAGE_API_KEY environment variable.");
  }

  // Voyage permite hasta 128 textos por request
  const BATCH_SIZE = 64;
  const results: EmbeddingResult[] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);

    const response = await fetch(VOYAGE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        input: batch,
        model: VOYAGE_MODEL,
        input_type: "document",
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Voyage AI batch embedding failed: ${response.status} ${error}`,
      );
    }

    const data = (await response.json()) as {
      data: Array<{ embedding: number[]; index: number }>;
      usage: { total_tokens: number };
    };

    // Ordenar por index para mantener el orden original
    const sorted = data.data.sort((a, b) => a.index - b.index);
    const tokensPerDoc = Math.ceil(data.usage.total_tokens / batch.length);

    for (const item of sorted) {
      results.push({
        embedding: item.embedding,
        tokenCount: tokensPerDoc,
      });
    }
  }

  return results;
}

// ============================================================
// cosineSimilarity — utilidad para comparar embeddings
// ============================================================

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(
      `Embedding dimensions mismatch: ${a.length} vs ${b.length}`,
    );
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;

  return dotProduct / denominator;
}
