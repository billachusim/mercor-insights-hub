import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAi } from "@/lib/ai-gateway.server";
import { postSlackMessage } from "@/lib/slack.server";

export const Route = createFileRoute("/api/public/cron/daily-brief")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const today = new Date().toISOString().slice(0, 10);

        const { data: rows } = await supabaseAdmin
          .from("items")
          .select("id,title,url,source_label,published_at,item_analysis(bucket,summary,signal_score,skills,countries,pay_amount)")
          .gte("published_at", since)
          .order("published_at", { ascending: false })
          .limit(200);

        const items = (rows ?? []).filter((r: any) => r.item_analysis);
        const bucketCounts: Record<string, number> = {};
        const skillCounts: Record<string, number> = {};
        const countryCounts: Record<string, number> = {};
        for (const r of items as any[]) {
          const a = r.item_analysis;
          bucketCounts[a.bucket] = (bucketCounts[a.bucket] ?? 0) + 1;
          for (const s of a.skills ?? []) skillCounts[s] = (skillCounts[s] ?? 0) + 1;
          for (const c of a.countries ?? []) countryCounts[c] = (countryCounts[c] ?? 0) + 1;
        }

        const top = items
          .filter((r: any) => r.item_analysis.bucket !== "Noise")
          .sort((a: any, b: any) => (b.item_analysis.signal_score ?? 0) - (a.item_analysis.signal_score ?? 0))
          .slice(0, 25);

        const digestText = top
          .map((r: any) => `- [${r.item_analysis.bucket}] ${r.title} (${r.source_label}) — ${r.item_analysis.summary} :: ${r.url}`)
          .join("\n");

        const gateway = createLovableAi();
        const model = gateway("google/gemini-3-flash-preview");

        const { text: markdown } = await generateText({
          model,
          system: `You write "Mercor Daily Intelligence" briefs for a solo AI contractor. Style: terse, factual, scannable. Use markdown headings.`,
          prompt: `Date: ${today}\nItems in last 24h: ${items.length}\nBucket counts: ${JSON.stringify(bucketCounts)}\nTop skills: ${JSON.stringify(skillCounts)}\nTop countries: ${JSON.stringify(countryCounts)}\n\nRaw digest:\n${digestText}\n\nWrite:\n## Mercor Daily Intelligence — ${today}\nShort intro sentence.\n### Highlights (3-6 bullets, most important developments)\n### Hiring & Projects (2-4 bullets)\n### Money (bullets or "no changes")\n### Community (bullets or "no changes")\n### Company (bullets or "no changes")\n### Action Items (3-5 concrete things the contractor should do this week)\n### Confidence: High | Medium | Low + one-line reason.`,
        });

        const HighlightsSchema = z.object({
          highlights: z.array(z.string()),
          action_items: z.array(z.string()),
          confidence: z.enum(["High", "Medium", "Low"]),
        });
        let structured: z.infer<typeof HighlightsSchema> = {
          highlights: [],
          action_items: [],
          confidence: items.length >= 10 ? "High" : items.length >= 3 ? "Medium" : "Low",
        };
        try {
          const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Lovable-API-Key": process.env.LOVABLE_API_KEY!,
            },
            body: JSON.stringify({
              model: "google/gemini-3-flash-preview",
              messages: [
                { role: "system", content: "Extract JSON from the brief. Return only JSON matching {highlights: string[], action_items: string[], confidence: 'High'|'Medium'|'Low'}." },
                { role: "user", content: markdown },
              ],
              response_format: { type: "json_object" },
            }),
          });
          if (res.ok) {
            const j = (await res.json()) as any;
            const content = j.choices?.[0]?.message?.content;
            if (content) {
              const parsed = HighlightsSchema.safeParse(JSON.parse(content));
              if (parsed.success) structured = parsed.data;
            }
          }
        } catch (e) {
          console.error("brief extract", e);
        }

        await supabaseAdmin.from("daily_briefs").upsert({
          brief_date: today,
          markdown,
          highlights: structured.highlights,
          action_items: structured.action_items,
          bucket_counts: bucketCounts,
          confidence: structured.confidence,
          item_count: items.length,
          posted_to_slack: false,
        });

        // Slack post
        const slackText = `*Mercor Daily Intelligence — ${today}*\n${items.length} new items in last 24h.\n\n*Highlights*\n${structured.highlights.map((h) => `• ${h}`).join("\n") || "—"}\n\n*Action items*\n${structured.action_items.map((a) => `• ${a}`).join("\n") || "—"}\n\nConfidence: *${structured.confidence}*`;
        const slackRes = await postSlackMessage(slackText);
        if (slackRes?.ok) {
          await supabaseAdmin.from("daily_briefs").update({ posted_to_slack: true }).eq("brief_date", today);
        }

        return Response.json({ ok: true, item_count: items.length, confidence: structured.confidence });
      },
    },
  },
});