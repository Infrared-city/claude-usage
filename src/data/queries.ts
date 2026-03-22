import type { Database } from 'sql.js'
import { query, queryOne } from './db'
import type {
  SessionRow, DailyCost, ModelBreakdown, ProjectBreakdown,
  HourlyCost, ToolUsage, ErrorSummary, TokenEconomics, KpiData,
  Filters, DailyModelCost, CostBucket, SessionScatter, HeatmapCell, ToolRow,
} from './types'

function buildWhere(filters: Filters): { clause: string; params: Record<string, unknown> } {
  const conditions: string[] = []
  const params: Record<string, unknown> = {}

  if (filters.dateFrom) {
    conditions.push('start_date >= $dateFrom')
    params.$dateFrom = filters.dateFrom
  }
  if (filters.dateTo) {
    conditions.push('start_date <= $dateTo')
    params.$dateTo = filters.dateTo
  }
  if (filters.project) {
    conditions.push('project = $project')
    params.$project = filters.project
  }
  if (filters.model) {
    conditions.push('primary_model = $model')
    params.$model = filters.model
  }
  if (filters.minCost > 0) {
    conditions.push('cost >= $minCost')
    params.$minCost = filters.minCost
  }
  if (filters.excludeSubagents) {
    conditions.push('is_subagent = 0')
  }

  const clause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : ''
  return { clause, params }
}

function appendCondition(clause: string, condition: string): string {
  return clause ? `${clause} AND ${condition}` : `WHERE ${condition}`
}

export function querySessions(db: Database, filters: Filters): SessionRow[] {
  const { clause, params } = buildWhere(filters)
  return query<SessionRow>(db, `SELECT * FROM sessions ${clause} ORDER BY start_ts DESC`, params)
}

export function queryKpis(db: Database, filters: Filters): KpiData {
  const { clause, params } = buildWhere(filters)
  const row = queryOne<Record<string, number>>(db, `
    SELECT
      COALESCE(SUM(cost), 0) as total_cost,
      COUNT(*) as session_count,
      COALESCE(SUM(api_calls), 0) as total_api_calls,
      COALESCE(AVG(CASE WHEN cost > 0.001 THEN cost END), 0) as avg_session_cost,
      COALESCE(SUM(input_tokens + output_tokens + cache_5m_tokens + cache_1h_tokens + cache_read_tokens), 0) as total_tokens,
      COALESCE(SUM(error_count), 0) as total_errors,
      COALESCE(AVG(duration_s), 0) as avg_duration,
      COALESCE(SUM(tool_calls), 0) as total_tool_calls
    FROM sessions ${clause}
  `, params)!

  const dateRange = queryOne<{ min_date: string; max_date: string }>(db, `
    SELECT MIN(start_date) as min_date, MAX(start_date) as max_date
    FROM sessions ${clause}
  `, params)

  const cacheRow = queryOne<{ total_cache_read: number; total_input: number }>(db, `
    SELECT
      COALESCE(SUM(cache_read_tokens), 0) as total_cache_read,
      COALESCE(SUM(input_tokens + cache_read_tokens + cache_5m_tokens + cache_1h_tokens), 0) as total_input
    FROM sessions ${clause}
  `, params)!

  const dateRangeDays = dateRange?.min_date && dateRange?.max_date
    ? Math.max(1, Math.ceil((new Date(dateRange.max_date).getTime() - new Date(dateRange.min_date).getTime()) / 86400000))
    : 1

  const cacheHitRate = cacheRow.total_input > 0 ? cacheRow.total_cache_read / cacheRow.total_input : 0

  return {
    total_cost: row.total_cost,
    session_count: row.session_count,
    total_api_calls: row.total_api_calls,
    avg_session_cost: row.avg_session_cost,
    total_tokens: row.total_tokens,
    cache_hit_rate: cacheHitRate,
    daily_avg_cost: row.total_cost / dateRangeDays,
    monthly_est: (row.total_cost / dateRangeDays) * 30,
    date_range_days: dateRangeDays,
    total_errors: row.total_errors,
    avg_duration: row.avg_duration,
    total_tool_calls: row.total_tool_calls,
  }
}

export function queryDailyCosts(db: Database, filters: Filters): DailyCost[] {
  const { clause, params } = buildWhere(filters)
  return query<DailyCost>(db, `
    SELECT start_date as date, SUM(cost) as cost, COUNT(*) as sessions
    FROM sessions ${clause}
    GROUP BY start_date ORDER BY start_date
  `, params)
}

