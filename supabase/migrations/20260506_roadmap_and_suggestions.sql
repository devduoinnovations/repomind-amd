-- 20260506_roadmap_and_suggestions.sql

-- 1. Project Features (Roadmap)
ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS public_roadmap BOOLEAN DEFAULT FALSE;

-- 2. AI Suggestions Table (Status tracking)
-- We use CREATE TABLE IF NOT EXISTS, but note that we might need to alter the existing one if it exists with different columns.
-- Since the user provided a full CREATE TABLE, I'll use it but also add an ALTER path just in case.

DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ai_suggestions') THEN
        ALTER TABLE public.ai_suggestions ADD COLUMN IF NOT EXISTS old_status TEXT NOT NULL DEFAULT 'backlog';
        ALTER TABLE public.ai_suggestions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
        ALTER TABLE public.ai_suggestions ALTER COLUMN confidence TYPE DOUBLE PRECISION;
        ALTER TABLE public.ai_suggestions ALTER COLUMN ticket_id SET NOT NULL;
        ALTER TABLE public.ai_suggestions ALTER COLUMN ticket_path SET NOT NULL;
    ELSE
        CREATE TABLE public.ai_suggestions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
          ticket_id TEXT NOT NULL,
          ticket_path TEXT NOT NULL,
          old_status TEXT NOT NULL,
          suggested_status TEXT NOT NULL,
          confidence DOUBLE PRECISION, 
          reasoning TEXT,
          commit_sha TEXT NOT NULL,
          commit_message TEXT,
          status TEXT NOT NULL DEFAULT 'pending', 
          created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS ai_suggestions_project_id_idx ON public.ai_suggestions(project_id);
ALTER TABLE public.ai_suggestions ENABLE ROW LEVEL SECURITY;

-- 3. Email Subscribers Table (Weekly Digest)
CREATE TABLE IF NOT EXISTS public.email_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, email)
);

CREATE INDEX IF NOT EXISTS idx_subscribers_project ON public.email_subscribers(project_id);
ALTER TABLE public.email_subscribers ENABLE ROW LEVEL SECURITY;

-- 4. Codebase Chat Search Function (Vector Similarity)
-- Note: This refers to an 'embeddings' table which should be created if it doesn't exist.
CREATE TABLE IF NOT EXISTS public.embeddings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  symbol_name text,
  content text NOT NULL,
  embedding vector(768),
  created_at timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION match_embeddings (
  query_embedding vector(768),
  match_threshold float,
  match_count int,
  p_project_id uuid
)
RETURNS TABLE (id uuid, file_path text, symbol_name text, content text, similarity float)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT e.id, e.file_path, e.symbol_name, e.content, 1 - (e.embedding <=> query_embedding) AS similarity
  FROM public.embeddings e
  WHERE e.project_id = p_project_id AND 1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER BY e.embedding <=> query_embedding LIMIT match_count;
END;
$$;

-- 5. RLS Policies (Security)
DO $$ 
BEGIN
    -- Policy for AI Suggestions
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users_can_read_own_suggestions') THEN
        CREATE POLICY "users_can_read_own_suggestions" ON public.ai_suggestions
        FOR SELECT USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()::text));
    END IF;

    -- Policy for Email Subscribers
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'users_can_manage_subscribers') THEN
        CREATE POLICY "users_can_manage_subscribers" ON public.email_subscribers
        FOR ALL USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.user_id = auth.uid()::text));
    END IF;

    -- Standard Service Role Bypass
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_can_do_all') THEN
        CREATE POLICY "service_role_can_do_all" ON public.ai_suggestions FOR ALL USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_can_do_all_subs') THEN
        CREATE POLICY "service_role_can_do_all_subs" ON public.email_subscribers FOR ALL USING (true);
    END IF;
END $$;
