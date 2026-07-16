import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { createLovableAi } from "@/lib/ai-gateway.server";
import { postSlackMessage } from "@/lib/slack.server";

function weekStart(d: Date): string {
  const day = d.getUTCDay();
  const diff = (day + 6) % 7; // Monday start
  const ws = new Date(d);
  ws.setUTCDate(d.getUTCDate() - diff);
  return ws.toISOString().slice(0, 10);
}

export const Route = createFileRoute("/api/public/cron/weekly-report")({
  server: {
    handlers: {
      POST: async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const now = new Date();
        const ws = weekStart(now);
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const priorSince = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();

        const { data: current } = await supabaseAdmin
          .from("items")
          .select("id,title,url,source_label,published_at,item_analysis(bucket,summary,signal_score,skills,pay_amount)")
          .gte("published_at", since)
          .limit(500);
        const { data: prior } = await supabaseAdmin
          .from("items")
          .select("id,item_analysis(bucket,skills)")
          .gte("published_at", priorSince)
          .lt("published_at", since)
          .limit(500);

        const summarize = (rows: any[]) => {
          const buckets: Record<string, number> = {};
          const skills: Record<string, number> = {};
          for (const r of rows) {
            const a = r.item_analysis;
            if (!a) continue;
            buckets[a.bucket] = (buckets[a.bucket] ?? 0) + 1;
            for (const s of a.skills ?? []) skills[s] = (skills[s] ?? 0) + 1;
          }
          return { buckets, skills };
        };
        const cur = summarize(current ?? []);
        const prev = summarize(prior ?? []);

        const top = (current ?? [])
          .filter((r: any) => r.item_analysis && r.item_analysis.bucket !== "Noise")
          .sort((a: any, b: any) => (b.item_analysis.signal_score ?? 0) - (a.item_analysis.signal_score ?? 0))
          .slice(0, 40)
          .map((r: any) => `- [${r.item_analysis.bucket}] ${r.title} — ${r.item_analysis.summary}`)
          .join("\n");

        const gateway = createLovableAi();
        const model = gateway("google/gemini-3-flash-preview");
        const { text: markdown } = await generateText({
          model,
          system: `You write "Mercor Weekly Deep Report" for a solo AI contractor. Compare this week vs last week. Terse markdown.`,
          prompt: `Week of: ${ws}
This week counts: ${JSON.stringify(cur)}
Prior week counts: ${JSON.stringify(prev)}

Top items this week:
${top}

Write sections:
## Mercor Weekly Deep Report — ${ws}
### Hiring trends (week-over-week)
### Skills in demand (up / down / new)
### Interview & evaluation changes
### Compensation trends
### Risk alerts
### Recommended learning topics
### Predicted opportunities for the coming week`,
        });

        await supabaseAdmin.from("weekly_reports").upsert({
          week_start: ws,
          markdown,
          trends: { current: cur, prior: prev },
          posted_to_slack: false,
        });

        const slackText = `*Mercor Weekly Deep Report — ${ws}*\nSee dashboard for full report. Items this week: ${(current ?? []).length} (prior: ${(prior ?? []).length}).`;
        const r = await postSlackMessage(slackText);
        if (r?.ok) {
          await supabaseAdmin.from("weekly_reports").update({ posted_to_slack: true }).eq("week_start", ws);
        }

        return Response.json({ ok: true });
      },
    },
  },
});