export function queryDailyModelCosts(db: Database, filters: Filters): DailyModelCost[] {
  const { clause, params } = buildWhere(filters)
  return query<DailyModelCost>(db, `
    SELECT start_date as date, primary_model as model, SUM(cost) as cost
    FROM sessions ${clause}
    GROUP BY start_date, primary_model ORDER BY start_date
  `, params)
}

export function queryModelBreakdown(db: Database, filters: Filters): ModelBreakdown[] {
  const { clause, params } = buildWhere(filters)
  return query<ModelBreakdown>(db, `
    SELECT primary_model as model, SUM(cost) as cost, SUM(api_calls) as calls,
      SUM(input_tokens) as input_tokens, SUM(output_tokens) as output_tokens,
      SUM(cache_read_tokens) as cache_read_tokens
    FROM sessions ${clause}
    GROUP BY primary_model ORDER BY cost DESC
  `, params)
}

export function queryProjectBreakdown(db: Database, filters: Filters): ProjectBreakdown[] {
  const { clause, params } = buildWhere(filters)
  return query<ProjectBreakdown>(db, `
    SELECT project, SUM(cost) as cost, COUNT(*) as sessions, SUM(api_calls) as api_calls
    FROM sessions ${clause}
    GROUP BY project ORDER BY cost DESC
  `, params)
}

export function queryHourlyCosts(db: Database, filters: Filters): HourlyCost[] {
  const { clause, params } = buildWhere(filters)
  return query<HourlyCost>(db, `
    SELECT start_hour as hour, SUM(cost) as cost, COUNT(*) as sessions
    FROM sessions ${clause}
    GROUP BY start_hour ORDER BY start_hour
  `, params)
}

export function queryToolUsage(db: Database, filters: Filters): ToolUsage[] {
  const { clause, params } = buildWhere(filters)
  const sessionFilter = clause ? `WHERE session_id IN (SELECT id FROM sessions ${clause})` : ''
  return query<ToolUsage>(db, `
    SELECT tool_name as tool, SUM(call_count) as calls
    FROM session_tools ${sessionFilter}
    GROUP BY tool_name ORDER BY calls DESC
  `, params)
}

export function querySessionTools(db: Database, sessionId: string): ToolRow[] {
  return query<ToolRow>(db, `SELECT * FROM session_tools WHERE session_id = $id ORDER BY call_count DESC`, { $id: sessionId })
}

export function queryErrors(db: Database, filters: Filters): ErrorSummary[] {
  const { clause, params } = buildWhere(filters)
  const sessionFilter = clause ? `WHERE session_id IN (SELECT id FROM sessions ${clause})` : ''
  return query<ErrorSummary>(db, `
    SELECT error_text, COUNT(*) as count,
      COUNT(DISTINCT session_id) as sessions_affected
    FROM session_errors ${sessionFilter}
    GROUP BY error_text ORDER BY count DESC
  `, params)
}

export function queryTokenEconomics(db: Database, filters: Filters): TokenEconomics {
  const { clause, params } = buildWhere(filters)
  const row = queryOne<Record<string, number>>(db, `
    SELECT
      COALESCE(SUM(input_tokens), 0) as total_input,
      COALESCE(SUM(output_tokens), 0) as total_output,
      COALESCE(SUM(cache_5m_tokens + cache_1h_tokens), 0) as total_cache_write,
      COALESCE(SUM(cache_read_tokens), 0) as total_cache_read
    FROM sessions ${clause}
  `, params)!

  const totalLookup = row.total_input + row.total_cache_read + row.total_cache_write
  const cacheHitRate = totalLookup > 0 ? row.total_cache_read / totalLookup : 0
  const estimatedSavings = row.total_cache_read * 0.9

  return {
    total_input: row.total_input,
    total_output: row.total_output,
    total_cache_write: row.total_cache_write,
    total_cache_read: row.total_cache_read,
    cache_hit_rate: cacheHitRate,
    estimated_savings: estimatedSavings,
  }
}

export function queryProjects(db: Database): string[] {
  return query<{ project: string }>(db, `SELECT DISTINCT project FROM sessions ORDER BY project`).map(r => r.project)
}

export function queryModels(db: Database): string[] {
  return query<{ primary_model: string }>(db, `SELECT DISTINCT primary_model FROM sessions ORDER BY primary_model`).map(r => r.primary_model)
}

