import { writeMarkdownWithFrontmatter } from "./frontmatter";
import { ticketFrontmatterSchema } from "./schemas";

export interface TicketFileInput {
  id: string;
  epic?: string;
  title: string;
  description: string;
  status: string;
  priority: "low" | "medium" | "high" | "urgent";
  complexity: "XS" | "S" | "M" | "L" | "XL";
  acceptance_criteria: string[];
  linked_modules: string[];
  created_at: string;
  updated_at?: string;
}

export function ticketFilePath(ticket: TicketFileInput): string {
  const epicPart = ticket.epic ? `${ticket.epic}/` : "";
  const name = slugifyTicketTitle(ticket.title);
  return `.repomind/tickets/${epicPart}${ticket.id}-${name}.md`;
}

export function writeTicketMarkdown(ticket: TicketFileInput): string {
  const frontmatter = ticketFrontmatterSchema.parse({
    id: ticket.id,
    epic: ticket.epic,
    title: ticket.title,
    status: ticket.status as any,
    priority: ticket.priority,
    complexity: ticket.complexity,
    created_at: ticket.created_at,
    updated_at: ticket.updated_at ?? ticket.created_at,
    tags: ticket.linked_modules,
  });

  const body = [
    `# ${ticket.title}`,
    "\n## Description",
    ticket.description,
    "\n## Acceptance Criteria",
    ...ticket.acceptance_criteria.map((ac) => `- [ ] ${ac}`),
    ticket.linked_modules.length > 0 ? "\n## Linked Modules" : "",
    ...ticket.linked_modules.map((mod) => `- \`${mod}\``),
  ]
    .filter(Boolean)
    .join("\n");

  return writeMarkdownWithFrontmatter(frontmatter, body);
}

function slugifyTicketTitle(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50) || "ticket";
}
