import type { ParsedSession } from './types'
import { PRICING } from './pricing'
import { CREATE_TABLES, CREATE_INDEXES } from './schema'

const ANALYZER_VERSION = '2.0.0'

export async function buildDatabase(sessions: ParsedSession[]): Promise<Uint8Array> {
  const initSqlJs = (await import('sql.js')).default
  const SQL = await initSqlJs({
    locateFile: () => '/sql-wasm.wasm',
  })

  const db = new SQL.Database()
  db.run(CREATE_TABLES)
  db.run(CREATE_INDEXES)

  db.run('BEGIN TRANSACTION')

  const insertSession = db.prepare(`
    INSERT OR REPLACE INTO sessions (
      id, slug, project, primary_model,
      start_ts, end_ts, duration_s, active_duration_s,
      user_messages, api_calls, turns,
      avg_turn_s, cost,
      input_tokens, output_tokens,
      cache_5m_tokens, cache_1h_tokens,
      cache_read_tokens, tool_calls,
      compactions, max_context_tokens,
      error_count, subagent_spawns,
      sidechain_msgs, is_subagent,
      version, cwd, git_branch, file_hash
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `)

  const insertTool = db.prepare(`
    INSERT OR REPLACE INTO session_tools (session_id, tool_name, call_count) VALUES (?,?,?)
  `)

  const insertError = db.prepare(`
    INSERT INTO session_errors (session_id, error_text) VALUES (?,?)
  `)

  const insertRateLimit = db.prepare(`
    INSERT INTO rate_limit_blocks (session_id, start_ts, resume_ts, reset_text) VALUES (?,?,?,?)
  `)

  for (const s of sessions) {
    // Simple hash from session data for dedup
    const hashInput = `${s.session_id}|${s.start}|${s.cost}|${s.api_calls}`
    let hash = 0
    for (let i = 0; i < hashInput.length; i++) {
      hash = ((hash << 5) - hash + hashInput.charCodeAt(i)) | 0
    }
    const fileHash = Math.abs(hash).toString(16).padStart(8, '0')

    insertSession.run([
      s.session_id,
      s.slug || '',
      s.project,
      s.primary_model,
      s.start || '',
      s.end || '',
      s.duration_s,
      s.active_duration_s,
      s.user_messages,
      s.api_calls,
      s.turns,
      s.avg_turn_s,
      s.cost,
      s.tokens.input,
      s.tokens.output,
      s.tokens.cache_5m,
      s.tokens.cache_1h,
      s.tokens.cache_read,
      s.tool_calls,
      s.compactions,
      s.max_context_tokens,
      s.errors.length,
      s.subagent_spawns,
      s.sidechain_msgs,
      s.is_subagent ? 1 : 0,
      s.version || '',
      s.cwd || '',
      s.git_branch || '',
      fileHash,
    ])

    // Tools
    db.run('DELETE FROM session_tools WHERE session_id = ?', [s.session_id])
    for (const [toolName, callCount] of Object.entries(s.tools)) {
      insertTool.run([s.session_id, toolName, callCount])
    }

    // Errors
    db.run('DELETE FROM session_errors WHERE session_id = ?', [s.session_id])
    for (const errText of s.errors) {
      insertError.run([s.session_id, errText])
    }

    // Rate limit blocks
    db.run('DELETE FROM rate_limit_blocks WHERE session_id = ?', [s.session_id])
    for (const rl of s.rate_limit_blocks) {
      insertRateLimit.run([s.session_id, rl.start_ts, rl.resume_ts, rl.reset_text])
    }
  }

  // Meta
  const now = new Date().toISOString()
  db.run("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", ['pricing', JSON.stringify(PRICING)])
  db.run("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", ['export_timestamp', now])
  db.run("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)", ['analyzer_version', ANALYZER_VERSION])

  insertSession.free()
  insertTool.free()
  insertError.free()
  insertRateLimit.free()

  db.run('COMMIT')

  const bytes = db.export()
  db.close()
  return bytes
}
