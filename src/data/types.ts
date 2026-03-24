export interface SessionRow {
  id: string
  slug: string | null
  project: string
  primary_model: string
  start_ts: string | null
  end_ts: string | null
  duration_s: number
  user_messages: number
  api_calls: number
  turns: number
  avg_turn_s: number
  cost: number
  input_tokens: number
  output_tokens: number
  cache_5m_tokens: number
  cache_1h_tokens: number
  cache_read_tokens: number
  tool_calls: number
  compactions: number
  max_context_tokens: number
  error_count: number
  subagent_spawns: number
  sidechain_msgs: number
  is_subagent: number
  version: string | null
  cwd: string | null
  git_branch: string | null
  start_date: string | null
  start_hour: number | null
}

export interface ToolRow {
  session_id: string
  tool_name: string
  call_count: number
}

export interface ErrorRow {
  id: number
  session_id: string
  error_text: string
}

export interface DailyCost {
  date: string
  cost: number
  sessions: number
}

export interface ModelBreakdown {
  model: string
  cost: number
  calls: number
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
}

export interface ProjectBreakdown {
  project: string
  cost: number
  sessions: number
  api_calls: number
}

export interface HourlyCost {
  hour: number
  cost: number
  sessions: number
}

export interface ToolUsage {
  tool: string
  calls: number
}

export interface ErrorSummary {
  error_text: string
  count: number
  sessions_affected: number
}

export interface TokenEconomics {
  total_input: number
  total_output: number
  total_cache_write: number
  total_cache_read: number
  cache_hit_rate: number
  estimated_savings: number
}

export interface KpiData {
  total_cost: number
  session_count: number
  subagent_count: number
  total_api_calls: number
  avg_session_cost: number
  total_tokens: number
  cache_hit_rate: number
  daily_avg_cost: number
  monthly_est: number
  date_range_days: number
  total_errors: number
  avg_duration: number
  total_tool_calls: number
}

export interface Filters {
  dateFrom: string | null
  dateTo: string | null
  project: string | null
  model: string | null
  minCost: number
}

export interface DailyModelCost {
  date: string
  model: string
  cost: number
}

export interface CostBucket {
  bucket: string
  count: number
  min: number
  max: number
}

export interface SessionScatter {
  id: string
  duration_s: number
  cost: number
  tool_calls: number
  project: string
}

export interface HeatmapCell {
  day: number
  hour: number
  cost: number
  sessions: number
}

export interface WasteSession {
  id: string
  slug: string | null
  project: string
  cost: number
  duration_s: number
  input_tokens: number
  output_tokens: number
  compactions: number
  tool_calls: number
  error_count: number
  start_date: string | null
  reason: string
}

export interface WasteOverview {
  median_cost: number
  outlier_sessions: WasteSession[]
  floundering_sessions: WasteSession[]
  compaction_sessions: WasteSession[]
  output_ratio: number
  total_waste_cost: number
  total_cost: number
}

export interface RepeatedRead {
  session_id: string
  slug: string | null
  project: string
  cost: number
  tool_name: string
  call_count: number
  start_date: string | null
}

export interface FileReadHotspot {
  session_id: string
  slug: string | null
  project: string
  cost: number
  file_path: string
  read_count: number
  start_date: string | null
}

export interface ProjectWaste {
  project: string
  total_cost: number
  waste_cost: number
  waste_sessions: number
  total_sessions: number
  waste_pct: number
}

export interface WasteScore {
  score: number
  cost_outlier: number
  floundering: number
  compaction: number
  file_rereads: number
}
