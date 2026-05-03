import { GitHubRepoFileClient, githubBatchWrite } from "./github";
import { parseMarkdownWithFrontmatter } from "./frontmatter";
import { ticketFrontmatterSchema, ticketIndexSchema, TicketIndex } from "./schemas";
import { createHash } from "crypto";

export const TICKET_INDEX_PATH = ".repomind/.meta/ticket-index.json";

export async function getTicketIndex(client: GitHubRepoFileClient): Promise<TicketIndex | null> {
  try {
    const file = await client.readFile(TICKET_INDEX_PATH);
    if (!file) return null;
    const data = JSON.parse(file.content);
    return ticketIndexSchema.parse(data);
  } catch (err) {
    console.error("Failed to read ticket index:", err);
    return null;
  }
}

/**
 * Rebuilds the ticket index. Can be incremental if currentHeadSha is provided and index exists.
 */
export async function syncTicketIndex(client: GitHubRepoFileClient, currentHeadSha?: string): Promise<TicketIndex> {
  const currentIndex = await getTicketIndex(client);
  const headSha = currentHeadSha || (await client.getLatestCommitSha());

  // Try incremental update if we have a base SHA
  if (currentIndex?.last_commit && headSha !== currentIndex.last_commit) {
    try {
      const changedFiles = await client.getChangedFiles(currentIndex.last_commit, headSha);
      const ticketChanges = changedFiles.filter(f => f.startsWith(".repomind/tickets/") && f.endsWith(".md"));

      if (ticketChanges.length > 0) {
        return await updateTicketIndexEntries(client, ticketChanges, headSha);
      } else {
        // No tickets changed, just update the head SHA
        const updatedIndex: TicketIndex = {
          ...currentIndex,
          last_commit: headSha,
          updated_at: new Date().toISOString(),
        };
        await saveTicketIndex(client, updatedIndex);
        return updatedIndex;
      }
    } catch (err) {
      // Fall back to full rebuild if incremental update fails
    }
  }

  // Full rebuild
  const tickets: TicketIndex["tickets"] = [];
  const rootItems = await client.listDirectory(".repomind/tickets");

  for (const item of rootItems) {
    if (item.type === "dir") {
      const subDir = await client.listDirectory(item.path);
      for (const f of subDir) {
        if (f.path.endsWith(".md")) {
          const ticket = await fetchTicketMinimal(client, f.path);
          if (ticket) tickets.push(ticket);
        }
      }
    } else if (item.path.endsWith(".md")) {
      const ticket = await fetchTicketMinimal(client, item.path);
      if (ticket) tickets.push(ticket);
    }
  }

  const index: TicketIndex = {
    tickets,
    last_commit: headSha,
    updated_at: new Date().toISOString(),
  };
  
  index.checksum = calculateChecksum(index);

  await saveTicketIndex(client, index);
  return index;
}

/**
 * Legacy wrapper for rebuildTicketIndex
 */
export async function rebuildTicketIndex(client: GitHubRepoFileClient): Promise<TicketIndex> {
  return syncTicketIndex(client);
}

export async function updateTicketIndexEntries(
  client: GitHubRepoFileClient,
  ticketPaths: string[],
  headSha?: string
): Promise<TicketIndex> {
  const currentIndex = await getTicketIndex(client);
  if (!currentIndex) {
    return syncTicketIndex(client, headSha);
  }

  const ticketMap = new Map(currentIndex.tickets.map(t => [t.path, t]));
  const currentHead = headSha || (await client.getLatestCommitSha());
  
  for (const path of ticketPaths) {
    const ticket = await fetchTicketMinimal(client, path);
    if (ticket) {
      ticketMap.set(path, ticket);
    } else {
      ticketMap.delete(path); // Ticket deleted
    }
  }

  const newIndex: TicketIndex = {
    tickets: Array.from(ticketMap.values()),
    last_commit: currentHead,
    updated_at: new Date().toISOString(),
  };

  newIndex.checksum = calculateChecksum(newIndex);

  await saveTicketIndex(client, newIndex);
  return newIndex;
}

async function saveTicketIndex(client: GitHubRepoFileClient, index: TicketIndex) {
  await githubBatchWrite(
    {
      repoFull: `${client.repoOwner}/${client.repoName}`,
      token: client.repoToken,
      branch: client.repoBranch || "main",
    },
    { [TICKET_INDEX_PATH]: JSON.stringify(index, null, 2) },
    "repomind: sync ticket index"
  );
}

function calculateChecksum(index: TicketIndex): string {
  const data = index.tickets
    .map(t => `${t.id}:${t.status}`)
    .sort()
    .join("|");
  return createHash("sha256").update(data).digest("hex");
}

async function fetchTicketMinimal(client: GitHubRepoFileClient, path: string) {
  try {
    const file = await client.readFile(path);
    if (!file) return null;
    const { data: fm } = parseMarkdownWithFrontmatter(file.content);
    const parsed = ticketFrontmatterSchema.parse(fm);
    return {
      id: parsed.id,
      path,
      title: parsed.title,
      status: parsed.status,
      priority: parsed.priority,
      assignee: parsed.assignee,
      complexity: parsed.complexity,
      epic: parsed.epic,
      updated_at: parsed.updated_at,
    };
  } catch (err) {
    return null;
  }
}

/**
 * Generates the next ticket ID by scanning the index for the highest numeric value.
 */
export async function getNextTicketId(client: GitHubRepoFileClient, prefix: string = "T-"): Promise<string> {
  const index = await getTicketIndex(client);
  if (!index || index.tickets.length === 0) {
    return `${prefix}1`;
  }

  const ids = index.tickets
    .map(t => {
      const match = t.id.match(new RegExp(`${prefix}(\\d+)`));
      return match ? parseInt(match[1], 10) : 0;
    })
    .filter(n => !isNaN(n));

  const maxId = Math.max(0, ...ids);
  return `${prefix}${maxId + 1}`;
}
