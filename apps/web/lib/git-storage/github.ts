export interface GitHubFileClientOptions {
  owner: string;
  repo: string;
  token: string;
  branch?: string | null;
}

export interface RepoFile {
  path: string;
  content: string;
  sha: string;
}

export interface WriteRepoFileInput {
  path: string;
  content: string;
  message: string;
  sha?: string;
  branch?: string | null;
}

export class GitHubRepoFileClient {
  private readonly owner: string;
  private readonly repo: string;
  private readonly token: string;
  private readonly branch?: string | null;

  constructor(options: GitHubFileClientOptions) {
    this.owner = options.owner;
    this.repo = options.repo;
    this.token = options.token;
    this.branch = options.branch;
  }

  get repoOwner() { return this.owner; }
  get repoName() { return this.repo; }
  get repoToken() { return this.token; }
  get repoBranch() { return this.branch; }

  async readFile(path: string): Promise<RepoFile | null> {
    const url = this.contentsUrl(path);
    if (this.branch) {
      url.searchParams.set("ref", this.branch);
    }

    const response = await fetch(url, { headers: this.headers(), cache: "no-store" });
    if (response.status === 404) {
      return null;
    }
    if (!response.ok) {
      throw new Error(`Failed to read ${path}: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    if (Array.isArray(data) || data.type !== "file") {
      throw new Error(`${path} is not a file`);
    }

    return {
      path,
      sha: data.sha,
      content: Buffer.from(data.content, "base64").toString("utf8"),
    };
  }

  async writeFile(input: WriteRepoFileInput): Promise<string> {
    // If sha is provided, we use it for optimistic locking (If-Match equivalent via GitHub API)
    const response = await fetch(this.contentsUrl(input.path), {
      method: "PUT",
      headers: this.headers(),
      body: JSON.stringify({
        message: input.message,
        content: Buffer.from(input.content, "utf8").toString("base64"),
        sha: input.sha,
        branch: input.branch ?? this.branch ?? undefined,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      if (response.status === 409) {
        throw new Error(`Conflict: ${input.path} has been modified. Please refresh.`);
      }
      throw new Error(`Failed to write ${input.path}: ${response.status} ${error}`);
    }

    const data = await response.json();
    return data.content.sha;
  }

  async listDirectory(path: string): Promise<Array<{ path: string; name: string; type: "file" | "dir" }>> {
    const url = this.contentsUrl(path);
    if (this.branch) {
      url.searchParams.set("ref", this.branch);
    }

    const response = await fetch(url, { headers: this.headers(), cache: "no-store" });
    if (response.status === 404) {
      return [];
    }
    if (!response.ok) {
      throw new Error(`Failed to list ${path}: ${response.status} ${await response.text()}`);
    }

    const data = await response.json();
    if (!Array.isArray(data)) {
      return [];
    }

    return data.map((item: any) => ({
      path: item.path,
      name: item.path.split("/").pop() || "",
      type: item.type === "dir" ? "dir" : "file",
    }));
  }

  async writeFiles(inputs: WriteRepoFileInput[]): Promise<void> {
    for (const input of inputs) {
      await this.writeFile(input);
    }
  }

  async getLatestCommitSha(): Promise<string> {
    const branch = this.branch || "main";
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/git/refs/heads/${branch}`;
    const response = await fetch(url, { headers: this.headers(), cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to get latest commit: ${response.status} ${await response.text()}`);
    }
    const data = await response.json();
    return data.object.sha;
  }

  async getChangedFiles(baseSha: string, headSha: string): Promise<string[]> {
    const url = `https://api.github.com/repos/${this.owner}/${this.repo}/compare/${baseSha}...${headSha}`;
    const response = await fetch(url, { headers: this.headers(), cache: "no-store" });
    if (!response.ok) {
      throw new Error(`Failed to compare commits: ${response.status} ${await response.text()}`);
    }
    const data = await response.json();
    return data.files.map((f: any) => f.filename);
  }

  private contentsUrl(path: string): URL {
    return new URL(
      `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${encodeURIComponentPath(path)}`
    );
  }

  private headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    };
  }
}

export async function githubBatchWrite(
  repo: { repoFull: string; token: string; branch?: string | null },
  files: Record<string, string>,
  message: string
): Promise<void> {
  const [owner, name] = repo.repoFull.split("/");
  const client = new GitHubRepoFileClient({
    owner,
    repo: name,
    token: repo.token,
    branch: repo.branch,
  });

  // For larger batches, use atomic tree update
  await githubAtomicWrite(repo, files, message);
}

export async function githubAtomicWrite(
  repo: { repoFull: string; token: string; branch?: string | null },
  files: Record<string, string>,
  message: string,
  deleteFiles?: string[]
): Promise<void> {
  const [owner, name] = repo.repoFull.split("/");
  const branch = repo.branch || "main";
  const baseUrl = `https://api.github.com/repos/${owner}/${name}`;
  const headers = {
    Authorization: `Bearer ${repo.token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };

  // 1. Get current branch tip
  const refRes = await fetch(`${baseUrl}/git/refs/heads/${branch}`, { headers, cache: "no-store" });
  if (!refRes.ok) throw new Error(`Atomic Write: Failed to get ref: ${refRes.status}`);
  const refData = await refRes.json();
  const baseSha = refData.object.sha;

  // 2. Get the tree from the base commit
  const commitRes = await fetch(`${baseUrl}/git/commits/${baseSha}`, { headers, cache: "no-store" });
  if (!commitRes.ok) throw new Error(`Atomic Write: Failed to get commit: ${commitRes.status}`);
  const commitData = await commitRes.json();
  const baseTreeSha = commitData.tree.sha;

  // 3. Create a new tree
  const treeItems: Array<{ path: string; mode: string; type: string; content?: string; sha?: null }> = [
    ...Object.entries(files).map(([path, content]) => ({
      path,
      mode: "100644",
      type: "blob",
      content,
    })),
    ...(deleteFiles ?? []).map((path) => ({
      path,
      mode: "100644",
      type: "blob",
      sha: null as null,
    })),
  ];

  const treeRes = await fetch(`${baseUrl}/git/trees`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: treeItems,
    }),
  });
  if (!treeRes.ok) throw new Error(`Atomic Write: Failed to create tree: ${treeRes.status}`);
  const treeData = await treeRes.json();
  const newTreeSha = treeData.sha;

  // 4. Create the commit
  const newCommitRes = await fetch(`${baseUrl}/git/commits`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message,
      tree: newTreeSha,
      parents: [baseSha],
    }),
  });
  if (!newCommitRes.ok) throw new Error(`Atomic Write: Failed to create commit: ${newCommitRes.status}`);
  const newCommitData = await newCommitRes.json();
  const newCommitSha = newCommitData.sha;

  // 5. Update the ref
  const updateRefRes = await fetch(`${baseUrl}/git/refs/heads/${branch}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      sha: newCommitSha,
      force: false,
    }),
  });
  if (!updateRefRes.ok) {
    const err = await updateRefRes.text();
    throw new Error(`Atomic Write: Failed to update ref: ${updateRefRes.status} ${err}`);
  }
}

function encodeURIComponentPath(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}
