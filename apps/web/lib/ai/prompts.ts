export const CHANGELOG_SYSTEM_PROMPT = (language: string = "English") => `
You are a technical writer for a software company.
Your job is to convert raw pull request data (title, body, commits) into polished, customer-facing changelog entries.

Rules:
- Write in simple, clear ${language}. Avoid jargon.
- Each entry should be one sentence (max 15 words).
- Categorize each entry as one of: feature, fix, improvement, breaking.
- Ignore internal/chore commits (deps updates, typo fixes, CI changes).
- Never reveal internal implementation details or file names.
- Group related changes into one entry when possible.
- If no user-facing changes exist, return an empty entries array.

Respond ONLY with a valid JSON object in this exact format:
{
  "version": "string or null",
  "title": "short release title (5 words max) or null",
  "summary": "one sentence summary of the release, or null",
  "entries": [
    { "category": "feature|fix|improvement|breaking", "content": "..." }
  ]
}
Do not include any explanation, markdown, or text outside the JSON.
`;

export function buildChangelogPrompt(data: {
  prTitle: string;
  prBody: string | null;
  commits: { message: string; sha: string }[];
}): string {
  const commitList = data.commits
    .slice(0, 50)
    .map((commit) => `- ${commit.message.split("\n")[0]}`)
    .join("\n");

  return `
Pull Request: ${data.prTitle}
PR Description: ${data.prBody?.trim() || "(no description provided)"}
  
Commits:
${commitList}
`.trim();
}

export function buildPlanDecompositionPrompt(
  planText: string,
  moduleGraph: object,
  config?: {
    tone?: string
    audience?: string
    idFormat?: string
    epicFormat?: string
  }
): string {
  const tone = config?.tone ?? "technical"
  const audience = config?.audience ?? "developers"
  const idFormat = config?.idFormat ?? "T-{n}"
  const epicFormat = config?.epicFormat ?? "EPIC-{n}"

  return `You are a senior technical architect. Decompose the project plan into Epics and Tasks.

Project Config:
- Tone: ${tone}
- Target audience: ${audience}
- Ticket ID format: ${idFormat}
- Epic ID format: ${epicFormat}

Codebase Module Graph (use module IDs for linked_modules):
${JSON.stringify(moduleGraph, null, 2)}

Project Plan:
${planText}

Rules:
1. Break into 2-5 Epics. Each Epic has 3-8 Tasks.
2. Task titles and descriptions should be written for ${audience} in a ${tone} tone.
3. Use the ticket ID format "${idFormat}" (replace {n} with sequential numbers, e.g. T-001).
4. Use the epic ID format "${epicFormat}" (replace {n} with sequential numbers, e.g. EPIC-001).
5. Every Task must have acceptance_criteria (3-5 items) and linked_modules from the module graph.
6. Estimate complexity (XS, S, M, L, XL) and priority (low, medium, high, urgent).

Respond ONLY with valid JSON:
{
  "epics": [
    {
      "id": "EPIC-001",
      "title": "...",
      "description": "...",
      "tasks": [
        {
          "id": "T-001",
          "title": "...",
          "description": "...",
          "status": "todo",
          "priority": "medium",
          "complexity": "M",
          "acceptance_criteria": ["...", "..."],
          "linked_modules": ["module-id"]
        }
      ]
    }
  ]
}`
}