export function queryCostDistribution(db: Database, filters: Filters): CostBucket[] {
  const sessions = querySessions(db, filters)
  const buckets = [
    { label: '$0-0.10', min: 0, max: 0.10 },
    { label: '$0.10-0.50', min: 0.10, max: 0.50 },
    { label: '$0.50-1', min: 0.50, max: 1 },
    { label: '$1-5', min: 1, max: 5 },
    { label: '$5-10', min: 5, max: 10 },
    { label: '$10-25', min: 10, max: 25 },
    { label: '$25+', min: 25, max: Infinity },
  ]
  return buckets.map(b => ({
    bucket: b.label,
    min: b.min,
    max: b.max,
    count: sessions.filter(s => s.cost >= b.min && s.cost < b.max).length,
  }))
}

export function querySessionScatter(db: Database, filters: Filters): SessionScatter[] {
  const { clause, params } = buildWhere(filters)
  return query<SessionScatter>(db, `
    SELECT id, duration_s, cost, tool_calls, project
    FROM sessions ${clause}
    ORDER BY cost DESC LIMIT 500
  `, params)
}

export function queryHeatmap(db: Database, filters: Filters): HeatmapCell[] {
  const { clause, params } = buildWhere(filters)
  return query<HeatmapCell>(db, `
    SELECT
      CAST(strftime('%w', start_date) AS INTEGER) as day,
      start_hour as hour,
      SUM(cost) as cost,
      COUNT(*) as sessions
    FROM sessions ${appendCondition(clause, 'start_date IS NOT NULL AND start_hour IS NOT NULL')}
    GROUP BY day, hour
  `, params)
}

export function queryDailyErrors(db: Database, filters: Filters): DailyCost[] {
  const { clause, params } = buildWhere(filters)
  return query<DailyCost>(db, `
    SELECT start_date as date, SUM(error_count) as cost, COUNT(*) as sessions
    FROM sessions ${appendCondition(clause, 'error_count > 0')}
    GROUP BY start_date ORDER BY start_date
  `, params)
}

const RATE_LIMIT_CONDITION = "(e.error_text LIKE '%rate%' OR e.error_text LIKE '%429%' OR e.error_text LIKE '%overloaded%' OR e.error_text LIKE '%limit%' OR e.error_text LIKE '%resets%')"

export function queryRateLimits(db: Database, filters: Filters): { date: string; count: number }[] {
  const { clause, params } = buildWhere(filters)
  const sessionFilter = clause ? `WHERE e.session_id IN (SELECT id FROM sessions ${clause})` : ''
  const andOrWhere = sessionFilter ? 'AND' : 'WHERE'
  return query<{ date: string; count: number }>(db, `
    SELECT substr(s.start_ts, 1, 10) as date, COUNT(*) as count
    FROM session_errors e
    JOIN sessions s ON e.session_id = s.id
    ${sessionFilter}
    ${andOrWhere} ${RATE_LIMIT_CONDITION}
    GROUP BY date ORDER BY date
  `, params)
}

export function queryRateLimitCount(db: Database, filters: Filters): number {
  const { clause, params } = buildWhere(filters)
  const sessionFilter = clause ? `WHERE e.session_id IN (SELECT id FROM sessions ${clause})` : ''
  const andOrWhere = sessionFilter ? 'AND' : 'WHERE'
  const row = queryOne<{ count: number }>(db, `
    SELECT COUNT(*) as count FROM session_errors e
    ${sessionFilter}
    ${andOrWhere} ${RATE_LIMIT_CONDITION}
  `, params)
  return row?.count ?? 0
}

export interface RateLimitBlock {
  session_id: string
  start_ts: string
  resume_ts: string
  reset_text: string
}

export function queryRateLimitBlocks(db: Database): RateLimitBlock[] {
  return query<RateLimitBlock>(db, `
    SELECT session_id, start_ts, resume_ts, reset_text
    FROM rate_limit_blocks ORDER BY start_ts
  `)
}

export function queryAllDates(db: Database, filters: Filters): string[] {
  const { clause, params } = buildWhere(filters)
  return query<{ date: string }>(db, `
    SELECT DISTINCT start_date as date FROM sessions
    ${appendCondition(clause, 'start_date IS NOT NULL')}
    ORDER BY date
  `, params).map((r) => r.date)
}

export function queryTotalHours(db: Database, filters: Filters): { active: number; activeDays: number } {
  const { clause, params } = buildWhere({ ...filters, excludeSubagents: true })
  const row = queryOne<{ total: number; days: number }>(db, `
    SELECT COALESCE(SUM(active_duration_s), 0) as total,
      COUNT(DISTINCT start_date) as days
    FROM sessions ${appendCondition(clause, 'is_subagent = 0')}
  `, params)
  return {
    active: (row?.total ?? 0) / 3600,
    activeDays: row?.days ?? 1,
  }
}
