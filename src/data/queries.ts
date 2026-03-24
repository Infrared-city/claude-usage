import type { Database } from 'sql.js'
import { query, queryOne } from './db'
import type {
  SessionRow, DailyCost, ModelBreakdown, ProjectBreakdown,
  HourlyCost, ToolUsage, ErrorSummary, TokenEconomics, KpiData,
  Filters, DailyModelCost, CostBucket, SessionScatter, HeatmapCell, ToolRow,
  WasteSession, WasteOverview, RepeatedRead, FileReadHotspot, ProjectWaste,
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

  // Totals from ALL sessions (including subagents) — real spend
  const totals = queryOne<Record<string, number>>(db, `
    SELECT
      COALESCE(SUM(cost), 0) as total_cost,
      COALESCE(SUM(api_calls), 0) as total_api_calls,
      COALESCE(SUM(input_tokens + output_tokens + cache_5m_tokens + cache_1h_tokens + cache_read_tokens), 0) as total_tokens,
      COALESCE(SUM(error_count), 0) as total_errors,
      COALESCE(SUM(tool_calls), 0) as total_tool_calls
    FROM sessions ${clause}
  `, params)!

  // Counts and averages from parent sessions only (subagents distort these)
  const parentClause = appendCondition(clause, 'is_subagent = 0')
  const parents = queryOne<Record<string, number>>(db, `
    SELECT
      COUNT(*) as session_count,
      COALESCE(AVG(active_duration_s), 0) as avg_duration
    FROM sessions ${parentClause}
  `, params)!

  const subagentRow = queryOne<{ count: number }>(db, `
    SELECT COUNT(*) as count FROM sessions ${appendCondition(clause, 'is_subagent = 1')}
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
    ? Math.max(1, Math.round((new Date(dateRange.max_date).getTime() - new Date(dateRange.min_date).getTime()) / 86400000) + 1)
    : 1

  const cacheHitRate = cacheRow.total_input > 0 ? cacheRow.total_cache_read / cacheRow.total_input : 0
  const sessionCount = parents.session_count || 1

  return {
    total_cost: totals.total_cost,
    session_count: parents.session_count,
    subagent_count: subagentRow.count,
    total_api_calls: totals.total_api_calls,
    avg_session_cost: totals.total_cost / sessionCount,
    total_tokens: totals.total_tokens,
    cache_hit_rate: cacheHitRate,
    daily_avg_cost: totals.total_cost / dateRangeDays,
    monthly_est: (totals.total_cost / dateRangeDays) * 30,
    date_range_days: dateRangeDays,
    total_errors: totals.total_errors,
    avg_duration: parents.avg_duration,
    total_tool_calls: totals.total_tool_calls,
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

export function queryWasteOverview(db: Database, filters: Filters): WasteOverview {
  const { clause, params } = buildWhere(filters)

  // Median cost: compute offset in JS (SQLite doesn't support subquery in OFFSET)
  const countRow = queryOne<{ cnt: number }>(db, `
    SELECT COUNT(*) as cnt FROM sessions ${appendCondition(clause, 'cost > 0')}
  `, params)
  const medianOffset = Math.floor((countRow?.cnt ?? 0) / 2)
  const medianRow = queryOne<{ median_cost: number }>(db, `
    SELECT cost as median_cost FROM sessions ${appendCondition(clause, 'cost > 0')}
    ORDER BY cost LIMIT 1 OFFSET $medianOffset
  `, { ...params, $medianOffset: medianOffset })
  const median = medianRow?.median_cost ?? 0

  // Cost outliers: 3x+ median, with $0.50 floor to avoid noise from cheap sessions
  const outlierThreshold = Math.max(median * 3, 0.50)
  const outliers = query<WasteSession>(db, `
    SELECT id, slug, project, cost, duration_s, input_tokens, output_tokens,
      compactions, tool_calls, error_count, start_date, 'cost_outlier' as reason
    FROM sessions ${appendCondition(clause, 'cost >= $outlierThreshold')}
    ORDER BY cost DESC LIMIT 50
  `, { ...params, $outlierThreshold: outlierThreshold })

  // Floundering: output < 5% of fresh tokens (excluding cache reads which inflate denominator)
  const floundering = query<WasteSession>(db, `
    SELECT id, slug, project, cost, duration_s, input_tokens, output_tokens,
      compactions, tool_calls, error_count, start_date, 'floundering' as reason
    FROM sessions ${appendCondition(clause,
      'output_tokens > 0 AND input_tokens > 0 AND ' +
      'CAST(output_tokens AS REAL) / (input_tokens + output_tokens) < 0.05 AND cost > 0.10'
    )}
    ORDER BY cost DESC LIMIT 50
  `, params)

  // Heavy compaction sessions (3+ compactions = likely going in circles; 1-2 is normal for long sessions)
  const compactionSessions = query<WasteSession>(db, `
    SELECT id, slug, project, cost, duration_s, input_tokens, output_tokens,
      compactions, tool_calls, error_count, start_date, 'compaction' as reason
    FROM sessions ${appendCondition(clause, 'compactions >= 3 AND cost > 0.10')}
    ORDER BY compactions DESC, cost DESC LIMIT 50
  `, params)

  // Overall output ratio
  const ratioRow = queryOne<{ inp: number; out: number }>(db, `
    SELECT COALESCE(SUM(input_tokens + cache_read_tokens), 0) as inp,
      COALESCE(SUM(output_tokens), 0) as out
    FROM sessions ${clause}
  `, params)!
  const outputRatio = ratioRow.out > 0 ? ratioRow.out / (ratioRow.inp + ratioRow.out) : 0

  // Total cost in filtered range
  const totalRow = queryOne<{ total: number }>(db, `
    SELECT COALESCE(SUM(cost), 0) as total FROM sessions ${clause}
  `, params)!

  // Sum waste cost (union of outlier + floundering + compaction, deduplicated)
  const wasteIds = new Set<string>()
  let wasteCost = 0
  for (const s of [...outliers, ...floundering, ...compactionSessions]) {
    if (!wasteIds.has(s.id)) {
      wasteIds.add(s.id)
      wasteCost += s.cost ?? 0
    }
  }

  return {
    median_cost: median,
    outlier_sessions: outliers,
    floundering_sessions: floundering,
    compaction_sessions: compactionSessions,
    output_ratio: outputRatio,
    total_waste_cost: wasteCost,
    total_cost: totalRow.total,
  }
}

export function queryRepeatedReads(db: Database, filters: Filters): RepeatedRead[] {
  const { clause, params } = buildWhere(filters)
  const sessionFilter = clause ? `WHERE t.session_id IN (SELECT id FROM sessions ${clause})` : ''
  const andOrWhere = sessionFilter ? 'AND' : 'WHERE'
  return query<RepeatedRead>(db, `
    SELECT t.session_id, s.slug, s.project, s.cost, t.tool_name, t.call_count, s.start_date
    FROM session_tools t
    JOIN sessions s ON t.session_id = s.id
    ${sessionFilter}
    ${andOrWhere} t.tool_name IN ('Read', 'ReadFile', 'read_file', 'View') AND t.call_count >= 20
    ORDER BY t.call_count DESC LIMIT 50
  `, params)
}

export function queryTotalHours(db: Database, filters: Filters): { active: number; activeDays: number } {
  const { clause, params } = buildWhere(filters)
  const parentClause = appendCondition(clause, 'is_subagent = 0')
  const row = queryOne<{ total: number; days: number }>(db, `
    SELECT COALESCE(SUM(active_duration_s), 0) as total,
      COUNT(DISTINCT start_date) as days
    FROM sessions ${parentClause}
  `, params)
  return {
    active: (row?.total ?? 0) / 3600,
    activeDays: row?.days ?? 1,
  }
}

export function queryFileReadHotspots(db: Database, filters: Filters): FileReadHotspot[] {
  const { clause, params } = buildWhere(filters)
  const sessionFilter = clause ? `WHERE fr.session_id IN (SELECT id FROM sessions ${clause})` : ''
  const andOrWhere = sessionFilter ? 'AND' : 'WHERE'
  return query<FileReadHotspot>(db, `
    SELECT fr.session_id, s.slug, s.project, s.cost, fr.file_path, fr.read_count, s.start_date
    FROM session_file_reads fr
    JOIN sessions s ON fr.session_id = s.id
    ${sessionFilter}
    ${andOrWhere} fr.read_count >= 3
    ORDER BY fr.read_count DESC LIMIT 50
  `, params)
}

export function queryProjectWaste(db: Database, filters: Filters): ProjectWaste[] {
  const waste = queryWasteOverview(db, filters)
  const wasteByProject = new Map<string, { cost: number; ids: Set<string> }>()

  for (const s of [...waste.outlier_sessions, ...waste.floundering_sessions, ...waste.compaction_sessions]) {
    const entry = wasteByProject.get(s.project) ?? { cost: 0, ids: new Set() }
    if (!entry.ids.has(s.id)) {
      entry.ids.add(s.id)
      entry.cost += s.cost ?? 0
    }
    wasteByProject.set(s.project, entry)
  }

  const { clause, params } = buildWhere(filters)
  const projectTotals = query<{ project: string; total_cost: number; total_sessions: number }>(db, `
    SELECT project, SUM(cost) as total_cost, COUNT(*) as total_sessions
    FROM sessions ${clause}
    GROUP BY project
  `, params)

  return projectTotals
    .map((p) => {
      const w = wasteByProject.get(p.project)
      const wasteCost = w?.cost ?? 0
      return {
        project: p.project,
        total_cost: p.total_cost,
        waste_cost: wasteCost,
        waste_sessions: w?.ids.size ?? 0,
        total_sessions: p.total_sessions,
        waste_pct: p.total_cost > 0 ? wasteCost / p.total_cost : 0,
      }
    })
    .filter((p) => p.waste_cost > 0)
    .sort((a, b) => b.waste_cost - a.waste_cost)
}

/** Compute a 0–100 waste score for a single session */
export function computeWasteScore(
  session: SessionRow,
  medianCost: number,
  maxFileRereads: number,
): { score: number; cost_outlier: number; floundering: number; compaction: number; file_rereads: number } {
  // Cost outlier: 0-40 points. At threshold = 20, at 10x threshold = 40
  const outlierThreshold = Math.max(medianCost * 3, 0.50)
  let costOutlier = 0
  if (session.cost >= outlierThreshold) {
    const ratio = session.cost / outlierThreshold
    costOutlier = Math.min(40, Math.round(ratio * 20))
  }

  // Floundering: 0-25 points. <5% output = 25, <10% = partial
  const totalFresh = session.input_tokens + session.output_tokens
  const outRatio = totalFresh > 0 ? session.output_tokens / totalFresh : 0
  let floundering = 0
  if (outRatio < 0.05 && session.cost > 0.10) {
    floundering = 25
  } else if (outRatio < 0.10 && session.cost > 0.10) {
    floundering = Math.round((1 - outRatio / 0.10) * 25)
  }

  // Compaction: 0-20 points. 3+ = 10, 5+ = 15, 8+ = 20
  let compaction = 0
  if (session.compactions >= 8) compaction = 20
  else if (session.compactions >= 5) compaction = 15
  else if (session.compactions >= 3) compaction = 10

  // File rereads: 0-15 points, scaled by max in dataset
  let fileRereads = 0
  if (maxFileRereads > 0) {
    fileRereads = Math.min(15, Math.round((maxFileRereads / 10) * 15))
  }

  const score = Math.min(100, costOutlier + floundering + compaction + fileRereads)
  return { score, cost_outlier: costOutlier, floundering, compaction, file_rereads: fileRereads }
}

/** Batch-compute waste scores for all sessions, returns Map<session_id, WasteScore> */
export function queryWasteScores(db: Database, filters: Filters): Map<string, { score: number; cost_outlier: number; floundering: number; compaction: number; file_rereads: number }> {
  const { clause, params } = buildWhere(filters)

  // Median cost
  const countRow = queryOne<{ cnt: number }>(db, `
    SELECT COUNT(*) as cnt FROM sessions ${appendCondition(clause, 'cost > 0')}
  `, params)
  const medianOffset = Math.floor((countRow?.cnt ?? 0) / 2)
  const medianRow = queryOne<{ median_cost: number }>(db, `
    SELECT cost as median_cost FROM sessions ${appendCondition(clause, 'cost > 0')}
    ORDER BY cost LIMIT 1 OFFSET $medianOffset
  `, { ...params, $medianOffset: medianOffset })
  const median = medianRow?.median_cost ?? 0

  // Max file rereads per session
  const fileReadRows = query<{ session_id: string; max_reads: number }>(db, `
    SELECT session_id, MAX(read_count) as max_reads
    FROM session_file_reads
    WHERE read_count >= 3 ${clause ? `AND session_id IN (SELECT id FROM sessions ${clause})` : ''}
    GROUP BY session_id
  `, params)
  const fileReadMap = new Map(fileReadRows.map((r) => [r.session_id, r.max_reads]))

  // All sessions
  const sessions = query<SessionRow>(db, `SELECT * FROM sessions ${clause}`, params)
  const result = new Map<string, { score: number; cost_outlier: number; floundering: number; compaction: number; file_rereads: number }>()

  for (const s of sessions) {
    const maxReads = fileReadMap.get(s.id) ?? 0
    const ws = computeWasteScore(s, median, maxReads)
    if (ws.score > 0) result.set(s.id, ws)
  }

  return result
}
