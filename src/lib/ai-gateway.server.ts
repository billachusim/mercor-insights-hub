import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createLovableAi() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": key,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
}

export async function embedText(text: string): Promise<number[] | null> {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({
      model: "google/gemini-embedding-001",
      input: text.slice(0, 8000),
      dimensions: 768,
    }),
  });
  if (!res.ok) {
    console.error("embed error", res.status, await res.text());
    return null;
  }
  const json = (await res.json()) as { data?: Array<{ embedding: number[] }> };
  return json.data?.[0]?.embedding ?? null;
}