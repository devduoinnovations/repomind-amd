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
    config = repomindConfigSchema.parse(parse(raw))
  } catch {
    return null
  }

  const modulesRaw = await readTextFile(repoFull, token, branch, MODULES_PATH)
  const techRaw = await readTextFile(repoFull, token, branch, TECH_STACK_PATH)

  const moduleGraph = modulesRaw ? JSON.parse(modulesRaw) : null
  const techStack = techRaw ? parse(techRaw) : null

  return { config, moduleGraph, techStack }
}
