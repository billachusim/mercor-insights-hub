## Mercor Intelligence — Phase 1 MVP

A private, single-user dashboard that continuously ingests Mercor-related chatter, uses AI to summarize/classify it, and surfaces daily briefs, weekly deep reports, and natural-language Q&A. Delivery: in-app dashboard + Slack push (WhatsApp isn't natively supported; if wanted later, we'd route via Twilio as a follow-up).

### What ships in v1

1. **Sources ingested (scheduled every ~30 min):**
   - Reddit JSON API: `r/mercor_ai`, `r/Mercor_contractors`, plus keyword search for "mercor" in `r/OutlierAI`, `r/artificial`, `r/forhire`.
   - Google News RSS (query: "Mercor") + Hacker News Algolia API + TechCrunch/Forbes RSS filtered for "mercor".
   - All items deduped by URL hash.

2. **Intelligence layer (per item + daily rollup):**
   - Each new item → Lovable AI (`google/gemini-3-flash-preview`) classifies into buckets: Hiring, Projects, Money, Community, Company, Noise.
   - Extracts entities: skills mentioned, countries, project names, pay figures, sentiment.
   - Daily job (7am local) rolls up last 24h → generates the "Mercor Daily Intelligence" brief with counts, highlights, and action items.
   - Weekly job (Sunday) generates a deep report: trends across last 7 days vs prior 7 days.
   - Confidence score = f(source count, agreement across sources).

3. **Dashboard (private, gated by simple auth — just you):**
   - **Today** — current daily brief, highlights, action items, confidence score.
   - **Feed** — chronological stream of raw items with bucket tags, filter by bucket/source/date.
   - **Trends** — small charts: items/day per bucket, top skills this week, top countries.
   - **Weekly Reports** — archive of Sunday deep reports.
   - **Ask** — chat box; RAG over stored items + summaries (semantic search via pgvector).

4. **Slack delivery:**
   - Daily brief posted to a Slack channel each morning.
   - "High-signal" items (pay changes, new project types, CEO posts) pushed in near-real-time.

### Technical section

- **Stack:** TanStack Start (existing), Lovable Cloud (Postgres + auth + storage), Lovable AI Gateway, Slack connector.
- **Auth:** Email/password sign-in, single user (you). RLS scoping everything to your `auth.uid()`.
- **Schema (migration):**
  - `sources` (id, kind, url, label, active)
  - `items` (id, source_id, external_id, url, title, body, author, published_at, url_hash unique, raw jsonb)
  - `item_analysis` (item_id PK, bucket, skills[], countries[], pay_amount, sentiment, summary, embedding vector(768))
  - `daily_briefs` (date PK, markdown, highlights jsonb, action_items jsonb, confidence)
  - `weekly_reports` (week_start PK, markdown, trends jsonb)
  - `chat_messages` (id, role, content, created_at) for Ask history
  - All tables: RLS + explicit GRANTs; `has_role`-style admin not needed (single user).
- **Ingestion:** TanStack server route at `src/routes/api/public/cron/ingest.ts` — verifies a `CRON_SECRET` header, pulls each source, inserts new items, enqueues analysis. Called by pg_cron every 30 min hitting the stable `project--{id}.lovable.app` URL.
- **Analysis:** Server function `analyzeItem` calls Gemini with structured output (Zod schema for bucket + entities + summary), then embeds summary with `google/gemini-embedding-001` and stores.
- **Daily/weekly briefs:** Separate cron routes (`/api/public/cron/daily-brief`, `/weekly-report`) — pull last N hours of items+analysis, prompt Gemini for the rollup, save to `daily_briefs`/`weekly_reports`, then post to Slack via connector gateway (`chat.postMessage`).
- **Ask (RAG):** `createServerFn` under `_authenticated` — embeds question, kNN search over `item_analysis.embedding` + recent briefs, feeds to Gemini for cited answer.
- **Slack:** Standard Slack connector, bot access, one channel of your choice. Configured via `standard_connectors--connect` during build.
- **Secrets:** `LOVABLE_API_KEY` (auto), `CRON_SECRET` (generated), `SLACK_API_KEY` (from connector), `SLACK_CHANNEL_ID` (env var you set).

### Out of scope for v1 (explicit)

- X/Twitter, LinkedIn, YouTube ingestion — deferred (API friction, low ROI vs Reddit/news for MVP).
- WhatsApp delivery (needs Twilio; ask later).
- Phase 2 multi-platform (Outlier, Scale, Turing, etc.) — separate future project.

### Build order

1. Enable Lovable Cloud, set up auth (email/pw), single-user gate.
2. Migration for all tables + RLS + GRANTs.
3. Ingestion route + Reddit + Google News + HN fetchers.
4. Item analysis server fn + embeddings.
5. Dashboard shell: Today, Feed, Trends, Weekly, Ask.
6. Daily brief cron + Slack push.
7. Weekly report cron.
8. Wire pg_cron schedules; verify first ingestion + brief end-to-end.

Approve to start building, or tell me what to change (sources, delivery cadence, drop a section, etc.).