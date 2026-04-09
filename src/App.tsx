// ABOUT: Root application component — auth gate, navigation shell, tab routing
// ABOUT: State-based routing: activeTab drives which page renders (no URL router)
import { useState } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { Toaster } from '@/components/ui/sonner'
import { useAuth } from '@/hooks/useAuth'
import { TabBar, type Tab } from '@/components/TabBar/TabBar'
import { SiteFooter } from '@/components/SiteFooter/SiteFooter'
import { EmailConfirmBanner } from '@/components/EmailConfirmBanner/EmailConfirmBanner'
import { AuthPage } from '@/pages/AuthPage'
import { ScanPage } from '@/pages/ScanPage'
import { CabinetPage } from '@/pages/CabinetPage'
import { CommunityPage } from '@/pages/CommunityPage'
import { ProfilePage } from '@/pages/ProfilePage'

function AppShell() {
  const { authState, sendMagicLink, signOut } = useAuth()
  const [activeTab, setActiveTab] = useState<Tab>('scan')

  // Show nothing while resolving the initial session — avoids auth flash
  if (authState.status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="animate-breathe text-muted-foreground text-sm">Loading…</p>
      </div>
    )
  }

  if (authState.status === 'unauthenticated') {
    return <AuthPage sendMagicLink={sendMagicLink} />
  }

  const { session } = authState
  const email = session.user.email ?? ''
  const emailConfirmed = !!session.user.email_confirmed_at

  return (
    <div className="flex min-h-screen flex-col">
      {!emailConfirmed && <EmailConfirmBanner email={email} />}

      <div className="flex-1 pb-16">
        {activeTab === 'scan'      && <ScanPage />}
        {activeTab === 'cabinet'   && <CabinetPage />}
        {activeTab === 'community' && <CommunityPage />}
        {activeTab === 'profile'   && (
          <ProfilePage email={email} signOut={signOut} />
        )}
      </div>

      <SiteFooter />
      <TabBar activeTab={activeTab} onTabChange={setActiveTab} />
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
