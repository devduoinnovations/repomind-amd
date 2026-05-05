import { supabaseAdmin } from "./apps/web/lib/supabase";
import { fetchRepoFilePaths } from "./apps/web/lib/github-api";

async function debugScan(projectId: string) {
  const { data: project } = await supabaseAdmin
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (!project) {
    console.error("Project not found");
    return;
  }

  const token = project.github_token;
  const repo = project.repo_full;
  const branch = project.default_branch || "main";

  console.log(`Checking repo: ${repo} on branch: ${branch}`);

  try {
    const allPaths = await fetchRepoFilePaths(repo, token, branch);
    console.log(`Total files: ${allPaths.length}`);
    
    const SOURCE_EXTS = /\.(ts|tsx|js|jsx|mjs|py|go|rs|rb|java|kt|swift|cs|cpp|c|h|vue|svelte)$/;
    const sourcePaths = allPaths.filter(p => SOURCE_EXTS.test(p));
    console.log(`Source files found: ${sourcePaths.length}`);
    console.log("Files:", sourcePaths.slice(0, 10));

  } catch (err) {
    console.error("Error fetching paths:", err);
  }
}

const projectId = "d140d498-3e34-4765-9e7f-d41b211d8b38";
debugScan(projectId);
