-- Users (synced from NextAuth / GitHub OAuth)
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text UNIQUE,
  name text,
  avatar_url text,
  plan text DEFAULT 'free',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own profile" ON users
  USING (id = auth.uid()::text);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  name text NOT NULL,
  repo_full text NOT NULL,
  slug text,
  github_token text,
  default_branch text DEFAULT 'main',
  webhook_id text,
  config jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own projects" ON projects
  USING (user_id = auth.uid()::text);

-- Tickets (stored in Supabase, synced from .repomind)
CREATE TABLE IF NOT EXISTS tickets (
  id text NOT NULL,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  title text,
  description text,
  status text DEFAULT 'backlog',
  priority text DEFAULT 'medium',
  complexity text DEFAULT 'm',
  path text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (id, project_id)
);
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own project tickets" ON tickets
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()::text));

-- AI Suggestions (PATCH matches)
CREATE TABLE IF NOT EXISTS ai_suggestions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  ticket_id text,
  ticket_path text,
  commit_sha text,
  commit_message text,
  suggested_status text,
  confidence integer DEFAULT 0,
  reasoning text,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE ai_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own project suggestions" ON ai_suggestions
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()::text));

-- Webhook events log
CREATE TABLE IF NOT EXISTS webhook_events (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  event_type text,
  payload jsonb,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users access own webhook events" ON webhook_events
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()::text));
