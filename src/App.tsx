// ABOUT: Root application component — layered navigation shell with per-destination auth
// ABOUT: Catalogue and Gazette are publicly browsable; Cabinet and overlays require auth
import { useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { Toaster } from '@/components/ui/sonner'
import { useAuth } from '@/hooks/useAuth'
import { TabBar, type Tab, type Overlay, type Subpage } from '@/components/TabBar/TabBar'
import { SiteFooter } from '@/components/SiteFooter/SiteFooter'
import { AuthPage } from '@/pages/AuthPage'
import { CataloguePage } from '@/pages/CataloguePage'
import { GazettePage } from '@/pages/GazettePage'
import { CabinetPage } from '@/pages/CabinetPage'

// Cabinet requires an active session. Catalogue and Gazette are intentionally omitted —
// they are publicly browsable by design. Phase 5 enables real content on those tabs.
const AUTH_REQUIRED_TABS: Tab[] = ['cabinet']
const AUTH_REQUIRED_OVERLAYS: Overlay[] = ['scanner', 'hatching', 'specimen']

interface NavState {
  tab: Tab
  overlay: Overlay
  subpage: Subpage
}

function AppShell() {
  const { authState, sendMagicLink, signOut } = useAuth()
  const [nav, setNav] = useState<NavState>({ tab: 'catalogue', overlay: null, subpage: null })

  function navigateTab(tab: Tab) {
    setNav({ tab, overlay: null, subpage: null })
  }

  // Show nothing while resolving the initial session — avoids auth flash
  if (authState.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="animate-breathe text-muted-foreground text-sm">Loading…</p>
      </div>
    )
  }

  // Network or storage failure on session load
  if (authState.status === 'error') {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center space-y-3">
          <p className="font-serif text-lg">Could not connect to the Cabinet</p>
          <p className="text-sm text-muted-foreground">{authState.message}</p>
          <button
            className="text-sm underline underline-offset-4 hover:text-foreground text-muted-foreground"
            onClick={() => window.location.reload()}
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  const isAuthenticated = authState.status === 'authenticated'

  // Gate auth-required tabs: show AuthPage inline rather than hard-blocking the whole shell
  const tabNeedsAuth = AUTH_REQUIRED_TABS.includes(nav.tab)
  const overlayNeedsAuth = nav.overlay !== null && AUTH_REQUIRED_OVERLAYS.includes(nav.overlay)

  if (!isAuthenticated && (tabNeedsAuth || overlayNeedsAuth)) {
    return <AuthPage sendMagicLink={sendMagicLink} />
  }

  const email = isAuthenticated ? (authState.session.user.email ?? '') : ''

  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex-1 pb-16">
        {nav.tab === 'catalogue' && <CataloguePage />}
        {nav.tab === 'gazette'   && <GazettePage />}
        {nav.tab === 'cabinet'   && isAuthenticated && (
          <CabinetPage email={email} signOut={signOut} />
        )}
      </div>

      <SiteFooter />
      <TabBar
        activeTab={nav.tab}
        onTabChange={navigateTab}
        hidden={nav.overlay !== null}
      />
    </div>
  )
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppShell />
      <Toaster />
    </QueryClientProvider>
  )
}
