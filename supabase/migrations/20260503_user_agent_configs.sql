-- Agent customization: display names and voice lines per user
ALTER TABLE users ADD COLUMN IF NOT EXISTS agent_configs jsonb DEFAULT '{}';
