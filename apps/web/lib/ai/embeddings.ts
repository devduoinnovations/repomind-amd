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

  const texts = modules.map(m => `${m.path}: ${m.summary}`)
  const vecs = await generateEmbeddings(texts)

  const rows = modules.map((m, i) => ({
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
