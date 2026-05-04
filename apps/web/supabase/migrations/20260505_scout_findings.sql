-- 20260505_scout_findings.sql
create table if not exists scout_findings (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid references projects(id) on delete cascade,
  severity    text check (severity in ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')) not null,
  title       text not null,
  file        text,
  line        int,
  description text,
  remediation text,
  resolved    boolean default false,
  created_at  timestamptz default now()
);

create index if not exists scout_findings_project_idx
  on scout_findings (project_id, severity, resolved);

alter table scout_findings enable row level security;

create policy "Users can manage own project findings" on scout_findings
  for all using (
    project_id in (select id from projects where user_id = auth.uid())
  );
