import { createFileRoute } from "@tanstack/react-router";
import { fetchSource, type NewItem } from "@/lib/sources.server";
import { analyzeItem } from "@/lib/analyze.server";
import { postSlackMessage } from "@/lib/slack.server";

export const Route = createFileRoute("/api/public/cron/ingest")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: sources, error: sErr } = await supabaseAdmin
          .from("sources")
          .select("id,kind,url,label,active")
          .eq("active", true);
        if (sErr) return Response.json({ ok: false, error: sErr.message }, { status: 500 });

        let totalFetched = 0;
        let totalInserted = 0;
        let totalAnalyzed = 0;
        const highSignal: Array<{ title: string; url: string; bucket: string; summary: string }> = [];

        for (const source of sources ?? []) {
          const items = await fetchSource(source);
          totalFetched += items.length;
          if (items.length === 0) continue;

          // Dedup: skip items whose url_hash already exists
          const hashes = items.map((i) => i.url_hash);
          const { data: existing } = await supabaseAdmin
            .from("items")
            .select("url_hash")
            .in("url_hash", hashes);
          const existingSet = new Set((existing ?? []).map((r: { url_hash: string }) => r.url_hash));
          const fresh: NewItem[] = items.filter((i) => !existingSet.has(i.url_hash));
          if (fresh.length === 0) {
            await supabaseAdmin.from("sources").update({ last_polled_at: new Date().toISOString() }).eq("id", source.id);
            continue;
          }

          const { data: inserted, error: insErr } = await supabaseAdmin
            .from("items")
            .insert(fresh)
            .select("id,title,body,source_label,url");
          if (insErr) {
            console.error("insert error", insErr);
            continue;
          }
          totalInserted += inserted?.length ?? 0;

          // Analyze each newly inserted item (cap per run to avoid runaway)
          const toAnalyze = (inserted ?? []).slice(0, 20);
          for (const item of toAnalyze) {
            try {
              const { analysis, embedding } = await analyzeItem({
                title: item.title,
                body: item.body,
                source: item.source_label,
                url: item.url,
              });
              await supabaseAdmin.from("item_analysis").upsert({
                item_id: item.id,
                bucket: analysis.bucket,
                skills: analysis.skills,
                countries: analysis.countries,
                project_names: analysis.project_names,
                pay_amount: analysis.pay_amount,
                sentiment: analysis.sentiment,
                signal_score: Math.round(analysis.signal_score),
                summary: analysis.summary,
                embedding: embedding ? (`[${embedding.join(",")}]` as unknown as string) : null,
              });
              totalAnalyzed += 1;
              if (analysis.signal_score >= 70 && analysis.bucket !== "Noise") {
                highSignal.push({
                  title: item.title,
                  url: item.url,
                  bucket: analysis.bucket,
                  summary: analysis.summary,
                });
              }
            } catch (e) {
              console.error("analyze error", e);
            }
          }
          await supabaseAdmin.from("sources").update({ last_polled_at: new Date().toISOString() }).eq("id", source.id);
        }

        // Push high-signal items to Slack (rate-limit: max 5 per run)
        for (const hit of highSignal.slice(0, 5)) {
          const text = `:zap: *High-signal ${hit.bucket}* — ${hit.title}\n${hit.summary}\n<${hit.url}|Open>`;
          await postSlackMessage(text);
        }

        return Response.json({
          ok: true,
          fetched: totalFetched,
          inserted: totalInserted,
          analyzed: totalAnalyzed,
          high_signal: highSignal.length,
        });
      },
    },
  },
});