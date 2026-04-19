// ABOUT: Field Kit page — account preferences, Gazette profile, badge visibility, and links
// ABOUT: Two-column layout: left shows rank and badge list; right shows settings and information

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import {
  ArrowLeft,
  Shield,
  Info,
  Newspaper,
  Sparkles,
  Eye,
  EyeOff,
  Medal,
  User,
  CircleHelp,
  FileText,
  Mail,
  LogOut,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import {
  useExplorerProfile,
  useUpdateProfile,
  useMyBadges,
  useToggleBadgeVisibility,
} from '@/hooks/useCommunity'
import { useBadgeDefinitions, useExplorerRank } from '@/hooks/useBadges'
import type { BadgeDefinition } from '@/hooks/useBadges'
import ExplorerRankCard from '@/components/ExplorerRankCard/ExplorerRankCard'
import { generateExplorerName } from '@/lib/explorerNames'

// ── Field Kit page ────────────────────────────────────────────────────────────

export function SettingsPage() {
  const navigate = useNavigate()
  const { authState } = useAuth()
  const session = authState.status === 'authenticated' ? authState.session : null
  const userId = session?.user.id ?? null
  const userEmail = session?.user.email ?? ''

  const { data: isAdmin } = useIsAdmin(userId)

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/enter')
  }

  return (
    <main className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 shrink-0 border-b border-border flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Go back"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="font-serif text-lg font-medium flex-1">Field Kit</h1>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-1.5 font-mono text-[10px] tracking-wider text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title="Close journal"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Close journal</span>
        </button>
      </div>

      <div className="max-w-3xl mx-auto w-full px-4 py-8 pb-24 overflow-y-auto flex-1">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left column: Achievements */}
        <RankAndBadges userId={userId} />

        {/* Right column: Settings */}
        <div className="space-y-8">
          <GazetteProfileSettings userId={userId} />
          <AccountSection email={userEmail} />
          <InformationSection
            isAdmin={!!isAdmin}
            onSignOut={handleSignOut}
            onNavigate={navigate}
          />
        </div>
      </div>
      </div>
    </main>
  )
}

// ── Left column: rank card + badge flat list ──────────────────────────────────

