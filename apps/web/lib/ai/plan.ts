import { buildPlanDecompositionPrompt, SPARKY_SYSTEM_PROMPT } from "./prompts";
import { RepoMindConfig } from "@/lib/repomind-config";

export interface DecomposedTask {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high" | "urgent";
  complexity: "XS" | "S" | "M" | "L" | "XL";
  acceptance_criteria: string[];
  linked_modules: string[];
}

export interface DecomposedEpic {
  id: string;
  title: string;
  description: string;
  tasks: DecomposedTask[];
}

export interface DecomposedPlan {
  epics: DecomposedEpic[];
}

export async function decomposePlan(
  planText: string,
  moduleGraph: any,
  config?: RepoMindConfig
): Promise<DecomposedPlan> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set.");
  }

  const prompt = buildPlanDecompositionPrompt(planText, moduleGraph, {
    tone: config?.ai?.tone,
    audience: config?.ai?.audience,
    idFormat: config?.tickets?.id_format,
    epicFormat: config?.tickets?.epic_format,
  });

  const { callAgent } = await import("./provider");

  const rawText = await callAgent("SPARKY", {
    prompt,
    systemPrompt: SPARKY_SYSTEM_PROMPT,
    responseMimeType: "application/json",
  });

  const jsonText = rawText.replace(/```json\n?|\n?```/g, "").trim();
  const parsed = JSON.parse(jsonText) as DecomposedPlan;

  // Normalize fields to match Zod schema expectations (lowercase)
  parsed.epics.forEach(epic => {
    epic.tasks.forEach(task => {
      if (task.priority) task.priority = task.priority.toLowerCase() as any;
      if (task.status) task.status = task.status.toLowerCase() as any;
      // Complexity is uppercase in schema (XS, S, M, L, XL), but let's ensure it's not "medium" or something
      if (task.complexity && task.complexity.length > 2) {
          // If AI returned "Medium" instead of "M"
          const firstChar = task.complexity.charAt(0).toUpperCase();
          if (["S", "M", "L"].includes(firstChar)) task.complexity = firstChar as any;
      }
    });
  });

  return parsed;
}
