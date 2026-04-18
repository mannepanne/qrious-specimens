// ABOUT: Contact page — correspondence form for reaching the cabinet curators
// ABOUT: Form with CAPTCHA not yet implemented; placeholder shown in the meantime

export function ContactPage() {
  return (
    <main className="px-4 pt-6 pb-10 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-serif text-3xl font-medium">Contact</h1>
        <p className="font-mono text-[10px] tracking-[2px] text-muted-foreground mt-1">
          CORRESPONDENCE DESK
        </p>
      </div>

      <p className="font-serif text-base leading-relaxed">
        The correspondence form is currently being prepared. In the meantime, if you have a
        question or concern — particularly regarding your data or account — please check the{' '}
        <span className="italic">Settings</span> page, where account management tools are available.
      </p>
    </main>
  )
}
