// ABOUT: Profile page — shows account details and sign-out option
// ABOUT: Placeholder for Phase 6; stats and settings arrive later
import { Button } from '@/components/ui/button'
import type { UseAuthReturn } from '@/hooks/useAuth'

interface ProfilePageProps {
  email: string
  signOut: UseAuthReturn['signOut']
}

export function ProfilePage({ email, signOut }: ProfilePageProps) {
  return (
    <main className="flex flex-col items-center justify-center p-6 pt-12 gap-4">
      <h1 className="font-serif text-2xl">Your Field Journal</h1>
      <p className="text-sm text-muted-foreground">{email}</p>
      <Button variant="outline" onClick={signOut}>
        Sign out
      </Button>
    </main>
  )
}
