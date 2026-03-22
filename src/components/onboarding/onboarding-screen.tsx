import { useScanStore } from '@/stores/scan-store'
import { BrowserGate, isBrowserSupported } from './browser-gate'
import { FolderHelp } from './folder-help'
import { ScanProgress } from './scan-progress'
import { Button } from '@/components/ui/button'

export function OnboardingScreen() {
  const scanState = useScanStore((s) => s.state)
  const error = useScanStore((s) => s.error)
  const startScan = useScanStore((s) => s.startScan)
  const supported = isBrowserSupported()

  return (
    <div className="min-h-screen bg-bg-deep flex items-center justify-center p-6">
      <div className="max-w-lg w-full space-y-8">
        {/* Header */}
        <div className="text-center space-y-3">
          <h1 className="text-3xl font-bold text-text-primary">
            Claude Code Usage Dashboard
          </h1>
          <p className="text-text-secondary">
            See where your tokens and dollars go.
            <br />
            100% private — data never leaves your browser.
          </p>
        </div>

        <BrowserGate />

        {/* Main content based on scan state */}
        {scanState === 'scanning' ? (
          <ScanProgress />
        ) : scanState === 'error' ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-error/30 bg-error/5 p-4 text-sm">
              <p className="font-medium text-error">Scan Error</p>
              <p className="mt-1 text-text-secondary">{error}</p>
            </div>
            {supported && (
              <div className="text-center">
                <Button variant="accent" size="lg" onClick={startScan}>
                  Try Again
                </Button>
              </div>
            )}
          </div>
        ) : scanState === 'reauthorize' ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm">
              <p className="font-medium text-warning">Permission Required</p>
              <p className="mt-1 text-text-secondary">
                We need permission to read your Claude projects directory again. Click below to re-authorize.
              </p>
            </div>
            <div className="text-center">
              <Button variant="accent" size="lg" onClick={startScan}>
                Re-authorize & Scan
              </Button>
            </div>
          </div>
        ) : (
          /* idle or restoring */
          <>
            {supported && (
              <div className="text-center">
                <Button
                  variant="accent"
                  size="lg"
                  className="px-8 text-base"
                  onClick={startScan}
                >
                  Scan My Usage
                </Button>
              </div>
            )}
            <FolderHelp />
          </>
        )}

        {/* Privacy footer */}
        <p className="text-center text-xs text-text-secondary/50">
          All processing happens locally in your browser using WebAssembly.
          No data is uploaded or sent anywhere.
        </p>
      </div>
    </div>
  )
}
