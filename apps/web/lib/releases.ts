import { supabaseAdmin } from "@/lib/supabase";
import { generateChangelog } from "@/lib/ai";
import { buildChangelogPrompt } from "@/lib/ai/prompts";
import { githubAtomicWrite } from "@/lib/git-storage/github";

export async function createReleaseFromPR(
  project: {
    id: string;
    repo_full: string;
    github_token: string;
    default_branch: string;
  },
  pr: {
    number: number;
    title: string;
    body: string | null;
    head: { sha: string };
    base: { ref: string };
  }
): Promise<void> {
  // 1. Fetch PR commits from GitHub API
  const commitsRes = await fetch(
    `https://api.github.com/repos/${project.repo_full}/pulls/${pr.number}/commits?per_page=50`,
    {
      headers: {
        Authorization: `Bearer ${project.github_token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    }
  );

  if (!commitsRes.ok) {
    throw new Error(`Failed to fetch PR commits: ${commitsRes.status}`);
  }

  const rawCommits = await commitsRes.json();
  const commits: { sha: string; message: string }[] = rawCommits.map(
    (c: any) => ({
      sha: c.sha as string,
      message: (c.commit?.message ?? "") as string,
    })
  );

  // 2. Build prompt and call AI to generate changelog
  const userPrompt = buildChangelogPrompt({
    prTitle: pr.title,
    prBody: pr.body,
    commits,
  });

  const changelog = await generateChangelog(userPrompt);

  const version = changelog.version ?? `pr-${pr.number}`;
  const title = changelog.title ?? pr.title;
  const summary = changelog.summary ?? "";
  const entries = changelog.entries ?? [];

  // 3. Insert release row into Supabase
  const releaseId = `release-${Date.now()}`;
  const now = new Date().toISOString();

  const { error: insertError } = await supabaseAdmin.from("releases").insert({
    id: releaseId,
    project_id: project.id,
    version,
    title,
    summary,
    entries,
    status: "draft",
    pr_number: pr.number,
    created_at: now,
  });

  if (insertError) {
    console.error("[releases] Supabase insert failed:", insertError.message ?? insertError);
  }

  // 4. Optionally write the release to .repomind/releases/{slug}.md in the repo
  try {
    const slug = version.replace(/[^a-zA-Z0-9._-]/g, "-").toLowerCase();
    const mdContent = formatReleaseMarkdown({ version, title, summary, entries, prNumber: pr.number, createdAt: now });

    await githubAtomicWrite(
      {
        repoFull: project.repo_full,
        token: project.github_token,
        branch: project.default_branch,
      },
      {
        [`.repomind/releases/${slug}.md`]: mdContent,
      },
      `chore: add release notes for ${version} (PR #${pr.number})`
    );
  } catch (writeErr: any) {
    // Non-fatal: release written to DB even if repo write fails
  }
}

function formatReleaseMarkdown(data: {
  version: string;
  title: string;
  summary: string;
  entries: Array<{ category: string; content: string }>;
  prNumber: number;
  createdAt: string;
}): string {
  const { version, title, summary, entries, prNumber, createdAt } = data;
  const date = createdAt.split("T")[0];

  const grouped: Record<string, string[]> = {};
  for (const entry of entries) {
    if (!grouped[entry.category]) grouped[entry.category] = [];
    grouped[entry.category].push(entry.content);
  }

  const sections = Object.entries(grouped)
    .map(([cat, items]) => {
      const label = cat.charAt(0).toUpperCase() + cat.slice(1);
      const lines = items.map((item) => `- ${item}`).join("\n");
      return `### ${label}\n\n${lines}`;
    })
    .join("\n\n");

  return `# ${title} (${version})

> Released: ${date} · PR #${prNumber}

${summary}

${sections || "_No changelog entries._"}
`.trimEnd() + "\n";
}
