export interface TokenUsage {
  input: number
  output: number
  cache_5m: number
  cache_1h: number
  cache_read: number
}

export interface RateLimitBlock {
  start_ts: string
  reset_text: string
  resume_ts: string
}

export interface ParsedSession {
  session_id: string
  slug: string
  project: string
  cwd: string
  git_branch: string
  version: string
  start: string
  end: string
  duration_s: number
  active_duration_s: number
  user_messages: number
  api_calls: number
  turns: number
  avg_turn_s: number
  models: Record<string, number>
  primary_model: string
  tokens: TokenUsage
  tokens_by_model: Record<string, TokenUsage & { calls: number }>
  cost: number
  tools: Record<string, number>
  tool_calls: number
  compactions: number
  max_context_tokens: number
  errors: string[]
  subagent_spawns: number
  sidechain_msgs: number
  is_subagent: boolean
  rate_limit_blocks: RateLimitBlock[]
}

export type FileManifest = Record<string, { size: number; lastModified: number }>

export interface ScanStats {
  totalFiles: number
  newFiles: number
  parsedOk: number
  parseErrors: number
  durationMs: number
}
