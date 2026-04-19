// ABOUT: Admin dashboard — contact inbox, user management, GDPR tools, and analytics placeholder
// ABOUT: Only accessible to users with is_admin = true in profiles; enforced at DB level by RPCs

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
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
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from 'sonner'
import { Check, Mail, Users, BarChart3, Download, Trash2, ArrowLeft, Shield } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useIsAdmin } from '@/hooks/useIsAdmin'
import {
  useAdminMessages,
  useAdminUsers,
  useAdminStats,
  useMarkMessageRead,
  useGdprExport,
  useGdprDelete,
  type AdminUser,
  type ContactMessage,
} from '@/hooks/useAdmin'

type AdminTab = 'stats' | 'messages' | 'users'

// ── Admin page shell ──────────────────────────────────────────────────────────

export function AdminPage() {
  const navigate = useNavigate()
  const { authState } = useAuth()
  const userId = authState.status === 'authenticated' ? authState.session.user.id : undefined
  const { data: isAdmin, isLoading } = useIsAdmin(userId)
  const [activeTab, setActiveTab] = useState<AdminTab>('stats')

  if (isLoading) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8">
        <Skeleton className="h-6 w-40" />
      </main>
    )
  }

  if (!isAdmin) {
    return (
      <main className="max-w-4xl mx-auto px-4 py-8 text-center space-y-4">
        <Shield className="h-8 w-8 text-muted-foreground mx-auto" />
        <p className="font-serif text-muted-foreground">
          This area is restricted to cabinet administrators.
        </p>
        <Button variant="ghost" size="sm" onClick={() => navigate('/settings')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Return to Field Kit
        </Button>
      </main>
    )
  }

  const TABS: { id: AdminTab; label: string; Icon: typeof BarChart3 }[] = [
    { id: 'stats',    label: 'Stats',    Icon: BarChart3 },
    { id: 'messages', label: 'Messages', Icon: Mail      },
    { id: 'users',    label: 'Users',    Icon: Users     },
  ]

  return (
    <main className="max-w-4xl mx-auto px-4 py-8 pb-24 space-y-6">
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/settings')}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Return to Field Kit"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="font-serif text-2xl font-medium">Administration</h1>
          <p className="font-mono text-[10px] tracking-[2px] text-muted-foreground">
            CABINET CURATOR DASHBOARD
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={[
              'flex items-center gap-1.5 px-4 py-2.5 font-mono text-[10px] tracking-widest border-b-2 transition-colors',
              activeTab === id
                ? 'border-foreground text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            ].join(' ')}
          >
            <Icon className="h-3.5 w-3.5" />
            {label.toUpperCase()}
          </button>
        ))}
      </div>

      {activeTab === 'stats'    && <StatsTab />}
      {activeTab === 'messages' && <MessagesTab />}
      {activeTab === 'users'    && <UsersTab />}
    </main>
  )
}

// ── Stats tab ─────────────────────────────────────────────────────────────────

function StatsTab() {
  const { data: stats, isLoading } = useAdminStats()

  const statCards = stats
    ? [
        { label: 'Total naturalists', value: stats.total_users },
        { label: 'Collectors', value: stats.users_with_specimens },
        { label: 'Unique species', value: stats.unique_specimens },
        { label: 'Total discoveries', value: stats.total_discoveries },
        { label: 'Field notes generated', value: stats.total_field_notes },
        { label: 'Contact submissions', value: stats.contact_submissions },
      ]
    : []

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-card border rounded-sm p-4 space-y-1 animate-pulse">
              <div className="h-6 w-16 bg-muted rounded" />
              <div className="h-3 w-24 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {statCards.map(({ label, value }) => (
            <div key={label} className="bg-card border rounded-sm p-4">
              <p className="font-serif text-2xl font-medium">{value.toLocaleString()}</p>
              <p className="font-mono text-[9px] tracking-wider text-muted-foreground mt-0.5">
                {label.toUpperCase()}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="bg-card border rounded-sm p-4 space-y-2">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="font-mono text-[9px] tracking-[2px] text-muted-foreground uppercase">
            Visitor Analytics
          </p>
        </div>
        <p className="font-serif text-xs leading-relaxed text-muted-foreground">
          Page views and visitor analytics are provided by Cloudflare Web Analytics.
        </p>
        <p className="font-mono text-[9px] tracking-wider text-muted-foreground/60">
          CLOUDFLARE DASHBOARD → ANALYTICS & LOGS → WEB ANALYTICS
        </p>
      </div>
    </div>
  )
}

// ── Messages tab ──────────────────────────────────────────────────────────────

