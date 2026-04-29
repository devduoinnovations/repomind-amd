const GH_HEADERS = (token: string) => ({
  Authorization: `Bearer ${token}`,
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": "2022-11-28",
})

export async function getDefaultBranch(repoFull: string, token: string): Promise<string> {
  const res = await fetch(`https://api.github.com/repos/${repoFull}`, {
    headers: GH_HEADERS(token),
    cache: "no-store",
  })
  if (!res.ok) throw new Error(`GitHub repo fetch failed: ${res.status}`)
  const data = await res.json()
  return data.default_branch ?? "main"
}

export async function fileExists(repoFull: string, token: string, branch: string, path: string): Promise<boolean> {
  const [owner, repo] = repoFull.split("/")
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`
  const res = await fetch(url, { headers: GH_HEADERS(token), cache: "no-store" })
  return res.ok
}

export async function readTextFile(repoFull: string, token: string, branch: string, path: string): Promise<string | null> {
  const [owner, repo] = repoFull.split("/")
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${branch}`
  const res = await fetch(url, { headers: GH_HEADERS(token), cache: "no-store" })
  if (!res.ok) return null
  const data = await res.json()
  if (data.type !== "file" || !data.content) return null
  return Buffer.from(data.content, "base64").toString("utf8")
}
