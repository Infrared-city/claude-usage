import { useState } from 'react'

type OS = 'mac' | 'windows' | 'linux'

function detectOS(): OS {
  const ua = navigator.userAgent.toLowerCase()
  if (ua.includes('mac')) return 'mac'
  if (ua.includes('win')) return 'windows'
  return 'linux'
}

const instructions: Record<OS, { path: string; shortcut: string; label: string }> = {
  mac: {
    path: '~/.claude/projects',
    shortcut: 'Press Cmd+Shift+G and paste the path',
    label: 'macOS',
  },
  windows: {
    path: '%USERPROFILE%\\.claude\\projects',
    shortcut: 'Type in the address bar',
    label: 'Windows',
  },
  linux: {
    path: '~/.claude/projects',
    shortcut: 'Press Ctrl+L and type the path',
    label: 'Linux',
  },
}

export function FolderHelp() {
  const detected = detectOS()
  const [showAll, setShowAll] = useState(false)
  const [copied, setCopied] = useState(false)

  const platforms = showAll ? (['mac', 'windows', 'linux'] as OS[]) : [detected]

  function copyPath(path: string) {
    navigator.clipboard.writeText(path.replace('~', '$HOME'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-text-secondary">
        Navigate to your Claude Code projects directory:
      </p>
      {platforms.map((os) => {
        const info = instructions[os]
        return (
          <div key={os} className="rounded-lg bg-bg-elevated p-3">
            <p className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-1">
              {info.label}
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 text-sm font-mono text-accent bg-bg-deep rounded px-2 py-1">
                {info.path}
              </code>
              <button
                onClick={() => copyPath(info.path)}
                className="px-2 py-1 text-xs rounded bg-bg-card border border-border hover:bg-border transition-colors text-text-secondary"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <p className="mt-1 text-xs text-text-secondary">{info.shortcut}</p>
          </div>
        )
      })}
      {!showAll && (
        <button
          onClick={() => setShowAll(true)}
          className="text-xs text-text-secondary hover:text-text-primary underline"
        >
          Show all platforms
        </button>
      )}
    </div>
  )
}
