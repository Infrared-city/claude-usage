export function BrowserGate() {
  const supported = 'showDirectoryPicker' in window

  if (supported) return null

  return (
    <div className="rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm">
      <p className="font-medium text-warning">Browser Not Supported</p>
      <p className="mt-1 text-text-secondary">
        This app requires the File System Access API, which is available in{' '}
        <strong>Chrome</strong> or <strong>Edge</strong> (version 86+).
        Please open this page in one of those browsers.
      </p>
    </div>
  )
}

export function isBrowserSupported(): boolean {
  return 'showDirectoryPicker' in window
}
