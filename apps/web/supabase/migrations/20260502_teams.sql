-- Team members
CREATE TABLE IF NOT EXISTS project_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  role text DEFAULT 'member',
  joined_at timestamptz DEFAULT now(),
  UNIQUE(project_id, user_id)
);
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members see their memberships" ON project_members
  USING (user_id = auth.uid() OR project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));

-- Invites
CREATE TABLE IF NOT EXISTS project_invites (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by uuid REFERENCES auth.users(id),
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days')
);
ALTER TABLE project_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Project owners manage invites" ON project_invites
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()));
