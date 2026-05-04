-- Enable RLS on module_embeddings (was missing from the initial migration)
ALTER TABLE module_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own module embeddings" ON module_embeddings
  USING (project_id IN (SELECT id FROM projects WHERE user_id = auth.uid()::text));
