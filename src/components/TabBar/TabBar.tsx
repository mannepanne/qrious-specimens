// ABOUT: Bottom navigation tab bar — switches between the three primary app destinations
// ABOUT: Hidden when an overlay (scanner, hatching, specimen) is open; safe-area aware
import type { LucideIcon } from 'lucide-react'
import { LayoutGrid, Newspaper, BookOpen } from 'lucide-react'
import { cn } from '@/lib/utils'

// The three primary destinations. Scanner, hatching, and specimen are overlays — not tabs.
export type Tab = 'catalogue' | 'gazette' | 'cabinet'

// Overlay and Subpage types are defined here as the canonical navigation reference.
// Overlays suppress the tab bar and render full-screen (scanner, hatching, specimen).
// Subpages render within the tab context with the tab bar visible (about, settings, etc.).
export type Overlay = 'scanner' | 'hatching' | 'specimen' | null
export type Subpage = 'about' | 'privacy' | 'contact' | 'settings' | 'admin' | null

interface TabBarProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
  /** Pass true when an overlay is open — hides the tab bar from view */
  hidden?: boolean
}

const TABS: { id: Tab; label: string; Icon: LucideIcon }[] = [
  { id: 'catalogue', label: 'Catalogue', Icon: LayoutGrid },
  { id: 'gazette',   label: 'Gazette',   Icon: Newspaper },
  { id: 'cabinet',   label: 'Cabinet',   Icon: BookOpen },
]

export function TabBar({ activeTab, onTabChange, hidden = false }: TabBarProps) {
  if (hidden) return null

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
      aria-label="Main navigation"
    >
      <div className="flex">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            onClick={() => onTabChange(id)}
            className={cn(
              'flex flex-1 flex-col items-center gap-1 py-2 text-xs transition-colors',
              activeTab === id
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
            aria-current={activeTab === id ? 'page' : undefined}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </nav>
  )
}
