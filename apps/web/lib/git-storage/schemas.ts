import { z } from "zod";

export const ticketStatusSchema = z.enum([
  "backlog",
  "todo",
  "in_progress",
  "review",
  "done",
  "shipped",
  "archived",
]);

export const releaseStatusSchema = z.enum(["draft", "published", "archived"]);

export const repomindConfigSchema = z.object({
  project: z.object({
    name: z.string().min(1),
    slug: z.string().min(1),
  }),
  ai: z.object({
    tone: z.enum(["friendly", "technical", "formal"]).default("friendly"),
    audience: z.enum(["developers", "end_users", "mixed"]).default("mixed"),
    languages: z.array(z.string()).default(["en"]),
  }),
  changelog: z.object({
    categories: z
      .array(z.enum(["feature", "fix", "improvement", "breaking"]))
      .default(["feature", "fix", "improvement", "breaking"]),
    version_scheme: z.enum(["semver", "calver", "manual"]).default("semver"),
    auto_publish: z.boolean().default(false),
    public_page: z.boolean().default(true),
  }),
  bot: z.object({
    commit_branch: z.string().default("main"),
    squash_commits: z.boolean().default(true),
    commit_author: z.string().default("RepoMind Bot"),
    commit_email: z.string().email().default("bot@repomind.dev"),
  }),
  tickets: z.object({
    id_format: z.string().default("T-{n}"),
    epic_format: z.string().default("EPIC-{n}"),
    default_status: ticketStatusSchema.default("todo"),
  }),
  integrations: z.object({
    slack_webhook: z.string().url().optional(),
    discord_webhook: z.string().url().optional(),
    email_notifications: z.boolean().default(true),
  }),
});

export const ticketFrontmatterSchema = z.object({
  id: z.string().min(1),
  epic: z.string().optional(),
  title: z.string().min(1),
  status: ticketStatusSchema,
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  assignee: z.string().optional(),
  complexity: z.enum(["XS", "S", "M", "L", "XL"]).optional(),
  commits: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).optional(),
  blocked_by: z.array(z.string()).default([]),
  blocks: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  created_at: z.string(),
  updated_at: z.string(),
});

export const planFrontmatterSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  status: z.enum(["draft", "active", "completed", "archived"]).default("draft"),
  source: z.enum(["upload", "paste", "voice", "generated"]).default("paste"),
  created_at: z.string(),
  updated_at: z.string(),
  tags: z.array(z.string()).default([]),
});

export const releaseFrontmatterSchema = z.object({
  id: z.string().min(1),
  version: z.string().nullable(),
  title: z.string().nullable(),
  status: releaseStatusSchema.default("draft"),
  pr_number: z.number().int().positive().optional(),
  pr_url: z.string().url().optional(),
  published_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const releaseIndexEntrySchema = z.object({
  id: z.string(),
  path: z.string(),
  title: z.string().nullable(),
  version: z.string().nullable(),
  status: releaseStatusSchema,
  pr_number: z.number().int().positive().nullable().optional(),
  pr_url: z.string().url().nullable().optional(),
  summary: z.string().nullable().optional(),
  published_at: z.string().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
  entries: z.array(
    z.object({
      category: z.string(),
      content: z.string(),
      sort_order: z.number().int().optional(),
    })
  ).default([]),
});

export const releaseIndexSchema = z.object({
  releases: z.array(releaseIndexEntrySchema),
  updated_at: z.string(),
});

export const moduleGraphSchema = z.object({
  modules: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      path: z.string(),
      summary: z.string().optional(),
      dependencies: z.array(z.string()).default([]),
    })
  ),
  generated_at: z.string(),
});

export const techStackSchema = z.object({
  languages: z.array(z.string()).default([]),
  frameworks: z.array(z.string()).default([]),
  databases: z.array(z.string()).default([]),
  services: z.array(z.string()).default([]),
  generated_at: z.string(),
});

export const syncStateSchema = z.object({
  initialized_at: z.string(),
  last_processed_commit: z.string().nullable().default(null),
  last_scan_at: z.string().nullable().default(null),
});

export const ticketIndexSchema = z.object({
  tickets: z.array(
    z.object({
      id: z.string(),
      path: z.string(),
      title: z.string(),
      status: ticketStatusSchema,
      priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
      assignee: z.string().optional(),
      complexity: z.enum(["XS", "S", "M", "L", "XL"]).optional(),
      epic: z.string().optional(),
      updated_at: z.string(),
    })
  ),
  last_commit: z.string().optional(), // Last commit SHA processed
  checksum: z.string().optional(),   // Hash of all ticket IDs + statuses
  updated_at: z.string(),
});

export const botSettingsSchema = z.object({
  commit_branch: z.string().default("main"),
  squash_commits: z.boolean().default(true),
  commit_author: z.string().default("RepoMind Bot"),
  commit_email: z.string().email().default("bot@repomind.dev"),
});

export type RepoMindConfig = z.output<typeof repomindConfigSchema>;
export type TicketFrontmatter = z.output<typeof ticketFrontmatterSchema>;
export type PlanFrontmatter = z.output<typeof planFrontmatterSchema>;
export type ReleaseFrontmatter = z.output<typeof releaseFrontmatterSchema>;
export type ModuleGraph = z.output<typeof moduleGraphSchema>;
export type TechStack = z.output<typeof techStackSchema>;
export type SyncState = z.output<typeof syncStateSchema>;
export type TicketIndex = z.output<typeof ticketIndexSchema>;
export type BotSettings = z.output<typeof botSettingsSchema>;
export type ReleaseIndex = z.output<typeof releaseIndexSchema>;
export type ReleaseIndexEntry = z.output<typeof releaseIndexEntrySchema>;
