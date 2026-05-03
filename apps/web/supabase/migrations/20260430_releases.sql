-- Releases (NOVA auto-draft and manual)
CREATE TABLE IF NOT EXISTS releases (
  id text PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  version text NOT NULL,
  title text,
  summary text,
  entries jsonb DEFAULT '[]',
  status text DEFAULT 'draft',
  pr_number integer,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE releases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own project releases" ON releases
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()::text));