function MessagesTab() {
  const { data: messages, isLoading } = useAdminMessages()
  const markRead = useMarkMessageRead()

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-sm" />)}
      </div>
    )
  }

  if (!messages?.length) {
    return (
      <div className="bg-card border rounded-sm p-6 text-center">
        <p className="font-serif text-sm text-muted-foreground italic">
          No correspondence received yet.
        </p>
      </div>
    )
  }

  const unreadCount = messages.filter((m) => !m.read).length

  return (
    <div className="space-y-3">
      {unreadCount > 0 && (
        <p className="font-mono text-[10px] tracking-wider text-muted-foreground">
          {unreadCount} UNREAD MESSAGE{unreadCount !== 1 ? 'S' : ''}
        </p>
      )}

      <div className="divide-y border rounded-sm bg-card">
        {messages.map((msg: ContactMessage) => (
          <MessageRow key={msg.id} message={msg} onMarkRead={() => markRead.mutate(msg.id)} />
        ))}
      </div>
    </div>
  )
}

function MessageRow({ message, onMarkRead }: { message: ContactMessage; onMarkRead: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const date = new Date(message.created_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className={`p-4 space-y-2 ${!message.read ? 'bg-muted/20' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {!message.read && (
              <span className="font-mono text-[8px] tracking-wider text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-sm">
                UNREAD
              </span>
            )}
            <p className="font-mono text-xs font-medium">{message.sender_email}</p>
            {message.sender_name && (
              <p className="font-serif text-xs text-muted-foreground">— {message.sender_name}</p>
            )}
          </div>
          <p className="font-mono text-[9px] text-muted-foreground mt-0.5">{date}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {!message.read && (
            <button
              onClick={onMarkRead}
              className="text-muted-foreground hover:text-foreground transition-colors p-1"
              title="Mark as read"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="font-mono text-[9px] tracking-wider text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? 'COLLAPSE' : 'EXPAND'}
          </button>
        </div>
      </div>

      {expanded && (
        <p className="font-serif text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap border-t pt-2 mt-2">
          {message.message}
        </p>
      )}
      {!expanded && (
        <p className="font-serif text-xs text-muted-foreground truncate">{message.message}</p>
      )}
    </div>
  )
}

// ── Users tab ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const { data: users, isLoading } = useAdminUsers()
  const [search, setSearch] = useState('')

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-sm" />)}
      </div>
    )
  }

  const filtered = (users ?? []).filter(
    (u) =>
      !search ||
      u.email.toLowerCase().includes(search.toLowerCase()) ||
      (u.display_name ?? '').toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search by email or name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="font-mono text-xs max-w-xs"
        />
        <p className="font-mono text-[9px] tracking-wider text-muted-foreground">
          {filtered.length} USER{filtered.length !== 1 ? 'S' : ''}
        </p>
      </div>

      <div className="divide-y border rounded-sm bg-card">
        {filtered.map((user: AdminUser) => (
          <UserRow key={user.user_id} user={user} />
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="font-serif text-sm text-muted-foreground text-center py-6">
          No users match the search.
        </p>
      )}
    </div>
  )
}

function UserRow({ user }: { user: AdminUser }) {
  const gdprExport = useGdprExport()
  const gdprDelete = useGdprDelete()
  const [deleteConfirm, setDeleteConfirm] = useState('')

  const handleExport = async () => {
    try {
      const data = await gdprExport.mutateAsync(user.user_id)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `user-data-${user.user_id.slice(0, 8)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Export failed.')
    }
  }

  const handleDelete = async () => {
    try {
      await gdprDelete.mutateAsync(user.user_id)
      toast.success('User data deleted.')
    } catch {
      toast.error('Delete failed.')
    }
  }

  const date = new Date(user.created_at).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div className="p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-mono text-xs">{user.email}</p>
            {user.is_admin && (
              <span className="font-mono text-[8px] tracking-wider text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-sm">
                ADMIN
              </span>
            )}
          </div>
          {user.display_name && (
            <p className="font-serif text-xs text-muted-foreground mt-0.5">{user.display_name}</p>
          )}
          <p className="font-mono text-[9px] text-muted-foreground mt-0.5">
            {user.creature_count} specimens · joined {date}
          </p>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleExport}
            disabled={gdprExport.isPending}
            className="h-7 px-2 font-mono text-[9px] tracking-wider gap-1.5"
            title="Export user data"
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 font-mono text-[9px] tracking-wider gap-1.5 text-destructive hover:text-destructive"
                title="Delete user data"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="font-serif">Delete user data?</AlertDialogTitle>
                <AlertDialogDescription className="font-serif space-y-2">
                  <span className="block">
                    This will permanently delete all data for{' '}
                    <strong>{user.email}</strong> — profile, specimens, badges, and activity. This
                    cannot be undone.
                  </span>
                  <span className="block">
                    Type <strong>DELETE USER DATA</strong> to confirm.
                  </span>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <Input
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE USER DATA"
                className="font-mono text-xs"
              />
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeleteConfirm('')} className="font-mono text-xs tracking-wider">
                  CANCEL
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={deleteConfirm !== 'DELETE USER DATA' || gdprDelete.isPending}
                  className="font-mono text-xs tracking-wider bg-destructive hover:bg-destructive/90"
                >
                  DELETE
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  )
}
