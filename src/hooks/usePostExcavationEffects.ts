// ABOUT: Side-effect orchestration hook for the post-excavation flow
// ABOUT: Handles discovery activity posting, badge checking, badge toasts, and rank-up notifications

import { useCallback, useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useCheckBadges, usePostActivity } from './useCommunity'
import { useBadgeDefinitions, useExplorerRank, RANK_DISPLAY, RANK_ORDER } from './useBadges'
import type { ExplorerRank } from './useBadges'
import type { CreatureRow } from '@/types/creature'

interface ExplorerProfileSnapshot {
  is_public: boolean
}

/**
 * Runs all community-layer side effects after a successful QR excavation:
 * - Posts discovery or first_discovery activity for public profiles
 * - Checks and awards badges, firing a toast per newly earned badge (with tier label)
 * - Posts badge_earned activity for public profiles on each new badge
 * - Invalidates the explorer-rank query so rank reflects any newly awarded badges
 * - Fires a rank-up toast when the explorer tier advances
 */
export function usePostExcavationEffects(
  userId: string | null,
  explorerProfile: ExplorerProfileSnapshot | null | undefined,
) {
  const checkBadges = useCheckBadges()
  const postActivity = usePostActivity()
  const badgeDefs = useBadgeDefinitions()
  const explorerRank = useExplorerRank(userId)
  const queryClient = useQueryClient()

  // Refs ensure fireEffects always reads the latest values without them appearing in its dep array
  const explorerProfileRef = useRef(explorerProfile)
  explorerProfileRef.current = explorerProfile
  const badgeDefsRef = useRef(badgeDefs.data)
  badgeDefsRef.current = badgeDefs.data
  const checkBadgesRef = useRef(checkBadges)
  checkBadgesRef.current = checkBadges
  const postActivityRef = useRef(postActivity)
  postActivityRef.current = postActivity

  // Rank-up detection — fires a toast only when the tier advances
  const prevRankRef = useRef<ExplorerRank['rank'] | undefined>(undefined)
  useEffect(() => {
    if (!explorerRank.data) return
    const prev = prevRankRef.current
    prevRankRef.current = explorerRank.data.rank
    const prevIdx = prev !== undefined ? RANK_ORDER.indexOf(prev) : -1
    const newIdx = RANK_ORDER.indexOf(explorerRank.data.rank)
    if (prev !== undefined && newIdx > prevIdx) {
      toast(RANK_DISPLAY[explorerRank.data.rank]?.name ?? explorerRank.data.rank, {
        description: 'You have been promoted to a new rank.',
      })
    }
  }, [explorerRank.data]) // eslint-disable-line react-hooks/exhaustive-deps

  const fireEffects = useCallback(
    (creature: CreatureRow, isFirstDiscoverer: boolean) => {
      if (!userId) return

      // Post discovery activity if the explorer has opted in to public visibility
      if (explorerProfileRef.current?.is_public) {
        const speciesName = `${creature.dna.genus} ${creature.dna.species}`.trim()
        const eventType = isFirstDiscoverer ? 'first_discovery' : 'discovery'
        postActivityRef.current.mutate({
          event_type: eventType,
          species_name: speciesName,
          qr_hash: creature.qr_hash,
        })
      }

      // Check and award badges, then fire toasts for each newly earned one
      checkBadgesRef.current.mutate(userId, {
        onSuccess: (badges) => {
          const newBadges = badges.filter((b) => b.r_is_new)
          const defMap = new Map(badgeDefsRef.current?.map((d) => [d.slug, d]) ?? [])
          for (const badge of newBadges) {
            const tier = defMap.get(badge.r_badge_slug)?.tier
            const tierLabel = tier ? ` · ${tier.toUpperCase()}` : ''
            toast(`${badge.r_badge_icon} ${badge.r_badge_name}${tierLabel}`, {
              description: 'New badge earned!',
            })
            // Write badge activity to the Gazette feed for public profiles
            if (explorerProfileRef.current?.is_public) {
              postActivityRef.current.mutate({
                event_type: 'badge_earned',
                badge_slug: badge.r_badge_slug,
              })
            }
          }
          // Re-evaluate rank now that new badges may have been awarded
          queryClient.invalidateQueries({ queryKey: ['explorer-rank'] })
        },
      })
    },
    [userId, queryClient],
  )

  return { fireEffects }
}
