// apps/web/lib/repomind-config.ts
import { parse } from "yaml"
import { repomindConfigSchema, type RepoMindConfig } from "./git-storage/schemas"
export type { RepoMindConfig }

import { readTextFile } from "./github-api"

export const CONFIG_PATH = ".repomind/config.yml"
export const MODULES_PATH = ".repomind/architecture/modules.json"
export const TECH_STACK_PATH = ".repomind/architecture/tech-stack.yml"

export interface RepomindContext {
  config: RepoMindConfig
  moduleGraph: object | null
  techStack: object | null
}

export async function loadRepomindContext(
  repoFull: string,
  token: string,
  branch: string
): Promise<RepomindContext | null> {
  const raw = await readTextFile(repoFull, token, branch, CONFIG_PATH)
  if (!raw) return null

  let config: RepoMindConfig
  try {
    const parsed = parse(raw)
    config = repomindConfigSchema.parse(parsed)
  } catch (err) {
    console.error(`[loadRepomindContext] Config parse error for ${repoFull}:`, err)
    // Return a default config if parsing fails? Or null to indicate "broken"?
    // For now, return null but keep the error log.
    return null
  }

  const [modulesRaw, techRaw] = await Promise.all([
    readTextFile(repoFull, token, branch, MODULES_PATH),
    readTextFile(repoFull, token, branch, TECH_STACK_PATH)
  ])

  let moduleGraph = null
  if (modulesRaw) {
    try { moduleGraph = JSON.parse(modulesRaw) } catch (e) { console.error("Modules JSON parse error:", e) }
  }

  let techStack = null
  if (techRaw) {
    try { techStack = parse(techRaw) } catch (e) { console.error("Tech stack YAML parse error:", e) }
  }

  return { config, moduleGraph, techStack }
}
