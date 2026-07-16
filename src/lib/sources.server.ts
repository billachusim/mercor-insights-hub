import { createHash } from "node:crypto";
import type { Database } from "@/integrations/supabase/types";

type Json = Database["public"]["Tables"]["items"]["Insert"]["raw"];

export type NewItem = {
  source_kind: string;
  source_label: string;
  source_id: string | null;
  external_id: string | null;
  url: string;
  url_hash: string;
  title: string;
  body: string | null;
  author: string | null;
  published_at: string;
  raw: Json;
};

function hashUrl(url: string): string {
  return createHash("sha256").update(url).digest("hex").slice(0, 40);
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const UA = "MercorIntelligence/1.0 (+https://lovable.dev)";

export async function fetchReddit(
  sourceId: string,
  label: string,
  url: string,
): Promise<NewItem[]> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    console.error(`reddit ${label} ${res.status}`);
    return [];
  }
  const json = (await res.json()) as any;
  const children = json?.data?.children ?? [];
  return children
    .map((c: any) => c.data)
    .filter((d: any) => d && d.url && d.title)
    .map((d: any) => {
      const permalink = `https://www.reddit.com${d.permalink}`;
      return {
        source_kind: "reddit",
        source_label: label,
        source_id: sourceId,
        external_id: d.id,
        url: permalink,
        url_hash: hashUrl(permalink),
        title: d.title,
        body: d.selftext || null,
        author: d.author || null,
        published_at: new Date((d.created_utc ?? 0) * 1000).toISOString(),
        raw: {
          score: d.score,
          num_comments: d.num_comments,
          subreddit: d.subreddit,
          link_flair_text: d.link_flair_text,
        },
      } satisfies NewItem;
    });
}

function parseRssItems(xml: string): Array<{
  title: string;
  link: string;
  pubDate: string | null;
  description: string | null;
  guid: string | null;
}> {
  const items: Array<{
    title: string;
    link: string;
    pubDate: string | null;
    description: string | null;
    guid: string | null;
  }> = [];
  const itemRe = /<item[\s\S]*?<\/item>/gi;
  const matches = xml.match(itemRe) ?? [];
  for (const raw of matches) {
    const get = (tag: string) => {
      const m = raw.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
      if (!m) return null;
      let v = m[1].trim();
      v = v.replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
      return v;
    };
    const title = get("title");
    const link = get("link");
    if (!title || !link) continue;
    items.push({
      title: stripHtml(title),
      link: link.trim(),
      pubDate: get("pubDate"),
      description: get("description"),
      guid: get("guid"),
    });
  }
  return items;
}

export async function fetchRss(
  sourceId: string,
  label: string,
  url: string,
  kind: string,
): Promise<NewItem[]> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) {
    console.error(`rss ${label} ${res.status}`);
    return [];
  }
  const xml = await res.text();
  const parsed = parseRssItems(xml);
  return parsed.map((p) => {
    const published = p.pubDate ? new Date(p.pubDate).toISOString() : new Date().toISOString();
    return {
      source_kind: kind,
      source_label: label,
      source_id: sourceId,
      external_id: p.guid ?? null,
      url: p.link,
      url_hash: hashUrl(p.link),
      title: p.title,
      body: p.description ? stripHtml(p.description) : null,
      author: null,
      published_at: published,
      raw: {},
    } satisfies NewItem;
  });
}

export async function fetchHackerNews(
  sourceId: string,
  label: string,
  url: string,
): Promise<NewItem[]> {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) return [];
  const json = (await res.json()) as any;
  const hits = json?.hits ?? [];
  return hits
    .filter((h: any) => h.url || h.story_url)
    .map((h: any) => {
      const link = h.url || h.story_url || `https://news.ycombinator.com/item?id=${h.objectID}`;
      return {
        source_kind: "hn",
        source_label: label,
        source_id: sourceId,
        external_id: String(h.objectID ?? ""),
        url: link,
        url_hash: hashUrl(link),
        title: h.title || h.story_title || "(untitled)",
        body: h.story_text || null,
        author: h.author || null,
        published_at: h.created_at ?? new Date().toISOString(),
        raw: { points: h.points, num_comments: h.num_comments },
      } satisfies NewItem;
    });
}

export async function fetchSource(source: {
  id: string;
  kind: string;
  url: string;
  label: string;
}): Promise<NewItem[]> {
  try {
    if (source.kind === "reddit") return await fetchReddit(source.id, source.label, source.url);
    if (source.kind === "hn") return await fetchHackerNews(source.id, source.label, source.url);
    if (source.kind === "rss" || source.kind === "google_news") {
      return await fetchRss(source.id, source.label, source.url, source.kind);
    }
  } catch (e) {
    console.error(`fetchSource ${source.label}`, e);
  }
  return [];
}