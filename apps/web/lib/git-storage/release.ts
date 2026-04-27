import { writeMarkdownWithFrontmatter, parseMarkdownWithFrontmatter } from "./frontmatter";
import { releaseFrontmatterSchema, releaseIndexSchema, type ReleaseIndex, type ReleaseIndexEntry } from "./schemas";
import { GitHubRepoFileClient, githubAtomicWrite } from "./github";

export interface ReleaseEntryInput {
  category: string;
  content: string;
  sort_order?: number | null;
}

export interface ReleaseFileInput {
  id: string;
  version: string | null;
  title: string | null;
  summary: string | null;
  status: string;
  pr_number?: number | null;
  pr_url?: string | null;
  published_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  entries?: ReleaseEntryInput[];
}

export const RELEASE_INDEX_PATH = ".repomind/.meta/release-index.json";

export function releaseFilePath(release: Pick<ReleaseFileInput, "status" | "version" | "title" | "id">): string {
  const status = release.status === "published" ? "published" : "drafts";
  const name = slugifyReleaseName(release.version ?? release.title ?? release.id);
  return `.repomind/releases/${status}/${name}.md`;
}

export function writeReleaseMarkdown(release: ReleaseFileInput): string {
  const frontmatter = releaseFrontmatterSchema.parse({
    id: release.id,
    version: release.version,
    title: release.title,
    status: release.status,
    pr_number: release.pr_number ?? undefined,
    pr_url: release.pr_url ?? undefined,
    published_at: release.published_at ?? null,
    created_at: release.created_at,
    updated_at: release.updated_at ?? release.created_at,
  });

  const entries = [...(release.entries ?? [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );

  const body = [
    `# ${release.title ?? release.version ?? "Release"}`,
    release.summary ? `\n${release.summary}` : "",
    entries.length > 0 ? "\n## Changes" : "",
    ...entries.map((entry) => `- **${entry.category}:** ${entry.content}`),
    release.pr_url ? `\n## Pull Request\n${release.pr_url}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return writeMarkdownWithFrontmatter(frontmatter, body);
}

export function readReleaseMarkdown(content: string): ReleaseFileInput {
  const { data: fm, content: body } = parseMarkdownWithFrontmatter(content);
  const frontmatter = releaseFrontmatterSchema.parse(fm);

  const entries: ReleaseEntryInput[] = [];
  const changesMatch = body.match(/## Changes\n([\s\S]*?)(?=\n##\s|\n*$)/);
  if (changesMatch) {
    const lines = changesMatch[1].trim().split("\n");
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].trim().match(/^- \*\*([^*]+)\*\*:\s*(.+)$/);
      if (m) entries.push({ category: m[1], content: m[2], sort_order: i });
    }
  }

  const summaryMatch = body.match(/^#[^\n]*\n\n?([\s\S]*?)(?=\n##\s|$)/);
  const summary = summaryMatch ? summaryMatch[1].trim() || null : null;

  return {
    id: frontmatter.id,
    version: frontmatter.version,
    title: frontmatter.title,
    summary,
    status: frontmatter.status,
    pr_number: frontmatter.pr_number ?? null,
    pr_url: frontmatter.pr_url ?? null,
    published_at: frontmatter.published_at ?? null,
    created_at: frontmatter.created_at,
    updated_at: frontmatter.updated_at,
    entries,
  };
}

export async function getReleaseIndex(client: GitHubRepoFileClient): Promise<ReleaseIndex | null> {
  try {
    const file = await client.readFile(RELEASE_INDEX_PATH);
    if (!file) return null;
    return releaseIndexSchema.parse(JSON.parse(file.content));
  } catch (err) {
    console.error("Failed to read release index:", err);
    return null;
  }
}

export async function listReleases(client: GitHubRepoFileClient): Promise<ReleaseIndexEntry[]> {
  const index = await getReleaseIndex(client);
  if (!index) return [];
  return [...index.releases].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export async function getRelease(
  client: GitHubRepoFileClient,
  releaseId: string
): Promise<ReleaseFileInput | null> {
  const index = await getReleaseIndex(client);
  const entry = index?.releases.find((r) => r.id === releaseId);
  if (!entry) return null;

  const file = await client.readFile(entry.path);
  if (!file) return null;

  return readReleaseMarkdown(file.content);
}

export async function saveReleaseToGit(
  repo: { repoFull: string; token: string; branch?: string | null },
  release: ReleaseFileInput
): Promise<void> {
  const filePath = releaseFilePath(release);
  const fileContent = writeReleaseMarkdown(release);

  const [owner, name] = repo.repoFull.split("/");
  const client = new GitHubRepoFileClient({ owner, repo: name, token: repo.token, branch: repo.branch });
  const currentIndex = await getReleaseIndex(client);

  const indexEntry: ReleaseIndexEntry = {
    id: release.id,
    path: filePath,
    title: release.title,
    version: release.version,
    status: release.status as "draft" | "published" | "archived",
    pr_number: release.pr_number ?? null,
    pr_url: release.pr_url ?? null,
    summary: release.summary,
    published_at: release.published_at ?? null,
    created_at: release.created_at,
    updated_at: release.updated_at ?? release.created_at,
    entries: (release.entries ?? []).map((e, i) => ({
      category: e.category,
      content: e.content,
      sort_order: e.sort_order ?? i,
    })),
  };

  const otherReleases = (currentIndex?.releases ?? []).filter((r) => r.id !== release.id);
  const newIndex: ReleaseIndex = {
    releases: [...otherReleases, indexEntry],
    updated_at: new Date().toISOString(),
  };

  await githubAtomicWrite(
    repo,
    {
      [filePath]: fileContent,
      [RELEASE_INDEX_PATH]: JSON.stringify(newIndex, null, 2),
    },
    `chore(repomind): ${release.status === "published" ? "publish" : "save"} release ${release.version ?? release.title ?? release.id}`
  );
}

export async function publishRelease(
  repo: { repoFull: string; token: string; branch?: string | null },
  releaseId: string
): Promise<void> {
  const [owner, name] = repo.repoFull.split("/");
  const client = new GitHubRepoFileClient({ owner, repo: name, token: repo.token, branch: repo.branch });

  const index = await getReleaseIndex(client);
  const entry = index?.releases.find((r) => r.id === releaseId);
  if (!entry) throw new Error(`Release ${releaseId} not found in index`);
  if (entry.status === "published") return;

  const file = await client.readFile(entry.path);
  if (!file) throw new Error(`Release file ${entry.path} not found`);

  const release = readReleaseMarkdown(file.content);
  const publishedAt = new Date().toISOString();
  const publishedRelease: ReleaseFileInput = {
    ...release,
    status: "published",
    published_at: publishedAt,
    updated_at: publishedAt,
  };

  const newFilePath = releaseFilePath(publishedRelease);
  const updatedEntry: ReleaseIndexEntry = {
    ...entry,
    path: newFilePath,
    status: "published",
    published_at: publishedAt,
    updated_at: publishedAt,
  };

  const otherReleases = (index?.releases ?? []).filter((r) => r.id !== releaseId);
  const newIndex: ReleaseIndex = {
    releases: [...otherReleases, updatedEntry],
    updated_at: new Date().toISOString(),
  };

  const deleteFiles = newFilePath !== entry.path ? [entry.path] : undefined;

  await githubAtomicWrite(
    repo,
    {
      [newFilePath]: writeReleaseMarkdown(publishedRelease),
      [RELEASE_INDEX_PATH]: JSON.stringify(newIndex, null, 2),
    },
    `chore(repomind): publish release ${release.version ?? release.title ?? releaseId}`,
    deleteFiles
  );
}

export async function updateReleaseInGit(
  repo: { repoFull: string; token: string; branch?: string | null },
  releaseId: string,
  updates: Partial<Pick<ReleaseFileInput, "title" | "summary" | "version">>
): Promise<void> {
  const [owner, name] = repo.repoFull.split("/");
  const client = new GitHubRepoFileClient({ owner, repo: name, token: repo.token, branch: repo.branch });

  const index = await getReleaseIndex(client);
  const entry = index?.releases.find((r) => r.id === releaseId);
  if (!entry) throw new Error(`Release ${releaseId} not found in index`);

  const file = await client.readFile(entry.path);
  if (!file) throw new Error(`Release file ${entry.path} not found`);

  const release = readReleaseMarkdown(file.content);
  const updatedRelease: ReleaseFileInput = {
    ...release,
    ...updates,
    updated_at: new Date().toISOString(),
  };

  await saveReleaseToGit(repo, updatedRelease);
}

export async function deleteReleaseFromGit(
  repo: { repoFull: string; token: string; branch?: string | null },
  releaseId: string
): Promise<void> {
  const [owner, name] = repo.repoFull.split("/");
  const client = new GitHubRepoFileClient({ owner, repo: name, token: repo.token, branch: repo.branch });

  const index = await getReleaseIndex(client);
  const entry = index?.releases.find((r) => r.id === releaseId);
  if (!entry) return;

  const remainingReleases = (index?.releases ?? []).filter((r) => r.id !== releaseId);
  const newIndex: ReleaseIndex = {
    releases: remainingReleases,
    updated_at: new Date().toISOString(),
  };

  await githubAtomicWrite(
    repo,
    { [RELEASE_INDEX_PATH]: JSON.stringify(newIndex, null, 2) },
    `chore(repomind): delete release ${entry.version ?? entry.title ?? releaseId}`,
    [entry.path]
  );
}

function slugifyReleaseName(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/^v(?=\d)/, "v")
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "release"
  );
}
