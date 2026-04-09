// ABOUT: Cabinet page — the authenticated naturalist's personal specimen collection
// ABOUT: Placeholder for Phase 3; sign-out lives here until JournalNav is built
import { Button } from '@/components/ui/button'
import type { UseAuthReturn } from '@/hooks/useAuth'

interface CabinetPageProps {
  email: string
  signOut: UseAuthReturn['signOut']
}

export function CabinetPage({ email, signOut }: CabinetPageProps) {
  return (
    <main className="flex flex-col items-center justify-center p-6 pt-12 gap-6">
      <div className="text-center space-y-2">
        <h1 className="font-serif text-2xl">The Cabinet of Curiosities</h1>
        <p className="text-muted-foreground text-sm">
          Your collected specimens will be catalogued here.
        </p>
      </div>

      {/* Temporary auth controls — will move to JournalNav in Phase 2.5 */}
      <div className="flex flex-col items-center gap-2 text-center">
        <p className="text-xs text-muted-foreground font-mono">{email}</p>
        <Button variant="outline" size="sm" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </main>
  )
}
