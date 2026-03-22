import { createRootRoute, Outlet, useNavigate } from '@tanstack/react-router'
import { NavTabs } from '@/components/layout/nav-tabs'
import { FilterBar } from '@/components/layout/filter-bar'
import { OnboardingScreen } from '@/components/onboarding/onboarding-screen'
import { useFilterStore } from '@/stores/filter-store'
import { useScanStore } from '@/stores/scan-store'
import { useEffect } from 'react'

export const Route = createRootRoute({
  component: RootLayout,
})

const keyRoutes: Record<string, string> = {
  '1': '/overview',
  '2': '/costs',
  '3': '/sessions',
  '4': '/tokens',
  '5': '/patterns',
  '6': '/errors',
}

function RootLayout() {
  const navigate = useNavigate()
  const resetFilters = useFilterStore((s) => s.resetFilters)
  const scanState = useScanStore((s) => s.state)
  const restore = useScanStore((s) => s.restore)

  // On mount, try restoring from IndexedDB
  useEffect(() => {
    restore()
  }, [restore])

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return

      if (e.key in keyRoutes) {
        e.preventDefault()
        navigate({ to: keyRoutes[e.key] })
      } else if (e.key === 'Escape') {
        resetFilters()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [navigate, resetFilters])

  // Show onboarding unless data is ready
  if (scanState !== 'ready') {
    return <OnboardingScreen />
  }

  return (
    <div className="min-h-screen bg-bg-deep">
      <NavTabs />
      <FilterBar />
      <main className="p-6 max-w-[1600px] mx-auto">
        <Outlet />
      </main>
    </div>
  )
}
