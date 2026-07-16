-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- ============ sources ============
CREATE TABLE public.sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,          -- 'reddit' | 'rss' | 'hn' | 'google_news'
  url text NOT NULL,
  label text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  last_polled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sources TO authenticated;
GRANT ALL ON public.sources TO service_role;
ALTER TABLE public.sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read sources" ON public.sources FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write sources" ON public.sources FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ items ============
CREATE TABLE public.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.sources(id) ON DELETE SET NULL,
  source_kind text NOT NULL,
  source_label text NOT NULL,
  external_id text,
  url text NOT NULL,
  url_hash text NOT NULL UNIQUE,
  title text NOT NULL,
  body text,
  author text,
  published_at timestamptz NOT NULL,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX items_published_at_idx ON public.items (published_at DESC);
CREATE INDEX items_source_kind_idx ON public.items (source_kind);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO authenticated;
GRANT ALL ON public.items TO service_role;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read items" ON public.items FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write items" ON public.items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ item_analysis ============
CREATE TABLE public.item_analysis (
  item_id uuid PRIMARY KEY REFERENCES public.items(id) ON DELETE CASCADE,
  bucket text NOT NULL,        -- Hiring | Projects | Money | Community | Company | Noise
  skills text[] NOT NULL DEFAULT '{}',
  countries text[] NOT NULL DEFAULT '{}',
  project_names text[] NOT NULL DEFAULT '{}',
  pay_amount numeric,
  sentiment text,              -- positive | neutral | negative
  signal_score int NOT NULL DEFAULT 0, -- 0-100
  summary text NOT NULL,
  embedding vector(768),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX item_analysis_bucket_idx ON public.item_analysis (bucket);
CREATE INDEX item_analysis_signal_idx ON public.item_analysis (signal_score DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.item_analysis TO authenticated;
GRANT ALL ON public.item_analysis TO service_role;
ALTER TABLE public.item_analysis ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read analysis" ON public.item_analysis FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write analysis" ON public.item_analysis FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ daily_briefs ============
CREATE TABLE public.daily_briefs (
  brief_date date PRIMARY KEY,
  markdown text NOT NULL,
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  bucket_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  confidence text NOT NULL DEFAULT 'Medium',
  item_count int NOT NULL DEFAULT 0,
  posted_to_slack boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_briefs TO authenticated;
GRANT ALL ON public.daily_briefs TO service_role;
ALTER TABLE public.daily_briefs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read briefs" ON public.daily_briefs FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write briefs" ON public.daily_briefs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ weekly_reports ============
CREATE TABLE public.weekly_reports (
  week_start date PRIMARY KEY,
  markdown text NOT NULL,
  trends jsonb NOT NULL DEFAULT '{}'::jsonb,
  posted_to_slack boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.weekly_reports TO authenticated;
GRANT ALL ON public.weekly_reports TO service_role;
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read weekly" ON public.weekly_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth write weekly" ON public.weekly_reports FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============ chat_messages ============
CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role text NOT NULL,
  content text NOT NULL,
  citations jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX chat_messages_user_created_idx ON public.chat_messages (user_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chat" ON public.chat_messages FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Semantic search RPC over item_analysis
CREATE OR REPLACE FUNCTION public.search_items(
  query_embedding vector(768),
  match_count int DEFAULT 10
)
RETURNS TABLE (
  item_id uuid,
  title text,
  url text,
  summary text,
  bucket text,
  published_at timestamptz,
  similarity float
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT i.id, i.title, i.url, a.summary, a.bucket, i.published_at,
         1 - (a.embedding <=> query_embedding) AS similarity
  FROM public.item_analysis a
  JOIN public.items i ON i.id = a.item_id
  WHERE a.embedding IS NOT NULL
  ORDER BY a.embedding <=> query_embedding
  LIMIT match_count;
$$;
GRANT EXECUTE ON FUNCTION public.search_items(vector, int) TO authenticated;

-- Seed default sources
INSERT INTO public.sources (kind, url, label) VALUES
  ('reddit', 'https://www.reddit.com/r/mercor_ai/new.json?limit=50', 'r/mercor_ai'),
  ('reddit', 'https://www.reddit.com/r/Mercor_contractors/new.json?limit=50', 'r/Mercor_contractors'),
  ('reddit', 'https://www.reddit.com/r/OutlierAI/search.json?q=mercor&restrict_sr=1&sort=new&limit=25', 'r/OutlierAI (mercor)'),
  ('reddit', 'https://www.reddit.com/r/forhire/search.json?q=mercor&restrict_sr=1&sort=new&limit=25', 'r/forhire (mercor)'),
  ('google_news', 'https://news.google.com/rss/search?q=mercor+ai&hl=en-US&gl=US&ceid=US:en', 'Google News: Mercor'),
  ('hn', 'https://hn.algolia.com/api/v1/search_by_date?query=mercor&tags=story', 'Hacker News: mercor');
