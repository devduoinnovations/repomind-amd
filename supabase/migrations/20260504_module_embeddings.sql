-- 20260504_module_embeddings.sql
create extension if not exists vector;

create table if not exists module_embeddings (
  id          text,
  project_id  uuid references projects(id) on delete cascade,
  path        text not null,
  summary     text not null,
  embedding   vector(768),
  created_at  timestamptz default now(),
  primary key (project_id, id)
);

create index if not exists module_embeddings_embedding_idx
  on module_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function match_modules(
  query_embedding vector(768),
  match_project_id uuid,
  match_count int default 5
)
returns table (id text, path text, summary text, score float)
language sql stable as $$
  select
    id,
    path,
    summary,
    1 - (embedding <=> query_embedding) as score
  from module_embeddings
  where project_id = match_project_id
  order by embedding <=> query_embedding
  limit match_count;
$$;
