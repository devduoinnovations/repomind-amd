import { supabaseAdmin } from '@/lib/supabase'
import { generateEmbeddings } from '@/lib/ai'

export async function embedText(text: string): Promise<number[]> {
  const vecs = await generateEmbeddings([text])
  return vecs[0]
}

export async function upsertModuleEmbeddings(
  projectId: string,
  modules: { id: string; path: string; summary: string }[]
): Promise<void> {
  if (modules.length === 0) return

  // SAGE can generate duplicate short ids (e.g. two files named "utils.ts" in
  // different dirs both get id "utils"). Deduplicate by using the full path as
  // the canonical key — last occurrence wins.
  const seen = new Map<string, { id: string; path: string; summary: string }>()
  for (const m of modules) {
    // Use path as the unique key (more stable than the AI-generated id)
    seen.set(m.path, { ...m, id: m.id || m.path })
  }
  const deduped = Array.from(seen.values())

  const texts = deduped.map(m => `${m.path}: ${m.summary}`)
  const vecs = await generateEmbeddings(texts)

  const rows = deduped.map((m, i) => ({
    id: m.id,
    project_id: projectId,
    path: m.path,
    summary: m.summary,
    embedding: JSON.stringify(vecs[i]),
  }))

  const { error } = await supabaseAdmin
    .from('module_embeddings')
    .upsert(rows, { onConflict: 'project_id,id' })

  if (error) throw new Error(`embeddings upsert failed: ${error.message}`)
}

export async function searchModules(
  projectId: string,
  queryText: string,
  topK = 5
): Promise<{ id: string; path: string; summary: string; score: number }[]> {
  const queryVec = await embedText(queryText)

  const { data, error } = await supabaseAdmin.rpc('match_modules', {
    query_embedding: queryVec,
    match_project_id: projectId,
    match_count: topK,
  })

  if (error) throw new Error(`vector search failed: ${error.message}`)
  return (data ?? []) as { id: string; path: string; summary: string; score: number }[]
}
