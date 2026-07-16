import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { askMercor, triggerIngest, triggerDailyBrief } from "@/lib/mercor.functions";

type Brief = {
  brief_date: string;
  markdown: string;
  highlights: string[];
  action_items: string[];
  bucket_counts: Record<string, number>;
  confidence: string;
  item_count: number;
};

type Item = {
  id: string;
  title: string;
  url: string;
  source_label: string;
  published_at: string;
  item_analysis: {
    bucket: string;
    summary: string;
    signal_score: number;
    skills: string[];
  } | null;
};

type WeeklyReport = {
  week_start: string;
  markdown: string;
};

const BUCKET_COLORS: Record<string, string> = {
  Hiring: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  Projects: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  Money: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20",
  Community: "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20",
  Company: "bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20",
  Noise: "bg-muted text-muted-foreground border-border",
};

export function Dashboard() {
  const navigate = useNavigate();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<Item[]>([]);
  const [reports, setReports] = useState<WeeklyReport[]>([]);
  const [bucketFilter, setBucketFilter] = useState<string>("all");
  const [busy, setBusy] = useState<string | null>(null);

  const ingestFn = useServerFn(triggerIngest);
  const briefFn = useServerFn(triggerDailyBrief);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [{ data: briefRow }, { data: itemRows }, { data: reportRows }] = await Promise.all([
      supabase.from("daily_briefs").select("*").order("brief_date", { ascending: false }).limit(1).maybeSingle(),
      supabase
        .from("items")
        .select("id,title,url,source_label,published_at,item_analysis(bucket,summary,signal_score,skills)")
        .order("published_at", { ascending: false })
        .limit(100),
      supabase.from("weekly_reports").select("week_start,markdown").order("week_start", { ascending: false }).limit(8),
    ]);
    setBrief(briefRow as Brief | null);
    setItems((itemRows as unknown as Item[]) ?? []);
    setReports((reportRows as WeeklyReport[]) ?? []);
    setLoading(false);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  async function runIngest() {
    setBusy("ingest");
    try {
      const res = await ingestFn();
      if (res.ok) {
        toast.success(`Ingested. ${JSON.stringify(res.body)}`);
        await load();
      } else {
        toast.error("Ingest failed");
      }
    } finally {
      setBusy(null);
    }
  }

  async function runBrief() {
    setBusy("brief");
    try {
      const res = await briefFn();
      if (res.ok) {
        toast.success("Brief generated");
        await load();
      } else {
        toast.error("Brief failed");
      }
    } finally {
      setBusy(null);
    }
  }

  const filteredItems = useMemo(() => {
    if (bucketFilter === "all") return items;
    return items.filter((i) => i.item_analysis?.bucket === bucketFilter);
  }, [items, bucketFilter]);

  const trendData = useMemo(() => {
    const skills: Record<string, number> = {};
    const buckets: Record<string, number> = {};
    const sevenDayCutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    for (const it of items) {
      if (new Date(it.published_at).getTime() < sevenDayCutoff) continue;
      if (!it.item_analysis) continue;
      buckets[it.item_analysis.bucket] = (buckets[it.item_analysis.bucket] ?? 0) + 1;
      for (const s of it.item_analysis.skills ?? []) skills[s] = (skills[s] ?? 0) + 1;
    }
    return {
      buckets: Object.entries(buckets).sort((a, b) => b[1] - a[1]),
      skills: Object.entries(skills).sort((a, b) => b[1] - a[1]).slice(0, 15),
    };
  }, [items]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Mercor Intelligence</h1>
            <p className="text-xs text-muted-foreground">Private daily brief</p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={runIngest} disabled={busy !== null}>
              {busy === "ingest" ? "Ingesting…" : "Ingest now"}
            </Button>
            <Button size="sm" variant="outline" onClick={runBrief} disabled={busy !== null}>
              {busy === "brief" ? "Generating…" : "Generate brief"}
            </Button>
            <Button size="sm" variant="ghost" onClick={signOut}>Sign out</Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs defaultValue="today" className="space-y-6">
          <TabsList>
            <TabsTrigger value="today">Today</TabsTrigger>
            <TabsTrigger value="feed">Feed</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
            <TabsTrigger value="weekly">Weekly</TabsTrigger>
            <TabsTrigger value="ask">Ask</TabsTrigger>
          </TabsList>

          <TabsContent value="today" className="space-y-4">
            {loading ? (
              <Skeleton className="h-96 w-full" />
            ) : brief ? (
              <Card className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {brief.brief_date} · {brief.item_count} items
                  </div>
                  <Badge variant="outline">Confidence: {brief.confidence}</Badge>
                </div>
                <article className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{brief.markdown}</ReactMarkdown>
                </article>
              </Card>
            ) : (
              <Card className="p-6 text-center text-muted-foreground">
                No brief yet. Click <b>Ingest now</b> then <b>Generate brief</b>.
              </Card>
            )}
          </TabsContent>

          <TabsContent value="feed" className="space-y-4">
            <div className="flex items-center gap-2">
              <Select value={bucketFilter} onValueChange={setBucketFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All buckets</SelectItem>
                  {Object.keys(BUCKET_COLORS).map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">{filteredItems.length} items</span>
            </div>
            <div className="space-y-2">
              {filteredItems.map((it) => (
                <Card key={it.id} className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {it.item_analysis && (
                          <Badge className={BUCKET_COLORS[it.item_analysis.bucket] ?? ""} variant="outline">
                            {it.item_analysis.bucket}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">{it.source_label}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(it.published_at).toLocaleString()}
                        </span>
                      </div>
                      <a href={it.url} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                        {it.title}
                      </a>
                      {it.item_analysis?.summary && (
                        <p className="text-sm text-muted-foreground mt-1">{it.item_analysis.summary}</p>
                      )}
                    </div>
                    {it.item_analysis && (
                      <div className="text-xs text-muted-foreground shrink-0">
                        signal {it.item_analysis.signal_score}
                      </div>
                    )}
                  </div>
                </Card>
              ))}
              {filteredItems.length === 0 && (
                <Card className="p-6 text-center text-muted-foreground">No items yet.</Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="trends" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4">
                <h3 className="font-medium mb-3">Buckets · last 7 days</h3>
                <div className="space-y-2">
                  {trendData.buckets.map(([b, n]) => (
                    <div key={b} className="flex items-center gap-2">
                      <span className="text-sm w-24">{b}</span>
                      <div className="flex-1 h-2 bg-muted rounded overflow-hidden">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${Math.min(100, (n / (trendData.buckets[0]?.[1] ?? 1)) * 100)}%` }}
                        />
                      </div>
                      <span className="text-sm text-muted-foreground w-8 text-right">{n}</span>
                    </div>
                  ))}
                  {trendData.buckets.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
                </div>
              </Card>
              <Card className="p-4">
                <h3 className="font-medium mb-3">Top skills mentioned · last 7 days</h3>
                <div className="flex flex-wrap gap-2">
                  {trendData.skills.map(([s, n]) => (
                    <Badge key={s} variant="secondary">
                      {s} · {n}
                    </Badge>
                  ))}
                  {trendData.skills.length === 0 && <p className="text-sm text-muted-foreground">No data yet.</p>}
                </div>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="weekly" className="space-y-4">
            {reports.length === 0 && (
              <Card className="p-6 text-center text-muted-foreground">No weekly reports yet.</Card>
            )}
            {reports.map((r) => (
              <Card key={r.week_start} className="p-6">
                <div className="text-xs text-muted-foreground mb-3">Week of {r.week_start}</div>
                <article className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{r.markdown}</ReactMarkdown>
                </article>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="ask">
            <AskPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function AskPanel() {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<Array<{ title: string; url: string; bucket: string }>>([]);
  const askFn = useServerFn(askMercor);

  async function submit() {
    if (!question.trim()) return;
    setBusy(true);
    setAnswer(null);
    setSources([]);
    try {
      const res = await askFn({ data: { question } });
      setAnswer(res.answer);
      setSources(res.sources);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <Textarea
          placeholder="e.g. What's changed since yesterday? Any new Python projects? Highest-paying project this month?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          rows={3}
        />
        <Button onClick={submit} disabled={busy || !question.trim()}>
          {busy ? "Thinking…" : "Ask"}
        </Button>
      </Card>
      {answer && (
        <Card className="p-6">
          <article className="prose prose-sm dark:prose-invert max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
          </article>
          {sources.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border">
              <h4 className="text-xs font-medium text-muted-foreground mb-2">Sources</h4>
              <ol className="space-y-1 text-sm">
                {sources.map((s, i) => (
                  <li key={i}>
                    <span className="text-muted-foreground">[{i + 1}]</span>{" "}
                    <a href={s.url} target="_blank" rel="noreferrer" className="hover:underline">
                      {s.title}
                    </a>{" "}
                    <Badge variant="outline" className="text-xs">{s.bucket}</Badge>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}

// unused import guard
void Input;
void ScrollArea;