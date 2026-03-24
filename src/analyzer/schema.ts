export const CREATE_TABLES = `
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    slug TEXT, project TEXT, primary_model TEXT,
    start_ts TEXT, end_ts TEXT, duration_s REAL, active_duration_s REAL,
    user_messages INT, api_calls INT, turns INT,
    avg_turn_s REAL, cost REAL,
    input_tokens INT, output_tokens INT,
    cache_5m_tokens INT, cache_1h_tokens INT,
    cache_read_tokens INT, tool_calls INT,
    compactions INT, max_context_tokens INT,
    error_count INT, subagent_spawns INT,
    sidechain_msgs INT, is_subagent INT,
    version TEXT, cwd TEXT, git_branch TEXT,
    file_hash TEXT,
    start_date TEXT GENERATED ALWAYS AS (substr(start_ts,1,10)) STORED,
    start_hour INT GENERATED ALWAYS AS (cast(substr(start_ts,12,2) as integer)) STORED
  );

  CREATE TABLE IF NOT EXISTS session_tools (
    session_id TEXT REFERENCES sessions(id),
    tool_name TEXT, call_count INT,
    PRIMARY KEY (session_id, tool_name)
  );

  CREATE TABLE IF NOT EXISTS session_errors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT REFERENCES sessions(id),
    error_text TEXT
  );

  CREATE TABLE IF NOT EXISTS rate_limit_blocks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT REFERENCES sessions(id),
    start_ts TEXT, resume_ts TEXT, reset_text TEXT
  );

  CREATE TABLE IF NOT EXISTS session_file_reads (
    session_id TEXT REFERENCES sessions(id),
    file_path TEXT,
    read_count INT,
    PRIMARY KEY (session_id, file_path)
  );

  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY, value TEXT
  );
`

export const CREATE_INDEXES = `
  CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project);
  CREATE INDEX IF NOT EXISTS idx_sessions_start_date ON sessions(start_date);
  CREATE INDEX IF NOT EXISTS idx_sessions_primary_model ON sessions(primary_model);
  CREATE INDEX IF NOT EXISTS idx_sessions_cost_desc ON sessions(cost DESC);
  CREATE INDEX IF NOT EXISTS idx_sessions_start_ts ON sessions(start_ts);
`
