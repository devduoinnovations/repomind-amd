// lib/ai/provider.ts

type Provider = 'gemini' | 'openai-compat'  // openai-compat = AMD vLLM

export interface AgentConfig {
  provider: Provider
  model: string
  baseUrl?: string      // AMD vLLM endpoint
  apiKey?: string       // AMD key (often 'EMPTY' for local)
  temperature: number
  maxTokens?: number
}

const AMD_MODEL = 'Qwen2.5-72B-Instruct'

export function getAgentConfig(agent: string): AgentConfig {
  const amdUrl = process.env.AMD_VLLM_BASE_URL
  const amdKey = process.env.AMD_VLLM_API_KEY ?? 'EMPTY'

  const amdBase = amdUrl
    ? { provider: 'openai-compat' as Provider, model: AMD_MODEL, baseUrl: amdUrl, apiKey: amdKey }
    : { provider: 'gemini' as Provider }

  const configs: Record<string, AgentConfig> = {
    SPARKY: { ...amdBase, model: amdUrl ? AMD_MODEL : 'gemini-2.5-flash',      temperature: 0.2 },
    PATCH:  { ...amdBase, model: amdUrl ? AMD_MODEL : 'gemini-2.5-flash-lite', temperature: 0.1 },
    SAGE:   { ...amdBase, model: amdUrl ? AMD_MODEL : 'gemini-2.5-flash',      temperature: 0.1 },
    NOVA:   { ...amdBase, model: amdUrl ? AMD_MODEL : 'gemini-2.5-flash-lite', temperature: 0.3 },
    LYRA:   { ...amdBase, model: amdUrl ? AMD_MODEL : 'gemini-2.5-flash',      temperature: 0.4 },
    SCOUT:  { ...amdBase, model: amdUrl ? AMD_MODEL : 'gemini-2.5-flash',      temperature: 0.1 },
  }

  return configs[agent] ?? configs['LYRA']
}

// Universal call function — replaces all direct callGemini() calls
export async function callAgent(
  agent: string,
  params: {
    prompt: string
    systemPrompt: string
    history?: { role: string; content: string }[]
    responseMimeType?: string
    thinkingBudget?: number
  }
): Promise<string> {
  const cfg = getAgentConfig(agent)

  if (cfg.provider === 'openai-compat') {
    return callOpenAICompat(cfg, params)
  }
  return callGeminiAgent(cfg, params)
}

async function callGeminiAgent(
  cfg: AgentConfig,
  params: Parameters<typeof callAgent>[1]
): Promise<string> {
  const { callGemini } = await import('./gemini')
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const history = params.history?.map(msg => ({
    role: msg.role === 'user' ? 'user' : 'model',
    parts: [{ text: msg.content }]
  })) as any

  return callGemini({
    apiKey,
    model: cfg.model,
    prompt: params.prompt,
    systemPrompt: params.systemPrompt,
    history,
    responseMimeType: params.responseMimeType,
    temperature: cfg.temperature,
    thinkingBudget: params.thinkingBudget,
  })
}

async function callOpenAICompat(
  cfg: AgentConfig,
  params: Parameters<typeof callAgent>[1]
): Promise<string> {
  const url = `${cfg.baseUrl}/chat/completions`
  
  const messages = []
  if (params.systemPrompt) {
    messages.push({ role: 'system', content: params.systemPrompt })
  }
  if (params.history) {
    messages.push(...params.history)
  }
  messages.push({ role: 'user', content: params.prompt })

  const body: any = {
    model: cfg.model,
    messages,
    temperature: cfg.temperature,
  }

  if (params.responseMimeType === 'application/json') {
    body.response_format = { type: 'json_object' }
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`AMD vLLM failed: ${res.status} ${errText}`)
  }

  const data = await res.json()
  return data.choices[0].message.content
}
