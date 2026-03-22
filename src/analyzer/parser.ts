import type { ParsedSession, RateLimitBlock, TokenUsage } from './types'
import { costForUsage } from './pricing'

export function extractProjectName(relativePath: string): string {
  const parts = relativePath.split('/')
  const projectDir = parts[0] ?? ''

  // Generic: detect -Users-{name}-{rest} or similar OS patterns
  // macOS: -Users-username-path-to-project
  // Linux: -home-username-path-to-project
  // Windows: -C-Users-username-path-to-project
  const userPatterns = [
    /^-Users-[^-]+-(.+)$/,       // macOS
    /^-home-[^-]+-(.+)$/,        // Linux
    /^-[A-Z]-Users-[^-]+-(.+)$/, // Windows
  ]

  for (const pattern of userPatterns) {
    const match = projectDir.match(pattern)
    if (match) {
      const rest = match[1]
      return rest.replace(/-/g, '/')
    }
  }

  // Check if it's a home dir (e.g. -Users-Joo with no project suffix)
  if (/^-Users-[^-]+$/.test(projectDir) || /^-home-[^-]+$/.test(projectDir)) {
    return '~home'
  }

  // Fallback: replace hyphens with slashes
  return projectDir.startsWith('-') ? projectDir.slice(1).replace(/-/g, '/') : projectDir.replace(/-/g, '/')
}

