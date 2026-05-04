# Supabase Migrations

Run these in order in the Supabase SQL editor (Dashboard → SQL Editor):

1. `20260429_initial_schema.sql` — base tables (users, projects, tickets, ai_suggestions, webhook_events)
2. `20260430_releases.sql` — releases table for NOVA
3. `20260502_teams.sql` — project_members and project_invites
4. `20260503_user_agent_configs.sql` — agent_configs column on users

Each file uses `CREATE TABLE IF NOT EXISTS` and `ADD COLUMN IF NOT EXISTS` so they are safe to re-run.