function RankAndBadges({ userId }: { userId: string | null }) {
  const { data: rank, isLoading: rankLoading } = useExplorerRank(userId)
  const { data: definitions } = useBadgeDefinitions()
  const { data: myBadges } = useMyBadges(userId)
  const toggleVisibility = useToggleBadgeVisibility()

  const earnedMap = new Map(myBadges?.map((b) => [b.badge_slug, b]) ?? [])

  return (
    <div className="space-y-3">
      <h2 className="font-mono text-[10px] tracking-[2px] text-muted-foreground uppercase flex items-center gap-2">
        <Medal className="h-3 w-3" />
        Achievements
      </h2>

      <ExplorerRankCard rank={rank} isLoading={rankLoading} />

      {definitions && definitions.length > 0 && (
        <div className="bg-card border rounded-sm divide-y">
          {definitions.map((def: BadgeDefinition) => {
            const earned = earnedMap.get(def.slug)
            const isEarned = !!earned

            return (
              <div
                key={def.slug}
                className={`flex items-center gap-3 px-4 py-3 ${isEarned ? '' : 'opacity-35'}`}
              >
                <span className="text-base flex-shrink-0">{def.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className={`font-serif text-xs font-medium ${isEarned ? '' : 'text-muted-foreground'}`}>
                    {def.name}
                  </p>
                  <p className="font-serif text-[10px] text-muted-foreground italic truncate">
                    {def.description}
                  </p>
                </div>

                {isEarned && earned && userId ? (
                  <button
                    onClick={() =>
                      toggleVisibility.mutate({
                        badgeId: earned.id,
                        isPublic: !earned.is_public,
                        userId,
                      })
                    }
                    className="text-muted-foreground hover:text-foreground transition-colors p-1"
                    title={earned.is_public ? 'Visible on Gazette' : 'Hidden from Gazette'}
                    aria-label={earned.is_public ? 'Hide badge from Gazette' : 'Show badge on Gazette'}
                  >
                    {earned.is_public ? (
                      <Eye className="h-3.5 w-3.5" />
                    ) : (
                      <EyeOff className="h-3.5 w-3.5" />
                    )}
                  </button>
                ) : (
                  !isEarned && (
                    <span className="font-mono text-[8px] tracking-wider text-muted-foreground/50">
                      LOCKED
                    </span>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Right column: Gazette profile editor ──────────────────────────────────────

function GazetteProfileSettings({ userId }: { userId: string | null }) {
  const { data: profile, isLoading: profileLoading } = useExplorerProfile(userId)
  const updateProfile = useUpdateProfile()

  const [displayName, setDisplayName] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [editing, setEditing] = useState(false)

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name)
      setIsPublic(profile.is_public)
    }
  }, [profile])

  if (profileLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-20 w-full rounded-sm" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="space-y-3">
        <h2 className="font-mono text-[10px] tracking-[2px] text-muted-foreground uppercase flex items-center gap-2">
          <Newspaper className="h-3 w-3" />
          Explorer&rsquo;s Gazette
        </h2>
        <div className="bg-card border rounded-sm p-4">
          <p className="font-serif text-sm text-muted-foreground italic">
            Visit the Gazette to join the fellowship of naturalists.
          </p>
        </div>
      </div>
    )
  }

  const handleSave = async () => {
    const name = displayName.trim()
    if (name.length < 2) {
      toast.error('Display name must be at least 2 characters.')
      return
    }
    try {
      await updateProfile.mutateAsync({ user_id: profile.user_id, display_name: name, is_public: isPublic })
      setEditing(false)
      toast.success('Profile updated.')
    } catch {
      toast.error('Could not save profile.')
    }
  }

  return (
    <div className="space-y-3">
      <h2 className="font-mono text-[10px] tracking-[2px] text-muted-foreground uppercase flex items-center gap-2">
        <Newspaper className="h-3 w-3" />
        Explorer&rsquo;s Gazette
      </h2>

      <div className="bg-card border rounded-sm p-4 space-y-4">
        {editing ? (
          <>
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Your explorer name…"
                  maxLength={30}
                  className="font-serif flex-1"
                />
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="icon" title="Suggest a name" className="flex-shrink-0">
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="font-serif">Regenerate display name?</AlertDialogTitle>
                      <AlertDialogDescription className="font-serif">
                        This will replace your current display name with a new randomly generated one.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="font-mono text-xs tracking-wider">
                        KEEP CURRENT
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => setDisplayName(generateExplorerName())}
                        className="font-mono text-xs tracking-wider"
                      >
                        REGENERATE
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-serif text-xs text-muted-foreground">
                    Show on the Gazette publicly
                  </span>
                </div>
                <Switch checked={isPublic} onCheckedChange={setIsPublic} />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleSave}
                disabled={updateProfile.isPending}
                className="font-mono text-xs tracking-wider"
              >
                {updateProfile.isPending ? 'SAVING…' : 'SAVE CHANGES'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setDisplayName(profile.display_name)
                  setIsPublic(profile.is_public)
                  setEditing(false)
                }}
              >
                Cancel
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="font-serif text-sm font-medium">{profile.display_name}</p>
              <p className="font-mono text-[10px] tracking-wider text-muted-foreground mt-0.5">
                {profile.is_public ? 'VISIBLE ON THE GAZETTE' : 'PRIVATE — NOT SHOWN PUBLICLY'}
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Account section ───────────────────────────────────────────────────────────

function AccountSection({ email }: { email: string }) {
  return (
    <div className="space-y-3">
      <h2 className="font-mono text-[10px] tracking-[2px] text-muted-foreground uppercase flex items-center gap-2">
        <User className="h-3 w-3" />
        Account
      </h2>
      <div className="bg-card border rounded-sm p-4">
        <p className="font-mono text-[10px] tracking-wider text-muted-foreground">
          CORRESPONDENCE ADDRESS
        </p>
        <p className="font-mono text-sm mt-1">{email}</p>
      </div>
    </div>
  )
}

// ── Information section ───────────────────────────────────────────────────────

function InformationSection({
  isAdmin,
  onSignOut,
  onNavigate,
}: {
  isAdmin: boolean
  onSignOut: () => void
  onNavigate: (path: string) => void
}) {
  return (
    <div className="space-y-3">
      <h2 className="font-mono text-[10px] tracking-[2px] text-muted-foreground uppercase flex items-center gap-2">
        <Info className="h-3 w-3" />
        Information
      </h2>
      <div className="space-y-2">
        <button
          onClick={() => onNavigate('/about')}
          className="w-full bg-card border rounded-sm p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
        >
          <CircleHelp className="h-4 w-4 text-muted-foreground" />
          <span className="font-serif text-sm">About QRious Specimens</span>
        </button>

        <button
          onClick={() => onNavigate('/privacy')}
          className="w-full bg-card border rounded-sm p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
        >
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="font-serif text-sm">Privacy Policy</span>
        </button>

        <button
          onClick={() => onNavigate('/contact')}
          className="w-full bg-card border rounded-sm p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
        >
          <Mail className="h-4 w-4 text-muted-foreground" />
          <span className="font-serif text-sm">Contact the Curators</span>
        </button>

        {isAdmin && (
          <button
            onClick={() => onNavigate('/admin')}
            className="w-full bg-card border rounded-sm p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left"
          >
            <Shield className="h-4 w-4 text-amber-600" />
            <span className="font-serif text-sm">Administration</span>
          </button>
        )}

        <button
          onClick={onSignOut}
          className="w-full bg-card border rounded-sm p-4 flex items-center gap-3 hover:bg-muted/50 transition-colors text-left text-muted-foreground"
        >
          <LogOut className="h-4 w-4" />
          <span className="font-serif text-sm">Sign out</span>
        </button>
      </div>
    </div>
  )
}
