const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../apps/web/.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugScan(projectId) {
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (!project) {
    console.error("Project not found");
    return;
  }

  const token = project.github_token;
  const repoFull = project.repo_full;
  const branch = project.default_branch || "main";

  console.log(`Checking repo: ${repoFull} on branch: ${branch}`);

  const [owner, name] = repoFull.split("/");
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${name}/git/trees/${branch}?recursive=1`,
    {
      headers: {
        Authorization: `token ${token}`,
        Accept: "application/vnd.github+json",
      }
    }
  );

  if (!res.ok) {
    console.error(`GitHub API error: ${res.status}`);
    return;
  }

  const data = await res.json();
  const allPaths = data.tree.filter(f => f.type === "blob").map(f => f.path);
  console.log(`Total files: ${allPaths.length}`);
  console.log("All files:", allPaths);

  const SOURCE_EXTS = /\.(ts|tsx|js|jsx|mjs|py|go|rs|rb|java|kt|swift|cs|cpp|c|h|vue|svelte)$/;
  const sourcePaths = allPaths.filter(p => SOURCE_EXTS.test(p));
  console.log(`Source files found: ${sourcePaths.length}`);
}

const projectId = "d140d498-3e34-4765-9e7f-d41b211d8b38";
debugScan(projectId);
