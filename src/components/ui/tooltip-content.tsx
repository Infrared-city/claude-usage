import type { ReactNode } from 'react'

function Tip({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="font-medium text-text-primary">{title}</p>
      <p className="text-text-secondary leading-relaxed">{children}</p>
    </div>
  )
}

// ── Waste Tab KPI Cards (1-6) ───────────────────────────────

export function WasteFlaggedTip() {
  return (
    <Tip title="Waste Flagged">
      Total $ of sessions flagged as wasteful. A session is flagged if it's a cost outlier,
      floundering, has heavy compaction, or excessive re-reads.
      Not all flagged spend is truly wasted — treat as a signal, not a verdict.
    </Tip>
  )
}

export function CostOutliersTip() {
  return (
    <Tip title="Cost Outliers">
      Sessions costing 3x+ the median, with a $0.50 floor.
      Often caused by the agent going in circles or tasks too large for one session.
    </Tip>
  )
}

export function FlounderingTip() {
  return (
    <Tip title="Floundering">
      Sessions where less than 5% of tokens were output (Claude writing).
      The agent was mostly reading, barely producing.
      Usually caused by vague prompts or oversized tasks.
    </Tip>
  )
}

export function HeavyCompactionTip() {
  return (
    <Tip title="Heavy Compaction">
      3+ context compactions in one session. Compaction = the conversation got too long,
      so Claude summarized earlier messages to make room. Repeated compaction means
      the agent loses track and re-reads files it already saw.
    </Tip>
  )
}

export function OutputRatioTip() {
  return (
    <Tip title="Output Ratio">
      Percentage of tokens that were Claude writing vs reading.
      Typical range: 1–5% for code work. Low isn't always bad — code review
      and exploration naturally have low output ratios.
    </Tip>
  )
}

export function FileRereadsTip() {
  return (
    <Tip title="File Re-reads">
      Same file read 3+ times in one session. Usually means the agent forgot
      what it read after a compaction. Fix by adding key info from these files
      to your CLAUDE.md to front-load context.
    </Tip>
  )
}

// ── Section Headers (7-8) ───────────────────────────────────

export function WasteByProjectTip() {
  return (
    <Tip title="Waste by Project">
      Each project's total waste cost. Sums all flagged sessions per project.
      The % shows waste relative to that project's total spend, not overall spend.
    </Tip>
  )
}

export function FileRereadHotspotsTip() {
  return (
    <Tip title="File Re-read Hotspots">
      Specific files read 3+ times in one session. The more reads, the more
      tokens burned re-processing the same content. Add key info from these
      files to CLAUDE.md so the agent doesn't need to re-read them.
    </Tip>
  )
}

// ── Sessions Table (9-10) ───────────────────────────────────

export function WasteColumnTip() {
  return (
    <Tip title="Waste Score">
      0–100 score combining four signals:{' '}
      <span className="text-text-primary">Cost</span> (0–40),{' '}
      <span className="text-text-primary">Floundering</span> (0–25),{' '}
      <span className="text-text-primary">Compaction</span> (0–20),{' '}
      <span className="text-text-primary">Re-reads</span> (0–15).
      Higher = more wasteful.
    </Tip>
  )
}

export function WasteScoreBreakdownTip({ score }: {
  score: { score: number; cost_outlier: number; floundering: number; compaction: number; file_rereads: number }
}) {
  return (
    <div className="space-y-1.5">
      <p className="font-medium text-text-primary">Score Breakdown: {score.score}/100</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-text-secondary">
        <span>Cost outlier:</span>
        <span className="text-right font-medium text-text-primary">{score.cost_outlier}/40</span>
        <span>Floundering:</span>
        <span className="text-right font-medium text-text-primary">{score.floundering}/25</span>
        <span>Compaction:</span>
        <span className="text-right font-medium text-text-primary">{score.compaction}/20</span>
        <span>File re-reads:</span>
        <span className="text-right font-medium text-text-primary">{score.file_rereads}/15</span>
      </div>
    </div>
  )
}

// ── Table Headers (11-12) ───────────────────────────────────

export function OutPercentTip() {
  return (
    <Tip title="Output %">
      What fraction of tokens were Claude writing vs reading.
      Below 5% = flagged as floundering (agent spent most time reading, barely writing).
    </Tip>
  )
}

export function CompactionsTip() {
  return (
    <Tip title="Compactions">
      Times context was compacted (earlier messages summarized to make room).
      3+ compactions means the task was too large for one session —
      the agent keeps losing earlier context and re-reading files.
    </Tip>
  )
}
