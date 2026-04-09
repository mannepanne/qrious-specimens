// ABOUT: Bottom navigation tab bar — switches between main app sections
// ABOUT: Accepts activeTab prop and onTabChange callback; renders 4 primary tabs
import { ScanLine, BookOpen, Users, User } from 'lucide-react'
import { cn } from '@/lib/utils'

export type Tab = 'scan' | 'cabinet' | 'community' | 'profile'

interface TabBarProps {
  activeTab: Tab
  onTabChange: (tab: Tab) => void
}

const TABS: { id: Tab; label: string; Icon: React.FC<React.SVGProps<SVGSVGElement>> }[] = [
  { id: 'scan',      label: 'Scan',      Icon: ScanLine },
  { id: 'cabinet',   label: 'Cabinet',   Icon: BookOpen },
  { id: 'community', label: 'Community', Icon: Users },
  { id: 'profile',   label: 'Profile',   Icon: User },
]

export function TabBar({ activeTab, onTabChange }: TabBarProps) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background"
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