export function parseSession(text: string, relativePath: string): ParsedSession | { error: string } {
  const msgSnapshots = new Map<string, { model: string; usage: Record<string, unknown> }>()
  const timestamps: string[] = []
  let userMsgCount = 0
  const toolUses = new Map<string, number>()
  const turnDurations: number[] = []
  let compactions = 0
  let maxPreTokens = 0
  const errors: string[] = []
  const modelsSeen = new Map<string, number>()
  let version: string | undefined
  let slug: string | undefined
  let sessionId: string | undefined
  let cwd: string | undefined
  let gitBranch: string | undefined
  let subagentSpawns = 0
  let sidechainMsgs = 0
  const rateLimitBlocks: RateLimitBlock[] = []
  let inRateLimit = false
  let rlStartTs: string | undefined
  let rlText: string | undefined

  try {
    const lines = text.split('\n')
    for (const line of lines) {
      if (!line.trim()) continue
      let obj: Record<string, unknown>
      try {
        obj = JSON.parse(line)
      } catch {
        continue
      }

      const t = obj.type as string | undefined
      const ts = obj.timestamp as string | undefined
      if (ts) timestamps.push(ts)
      if (!version) version = obj.version as string | undefined
      if (!slug) slug = obj.slug as string | undefined
      if (!sessionId) sessionId = obj.sessionId as string | undefined
      if (!cwd) cwd = obj.cwd as string | undefined
      if (!gitBranch) gitBranch = obj.gitBranch as string | undefined
      if (obj.isSidechain) sidechainMsgs++

      if (t === 'user') {
        const msg = obj.message as Record<string, unknown> | undefined
        const content = msg?.content
        if (typeof content === 'string' && content.trim()) {
          userMsgCount++
        } else if (Array.isArray(content)) {
          const hasText = content.some(
            (c: unknown) => typeof c === 'object' && c !== null && (c as Record<string, unknown>).type === 'text'
          )
          if (hasText) userMsgCount++
        }
      } else if (t === 'assistant' && obj.message) {
        const msg = obj.message as Record<string, unknown>
        const model = (msg.model as string) ?? 'unknown'

        if (model === '<synthetic>') {
          if (obj.isApiErrorMessage) {
            const content = msg.content as Array<Record<string, unknown>> | undefined
            if (Array.isArray(content)) {
              for (const c of content) {
                if (c.type === 'text' && typeof c.text === 'string') {
                  errors.push(c.text.slice(0, 120))
                }
              }
            }
          }
          if (obj.error === 'rate_limit' && ts) {
            if (!inRateLimit) {
              inRateLimit = true
              rlStartTs = ts
              const content = msg.content as Array<Record<string, unknown>> | undefined
              if (Array.isArray(content)) {
                for (const c of content) {
                  if (c.type === 'text') {
                    rlText = (c.text as string) ?? ''
                    break
                  }
                }
              }
            }
          }
          continue
        }

        // If we were in a rate limit block and now see a real assistant response, record resume
        if (inRateLimit && ts) {
          rateLimitBlocks.push({
            start_ts: rlStartTs!,
            reset_text: rlText ?? '',
            resume_ts: ts,
          })
          inRateLimit = false
          rlStartTs = undefined
          rlText = undefined
        }

        const msgId = (msg.id as string) ?? 'unknown'
        const usage = (msg.usage as Record<string, unknown>) ?? {}
        msgSnapshots.set(msgId, { model, usage })

        const content = msg.content
        if (Array.isArray(content)) {
          for (const c of content as Array<Record<string, unknown>>) {
            if (c.type === 'tool_use') {
              const name = (c.name as string) ?? 'unknown'
              toolUses.set(name, (toolUses.get(name) ?? 0) + 1)
            }
          }
        }
      } else if (t === 'system') {
        const sub = obj.subtype as string | undefined
        if (sub === 'turn_duration') {
          turnDurations.push((obj.durationMs as number) ?? 0)
        } else if (sub === 'compact_boundary') {
          compactions++
          const meta = obj.compactMetadata as Record<string, unknown> | undefined
          const pt = (meta?.preTokens as number) ?? 0
          if (pt > maxPreTokens) maxPreTokens = pt
        }
      } else if (t === 'progress') {
        const d = obj.data as Record<string, unknown> | undefined
        if (d?.type === 'agent_progress') subagentSpawns++
      }
    }
  } catch (e) {
    return { error: String(e) }
  }

  // Aggregate deduped tokens per model
  const tokensByModel: Record<string, TokenUsage & { calls: number }> = {}
  for (const [, { model, usage }] of msgSnapshots) {
    if (!tokensByModel[model]) {
      tokensByModel[model] = { input: 0, output: 0, cache_5m: 0, cache_1h: 0, cache_read: 0, calls: 0 }
    }
    const t = tokensByModel[model]
    t.input += (usage.input_tokens as number) ?? 0
    t.output += (usage.output_tokens as number) ?? 0
    t.cache_read += (usage.cache_read_input_tokens as number) ?? 0
    t.calls += 1
    modelsSeen.set(model, (modelsSeen.get(model) ?? 0) + 1)

    const cacheDetail = usage.cache_creation as Record<string, unknown> | undefined
    if (cacheDetail) {
      t.cache_5m += (cacheDetail.ephemeral_5m_input_tokens as number) ?? 0
      t.cache_1h += (cacheDetail.ephemeral_1h_input_tokens as number) ?? 0
    } else {
      t.cache_1h += (usage.cache_creation_input_tokens as number) ?? 0
    }
  }

  // Totals
  const totalTokens: TokenUsage = { input: 0, output: 0, cache_5m: 0, cache_1h: 0, cache_read: 0 }
  let totalCost = 0
  let totalCalls = 0
  for (const [model, tok] of Object.entries(tokensByModel)) {
    totalTokens.input += tok.input
    totalTokens.output += tok.output
    totalTokens.cache_5m += tok.cache_5m
    totalTokens.cache_1h += tok.cache_1h
    totalTokens.cache_read += tok.cache_read
    totalCost += costForUsage(model, tok)
    totalCalls += tok.calls
  }

  // Timestamps
  const startTs = timestamps.length ? timestamps.reduce((a, b) => a < b ? a : b) : ''
  const endTs = timestamps.length ? timestamps.reduce((a, b) => a > b ? a : b) : ''
  let durationS = 0
  let activeDurationS = 0
  if (startTs && endTs) {
    const s = new Date(startTs).getTime()
    const e = new Date(endTs).getTime()
    durationS = (e - s) / 1000
  }

  // Active duration: sum only gaps <= 15 min
  if (timestamps.length >= 2) {
    const sortedTs = [...new Set(timestamps)].sort()
    const parsed = sortedTs.map(t => new Date(t).getTime())
    for (let i = 1; i < parsed.length; i++) {
      const gap = (parsed[i] - parsed[i - 1]) / 1000
      if (gap <= 900) activeDurationS += gap
    }
  }

  // Project from path
  const project = extractProjectName(relativePath)

  // Primary model
  let primaryModel = 'none'
  let maxCount = 0
  for (const [model, count] of modelsSeen) {
    if (count > maxCount) {
      maxCount = count
      primaryModel = model
    }
  }

  // Session ID: subagents use filename
  const fileName = relativePath.split('/').pop()?.replace('.jsonl', '') ?? ''
  const isSubagent = relativePath.includes('/subagents/')
  const resolvedSessionId = isSubagent ? fileName : (sessionId ?? fileName)

  return {
    session_id: resolvedSessionId,
    slug: slug ?? '',
    project,
    cwd: cwd ?? '',
    git_branch: gitBranch ?? '',
    version: version ?? '',
    start: startTs,
    end: endTs,
    duration_s: durationS,
    active_duration_s: activeDurationS,
    user_messages: userMsgCount,
    api_calls: totalCalls,
    turns: turnDurations.length,
    avg_turn_s: turnDurations.length ? turnDurations.reduce((a, b) => a + b, 0) / turnDurations.length / 1000 : 0,
    models: Object.fromEntries(modelsSeen),
    primary_model: primaryModel,
    tokens: totalTokens,
    tokens_by_model: tokensByModel,
    cost: totalCost,
    tools: Object.fromEntries(toolUses),
    tool_calls: [...toolUses.values()].reduce((a, b) => a + b, 0),
    compactions,
    max_context_tokens: maxPreTokens,
    errors,
    subagent_spawns: subagentSpawns,
    sidechain_msgs: sidechainMsgs,
    is_subagent: isSubagent,
    rate_limit_blocks: rateLimitBlocks,
  }
}
