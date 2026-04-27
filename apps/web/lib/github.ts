import { createHmac, timingSafeEqual } from "crypto";

export interface GitHubTokenProject {
  repo_full: string;
  github_token: string | null;
}

export interface PullRequestCommitSummary {
  message: string;
  sha: string;
}

export interface PullRequestData {
  title: string;
  body: string | null;
  html_url: string;
  merged_at: string | null;
  commits: PullRequestCommitSummary[];
}

export async function verifyGithubWebhook(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const expectedSignature =
    "sha256=" + createHmac("sha256", secret).update(payload).digest("hex");

  const signatureBuffer = Buffer.from(signature || "");
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (signatureBuffer.length !== expectedSignatureBuffer.length) {
    return false;
  }

  return timingSafeEqual(signatureBuffer, expectedSignatureBuffer);
}

export async function fetchPRData(
  project: GitHubTokenProject,
  prNumber: number
): Promise<PullRequestData> {
  const token = project.github_token;
  if (!token) {
    throw new Error("No GitHub token for project");
  }

  const baseUrl = `https://api.github.com/repos/${project.repo_full}`;
  const headers = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github.v3+json",
  };

  const prResponse = await fetch(`${baseUrl}/pulls/${prNumber}`, { headers });
  if (!prResponse.ok) {
    throw new Error(`Failed to fetch PR: ${prResponse.statusText}`);
  }
  const prData = await prResponse.json();

  const commitsResponse = await fetch(`${baseUrl}/pulls/${prNumber}/commits?per_page=100`, { headers });
  if (!commitsResponse.ok) {
    throw new Error(`Failed to fetch PR commits: ${commitsResponse.statusText}`);
  }
  const commitsData = await commitsResponse.json();

  return {
    title: prData.title,
    body: prData.body,
    html_url: prData.html_url,
    merged_at: prData.merged_at,
    commits: commitsData.map((commit: { commit: { message: string }; sha: string }) => ({
      message: commit.commit.message,
      sha: commit.sha,
    })),
  };
}

export async function registerWebhook(
  repoFull: string,
  token: string,
  webhookUrl: string,
  secret: string
): Promise<number> {
  const response = await fetch(`https://api.github.com/repos/${repoFull}/hooks`, {
    method: "POST",
    headers: {
      Authorization: `token ${token}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "web",
      active: true,
      events: ["push", "pull_request"],
      config: {
        url: webhookUrl,
        content_type: "json",
        secret,
      },
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to register webhook: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return data.id;
}
