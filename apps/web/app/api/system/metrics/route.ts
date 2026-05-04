import { NextResponse } from 'next/server'

function parsePrometheus(text: string, metricName: string): number {
  for (const line of text.split('\n')) {
    if (line.startsWith('#') || !line.includes(metricName)) continue
    const parts = line.trim().split(/\s+/)
    const val = parseFloat(parts[parts.length - 1])
    if (!isNaN(val)) return val
  }
  return 0
}

export async function GET() {
  const amdUrl = process.env.AMD_VLLM_BASE_URL
  if (!amdUrl) {
    return NextResponse.json({ available: false, gpu: 0, mem: 0, tokSec: 0, embedMs: 0 })
  }

  const metricsUrl = amdUrl.replace('/v1', '') + '/metrics'

  try {
    const res = await fetch(metricsUrl, {
      headers: { Authorization: `Bearer ${process.env.AMD_VLLM_API_KEY ?? 'EMPTY'}` },
      cache: 'no-store',
    })

    if (!res.ok) throw new Error(`metrics endpoint returned ${res.status}`)

    const text = await res.text()

    const gpuCacheRaw = parsePrometheus(text, 'vllm:gpu_cache_usage_perc')
    const tokSec = parsePrometheus(text, 'vllm:avg_generation_throughput_toks_per_s')
    const ttftSum = parsePrometheus(text, 'vllm:time_to_first_token_seconds_sum')
    const ttftCount = parsePrometheus(text, 'vllm:time_to_first_token_seconds_count')
    const embedMs = ttftCount > 0 ? Math.round((ttftSum / ttftCount) * 1000) : 0

    return NextResponse.json({
      available: true,
      gpu: Math.round(gpuCacheRaw * 100),
      mem: Math.round(gpuCacheRaw * 100),
      tokSec: Math.round(tokSec),
      embedMs,
      model: process.env.NEXT_PUBLIC_GPU_MODEL ?? 'Qwen2.5-72B @ AMD MI300X',
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({
      available: false,
      error: message,
      gpu: 0, mem: 0, tokSec: 0, embedMs: 0,
    })
  }
}
