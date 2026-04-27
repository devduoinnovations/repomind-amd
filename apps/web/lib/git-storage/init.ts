import { parse, stringify } from "yaml";
import type { RepoMindConfig } from "./schemas";
import {
  botSettingsSchema,
  moduleGraphSchema,
  repomindConfigSchema,
  syncStateSchema,
  techStackSchema,
  ticketIndexSchema,
} from "./schemas";
import type { WriteRepoFileInput } from "./github";

export interface BuildRepoMindInitFilesInput {
  projectName: string;
  slug: string;
  defaultBranch?: string | null;
  now?: Date;
}

export function buildDefaultConfig(input: BuildRepoMindInitFilesInput): RepoMindConfig {
  return {
    project: {
      name: input.projectName,
      slug: input.slug,
    },
    ai: {
      tone: "friendly",
      audience: "mixed",
      languages: ["en"],
    },
    changelog: {
      categories: ["feature", "fix", "improvement", "breaking"],
      version_scheme: "semver",
      auto_publish: false,
      public_page: true,
    },
    bot: {
      commit_branch: input.defaultBranch ?? "main",
      squash_commits: true,
      commit_author: "RepoMind Bot",
      commit_email: "bot@repomind.dev",
    },
    tickets: {
      id_format: "T-{n}",
      epic_format: "EPIC-{n}",
      default_status: "todo",
    },
    integrations: {
      email_notifications: true,
    },
  };
}

export function buildRepoMindInitFiles(input: BuildRepoMindInitFilesInput): WriteRepoFileInput[] {
  const now = (input.now ?? new Date()).toISOString();
  const config = buildDefaultConfig(input);
  const message = "chore(repomind): initialize .repomind";

  const syncState = syncStateSchema.parse({
    initialized_at: now,
    last_processed_commit: null,
    last_scan_at: null,
  });
  const ticketIndex = ticketIndexSchema.parse({ tickets: [], updated_at: now });
  const modules = moduleGraphSchema.parse({ modules: [], generated_at: now });
  const techStack = techStackSchema.parse({ generated_at: now });
  const botSettings = botSettingsSchema.parse(config.bot);

  return [
    {
      path: ".repomind/config.yml",
      content: stringify(config),
      message,
    },
    {
      path: ".repomind/architecture/system.mmd",
      content: "flowchart TD\n  Repo[Repository] --> RepoMind[RepoMind]\n",
      message,
    },
    {
      path: ".repomind/architecture/modules.json",
      content: `${JSON.stringify(modules, null, 2)}\n`,
      message,
    },
    {
      path: ".repomind/architecture/tech-stack.yml",
      content: stringify(techStack),
      message,
    },
    {
      path: ".repomind/architecture/onboarding.md",
      content: "# Getting Started\n\nRepoMind will fill this in after the first codebase scan.\n",
      message,
    },
    {
      path: ".repomind/plans/.gitkeep",
      content: "",
      message,
    },
    {
      path: ".repomind/tickets/.gitkeep",
      content: "",
      message,
    },
    {
      path: ".repomind/releases/drafts/.gitkeep",
      content: "",
      message,
    },
    {
      path: ".repomind/sprints/.gitkeep",
      content: "",
      message,
    },
    {
      path: ".repomind/.meta/sync-state.json",
      content: `${JSON.stringify(syncState, null, 2)}\n`,
      message,
    },
    {
      path: ".repomind/.meta/ticket-index.json",
      content: `${JSON.stringify(ticketIndex, null, 2)}\n`,
      message,
    },
    {
      path: ".repomind/.meta/settings.json",
      content: `${JSON.stringify(botSettings, null, 2)}\n`,
      message,
    },
  ];
}

export function parseRepoMindConfig(content: string): RepoMindConfig {
  return repomindConfigSchema.parse(parse(content));
}
