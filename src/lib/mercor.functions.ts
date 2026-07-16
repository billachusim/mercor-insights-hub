import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AskInput = z.object({ question: z.string().min(1).max(500) });

export const askMercor = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AskInput.parse(input))
  .handler(async ({ data, context }) => {
    const { embedText, createLovableAi } = await import("@/lib/ai-gateway.server");
    const { generateText: gen } = await import("ai");
    void gen;

    const emb = await embedText(data.question);
    let sources: Array<{
      title: string;
      url: string;
      summary: string;
      bucket: string;
      published_at: string;
    }> = [];

    if (emb) {
      const { data: hits, error } = await context.supabase.rpc("search_items", {
        query_embedding: `[${emb.join(",")}]` as unknown as string,
        match_count: 12,
      });
      if (!error && hits) {
        sources = (hits as any[]).map((h) => ({
          title: h.title,
          url: h.url,
          summary: h.summary,
          bucket: h.bucket,
          published_at: h.published_at,
        }));
      }
    }

    if (sources.length === 0) {
      // Fallback: recent items
      const { data: recent } = await context.supabase
        .from("items")
        .select("title,url,published_at,item_analysis(bucket,summary)")
        .order("published_at", { ascending: false })
        .limit(15);
      sources = (recent ?? [])
        .filter((r: any) => r.item_analysis)
        .map((r: any) => ({
          title: r.title,
          url: r.url,
          summary: r.item_analysis.summary,
          bucket: r.item_analysis.bucket,
          published_at: r.published_at,
        }));
    }

    const context_str = sources
      .map((s, i) => `[${i + 1}] (${s.bucket}, ${s.published_at.slice(0, 10)}) ${s.title}\n${s.summary}\nURL: ${s.url}`)
      .join("\n\n");

    const gateway = createLovableAi();
    const model = gateway("google/gemini-3-flash-preview");
    const { text } = await generateText({
      model,
      system: `You answer questions about Mercor using only the provided sources. Cite sources inline as [1], [2] etc. If sources don't cover the question, say so.`,
      prompt: `Question: ${data.question}\n\nSources:\n${context_str}`,
    });

    // Save chat history
    await context.supabase.from("chat_messages").insert([
      { user_id: context.userId, role: "user", content: data.question },
      { user_id: context.userId, role: "assistant", content: text, citations: sources as unknown as any },
    ]);

    return { answer: text, sources };
  });

export const triggerIngest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const url = `${process.env.SUPABASE_URL?.replace(/\.supabase\.co.*/, "")}`; // unused
    void url;
    // Call our own public cron endpoint
    const origin = process.env.APP_ORIGIN ?? "";
    const target = origin ? `${origin}/api/public/cron/ingest` : "/api/public/cron/ingest";
    try {
      const res = await fetch(target, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      return { ok: res.ok, body };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  });

export const triggerDailyBrief = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const origin = process.env.APP_ORIGIN ?? "";
    const target = origin ? `${origin}/api/public/cron/daily-brief` : "/api/public/cron/daily-brief";
    const res = await fetch(target, { method: "POST" });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, body };
  });