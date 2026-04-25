// ABOUT: The Explorer's Gazette — community activity timeline, showcase, and stats
// ABOUT: Publicly readable; profile creation and discovery posting requires auth

import { useNavigate } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { AppHeader } from '@/components/AppHeader/AppHeader'
import { useAuth } from '@/hooks/useAuth'
import { useCommunityFeed, useExplorerShowcase, useCommunityStats, useCreateProfile, useUpdateProfile, useExplorerProfile } from '@/hooks/useCommunity'
import type { ExplorerProfile } from '@/hooks/useCommunity'
import ActivityTimeline from '@/components/ActivityTimeline/ActivityTimeline'
import ExplorerShowcase from '@/components/ExplorerShowcase/ExplorerShowcase'
import CommunityStats from '@/components/CommunityStats/CommunityStats'
import GazetteJoinPrompt from '@/components/GazetteJoinPrompt/GazetteJoinPrompt'
import QueryErrorBanner from '@/components/QueryErrorBanner/QueryErrorBanner'

export function GazettePage() {
  const navigate = useNavigate()
  const { authState } = useAuth()
  const isAuthenticated = authState.status === 'authenticated'
  const userId = isAuthenticated ? authState.session.user.id : undefined

  const feed      = useCommunityFeed(30)
  const showcase  = useExplorerShowcase()
  const stats     = useCommunityStats()
  const explorerProfile = useExplorerProfile(userId ?? null)
  const createProfile = useCreateProfile()
  const updateProfile = useUpdateProfile()

  const hasProfile = !!explorerProfile.data

  function handleJoin(displayName: string, isPublic: boolean) {
    if (!userId) return
    createProfile.mutate({ user_id: userId, display_name: displayName, is_public: isPublic })
  }

  function handleTogglePrivacy() {
    const profile = explorerProfile.data as ExplorerProfile | null
    if (!profile || !userId) return
    updateProfile.mutate({ user_id: userId, is_public: !profile.is_public })
  }

  const profile = explorerProfile.data as ExplorerProfile | null | undefined

  // Single umbrella banner: any of the three Gazette panels failing covers the same retry path
  const hasFetchError = feed.isError || showcase.isError || stats.isError
  function retryAll() {
    if (feed.isError) feed.refetch()
    if (showcase.isError) showcase.refetch()
    if (stats.isError) stats.refetch()
  }

  return (
    <main className="flex flex-col h-full">
      <AppHeader eyebrow="Field Dispatches" title="The Explorer's Gazette" />

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-4 pb-6 space-y-6 max-w-2xl mx-auto">
        {hasFetchError && (
          <QueryErrorBanner
            headline="The Gazette could not be retrieved in full."
            body="Some dispatches did not arrive. Try again in a moment."
            onRetry={retryAll}
          />
        )}

        {/* Community stats */}
        <CommunityStats stats={stats.data} isLoading={stats.isLoading} />

        {/* Sign-in CTA for unauthenticated visitors */}
        {!isAuthenticated && (
          <div className="bg-card border rounded-sm p-6 text-center space-y-3">
            <Compass className="h-10 w-10 mx-auto text-muted-foreground/40" />
            <div>
              <p className="font-serif text-base font-medium">A fellowship of curious naturalists</p>
              <p className="font-serif text-sm text-muted-foreground italic mt-1">
                Sign in to discover QRious specimens, earn badges, and join the Gazette
              </p>
            </div>
            <button
              onClick={() => navigate('/enter')}
              className="font-mono text-xs tracking-widest px-5 py-2.5 bg-foreground text-background rounded hover:opacity-90 transition-opacity"
            >
              START EXPLORING
            </button>
          </div>
        )}

        {/* Join prompt — authenticated users without a profile */}
        {isAuthenticated && !hasProfile && explorerProfile.data !== undefined && (
          <GazetteJoinPrompt
            onSubmit={handleJoin}
            isSubmitting={createProfile.isPending}
          />
        )}

        {/* Privacy toggle — authenticated users with a profile */}
        {isAuthenticated && profile && (
          <div className="flex items-center justify-between border border-border rounded-lg px-4 py-3">
            <div>
              <p className="font-mono text-xs font-medium">{profile.display_name}</p>
              <p className="font-mono text-[10px] text-muted-foreground">
                {profile.is_public ? 'Your discoveries are public' : 'Your profile is private'}
              </p>
            </div>
            <button
              onClick={handleTogglePrivacy}
              disabled={updateProfile.isPending}
              className="font-mono text-[11px] px-3 py-1.5 border border-border rounded hover:bg-accent transition-colors disabled:opacity-50"
            >
              {profile.is_public ? 'Go private' : 'Go public'}
            </button>
          </div>
        )}

        {/* Activity timeline */}
        <section>
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
            Recent activity
          </h2>
          <ActivityTimeline
            entries={feed.data ?? []}
            isLoading={feed.isLoading}
            onViewSpecies={(qrHash) => navigate(`/species/${qrHash}`)}
          />
        </section>

        {/* Explorer showcase */}
        <section>
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground mb-3">
            Explorer showcase
          </h2>
          <ExplorerShowcase
            explorers={showcase.data ?? []}
            isLoading={showcase.isLoading}
          />
        </section>
        </div>
      </div>
    </main>
  )
}
