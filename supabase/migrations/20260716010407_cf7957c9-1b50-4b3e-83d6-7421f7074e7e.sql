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
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public
AS $$
  SELECT i.id, i.title, i.url, a.summary, a.bucket, i.published_at,
         1 - (a.embedding <=> query_embedding) AS similarity
  FROM public.item_analysis a
  JOIN public.items i ON i.id = a.item_id
  WHERE a.embedding IS NOT NULL
  ORDER BY a.embedding <=> query_embedding
  LIMIT match_count;
$$;