# Claude Usage Dashboard

100% client-side SPA that parses Claude Code JSONL logs and visualizes usage data. Deployed at `usage.infrared.city`.

## Quick Start

```bash
npm install --legacy-peer-deps
npm run dev          # http://localhost:5173/
```

## How It Works

1. User clicks "Scan My Usage" and selects `~/.claude/projects/` via File System Access API
2. A Web Worker walks the directory, parses JSONL files, and builds a sql.js SQLite database
3. The DB bytes are transferred to the main thread (zero-copy Transferable)
4. Dashboard renders using the same query layer as before
5. DB snapshot + file manifest are persisted in IndexedDB for instant reload

## Architecture

```
src/
├── analyzer/          # TypeScript port of analyze.py (no React deps)
│   ├── types.ts       # ParsedSession, TokenUsage, FileManifest
│   ├── pricing.ts     # Pricing table + costForUsage()
│   ├── parser.ts      # parseSession() — line-by-line JSONL parser
│   ├── schema.ts      # SQL DDL + index creation
│   └── db-builder.ts  # ParsedSession[] → sql.js Uint8Array
├── worker/            # Web Worker for scanning
│   ├── messages.ts    # Typed message protocol
│   ├── directory-walker.ts  # Async generator for FileSystemDirectoryHandle
│   └── scan.worker.ts      # Entry point: walk, parse, build DB
├── data/              # DB layer
│   ├── db.ts          # sql.js init (IndexedDB → fetch fallback)
│   ├── idb-cache.ts   # IndexedDB for handle + manifest + DB snapshot
│   ├── queries.ts     # All SQL queries (unchanged from original)
│   └── types.ts       # TypeScript interfaces for query results
├── stores/
│   ├── filter-store.ts  # Zustand: filters
│   └── scan-store.ts    # Zustand: scan state machine
├── components/
│   ├── onboarding/    # First-visit experience
│   ├── layout/        # NavTabs, FilterBar, ScanStatus
│   ├── charts/        # Recharts wrappers
│   ├── stats/         # KPI cards
│   └── ui/            # Card, Badge, Button
├── app/routes/        # 6 tabs (unchanged)
└── lib/format.ts      # Formatting utilities
```

## Key Patterns

- **sql.js ESM workaround**: Vite alias `'sql.js': 'sql.js/dist/sql-wasm.js'` + dynamic import
- **Filter store**: Use `useShallow` from `zustand/shallow` for selectors
- **All `useQuery` hooks**: Must have `placeholderData: (prev) => prev`
- **Stacked area chart**: Uses `type="stepAfter"` to avoid broken geometry
- **Scan store state machine**: `idle → restoring → ready` (return visit) or `idle → scanning → ready`
- **Project name extraction**: Generic pattern detection, not hardcoded to any username

## Browser Support

- **Chrome/Edge 86+**: Full support via File System Access API
- **Firefox/Safari**: Not supported (showDirectoryPicker unavailable)

## Deploy

Push to `main` → GitHub Actions → Cloudflare Pages → `usage.infrared.city`

## Dependencies Note

Some deps require `--legacy-peer-deps` due to vite 8 peer dep conflicts.
