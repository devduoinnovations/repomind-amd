import { parseDocument, stringify } from "yaml";

export interface MarkdownWithFrontmatter<T> {
  frontmatter: T;
  body: string;
}

export function stringifyFrontmatter(frontmatter: unknown): string {
  return stringify(frontmatter).trim();
}

export function writeMarkdownWithFrontmatter(frontmatter: unknown, body: string): string {
  return `---\n${stringifyFrontmatter(frontmatter)}\n---\n\n${body.trim()}\n`;
}

export function readMarkdownWithFrontmatter<T = any>(
  content: string,
  parseFrontmatter?: (value: unknown) => T
): MarkdownWithFrontmatter<T> {
  const parsed = parseMarkdownWithFrontmatter(content);
  if (Object.keys(parsed.data).length === 0 && !content.trim().startsWith("---")) {
     throw new Error("Markdown file is missing or has invalid frontmatter");
  }

  // Use the provider parser if given, otherwise just return as-is
  const fm = parseFrontmatter ? parseFrontmatter(parsed.data) : (parsed.data as T);

  return {
    frontmatter: fm,
    body: parsed.content,
  };
}

export function parseMarkdownWithFrontmatter(content: string): { data: any; content: string } {
  const trimmed = content.trim();
  
  // Robust check for frontmatter delimiters
  if (!trimmed.startsWith("---")) {
    return { data: {}, content };
  }

  const firstNewline = trimmed.indexOf("\n");
  if (firstNewline === -1) return { data: {}, content };

  // Skip the first --- and search for the ending ---
  const end = trimmed.indexOf("\n---", firstNewline);
  if (end === -1) {
    return { data: {}, content };
  }

  try {
    const yaml = trimmed.slice(firstNewline + 1, end);
    const body = trimmed.slice(end + 4).trimStart();
    const frontmatter = parseDocument(yaml).toJS();

    return {
      data: frontmatter || {},
      content: body,
    };
  } catch (err) {
    console.error("Frontmatter parse error:", err);
    return { data: {}, content };
  }
}
