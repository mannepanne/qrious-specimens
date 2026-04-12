// ABOUT: The Explorer's Gazette — community activity timeline, showcase, and stats
// ABOUT: Publicly readable; profile creation and discovery posting requires auth

import { useCommunityFeed, useExplorerShowcase, useCommunityStats, useCreateProfile, useUpdateProfile } from '@/hooks/useCommunity'
import type { ExplorerProfile } from '@/hooks/useCommunity'
import ActivityTimeline from '@/components/ActivityTimeline/ActivityTimeline'
import ExplorerShowcase from '@/components/ExplorerShowcase/ExplorerShowcase'
import CommunityStats from '@/components/CommunityStats/CommunityStats'
import GazetteJoinPrompt from '@/components/GazetteJoinPrompt/GazetteJoinPrompt'

interface Props {
  isAuthenticated: boolean
  userId?: string
  explorerProfile: ExplorerProfile | null | undefined
  onSignUpCta?: () => void
  onViewSpecies?: (qrHash: string) => void
}

export function GazettePage({ isAuthenticated, userId, explorerProfile, onSignUpCta, onViewSpecies }: Props) {
  const feed      = useCommunityFeed(30)
  const showcase  = useExplorerShowcase()
  const stats     = useCommunityStats()
  const createProfile = useCreateProfile()
  const updateProfile = useUpdateProfile()

  const hasProfile = !!explorerProfile

  function handleJoin(displayName: string, isPublic: boolean) {
    if (!userId) return
    createProfile.mutate({ user_id: userId, display_name: displayName, is_public: isPublic })
  }

  function handleTogglePrivacy() {
    if (!explorerProfile || !userId) return
    updateProfile.mutate({ user_id: userId, is_public: !explorerProfile.is_public })
  }

  return (
    <main className="flex flex-col h-full overflow-y-auto">
      {/* Sign-up CTA for visitors */}
      {!isAuthenticated && (
        <div className="bg-accent/40 border-b border-border px-4 py-2 text-center shrink-0">
          <span className="font-mono text-xs text-muted-foreground">
            Reading the Gazette.{' '}
            <button
              onClick={onSignUpCta}
              className="underline hover:text-foreground transition-colors"
            >
              Sign in
            </button>
            {' '}to contribute your own discoveries.
          </span>
        </div>
      )}

      <div className="px-4 pt-4 pb-6 space-y-6">
        {/* Page title */}
        <div>
          <h1 className="font-serif text-2xl">The Explorer's Gazette</h1>
          <p className="font-mono text-xs text-muted-foreground mt-0.5">
            Field reports from naturalists across the expedition
          </p>
        </div>

        {/* Community stats */}
        <CommunityStats stats={stats.data} isLoading={stats.isLoading} />

        {/* Join prompt — authenticated users without a profile */}
        {isAuthenticated && !hasProfile && explorerProfile !== undefined && (
          <GazetteJoinPrompt
            onSubmit={handleJoin}
            isSubmitting={createProfile.isPending}
          />
        )}

        {/* Privacy toggle — authenticated users with a profile */}
        {isAuthenticated && explorerProfile && (
          <div className="flex items-center justify-between border border-border rounded-lg px-4 py-3">
            <div>
              <p className="font-mono text-xs font-medium">{explorerProfile.display_name}</p>
              <p className="font-mono text-[10px] text-muted-foreground">
                {explorerProfile.is_public ? 'Your discoveries are public' : 'Your profile is private'}
              </p>
            </div>
            <button
              onClick={handleTogglePrivacy}
              disabled={updateProfile.isPending}
              className="font-mono text-[11px] px-3 py-1.5 border border-border rounded hover:bg-accent transition-colors disabled:opacity-50"
            >
              {explorerProfile.is_public ? 'Go private' : 'Go public'}
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
            onViewSpecies={onViewSpecies}
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
    </main>
  )
}
