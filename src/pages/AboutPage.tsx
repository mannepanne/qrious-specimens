// ABOUT: About page — project background, what QRious Specimens is and why it exists
// ABOUT: Standalone content page; no auth required

import { Link } from 'react-router-dom'

export function AboutPage() {
  return (
    <main className="px-4 pt-6 pb-10 max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-medium">QRious Specimens</h1>
        <p className="font-mono text-[10px] tracking-[2px] text-muted-foreground mt-1">
          A DIGITAL CABINET OF CURIOSITIES
        </p>
      </div>

      {/* Body */}
      <div className="space-y-4 font-serif text-base leading-relaxed">
        <p>
          Here is a truth that most people have never quite noticed, though it has been sitting in
          plain sight all along: the world is full of invisible things. Not ghosts. Not dark matter.
          QR codes. They are everywhere — stuck to lampposts, printed on menus, hiding on the backs
          of name badges — and almost nobody looks at them twice.
        </p>

        <p>That felt like such a waste.</p>

        <p>
          QRious Specimens is what happens when you point a curious eye at the ordinary. Every QR
          code you scan generates a unique creature — a species the world has never met, seeded by
          that exact code and no other. Not randomly, mind you. The code itself determines the
          creature. Its patterns become anatomy. Its data becomes DNA. The same QR code will always
          produce the same specimen, which means these things are out there, right now, waiting on
          every café table and bus shelter and conference lanyard, and they have been this whole
          time.
        </p>

        <p>You just didn't have the means to discover them.</p>

        <p>
          Some specimens are common — the kind of thing slapped on the back of every restaurant
          menu since 2020. Others are rare, seen by only a handful of collectors. A few have been
          discovered by exactly one person, and if that person is you, well. The creature remembers.
          You'll know when it happens.
        </p>

        <p>
          There is no point to this, in the way that there is no point to crouching over a rock
          pool, or opening a drawer in a museum you've never visited before. It is not productive.
          It will not improve your quarterly metrics. What it might do, on a good day, is make you
          look at a small square of black and white nonsense on a lamppost and feel, for just a
          moment, the curious pull of wondering what's inside.
        </p>

        <p>
          That's the whole thing, really. Your cabinet awaits. The specimens will not find
          themselves.{' '}
          <Link to="/enter" className="underline underline-offset-4 hover:text-muted-foreground transition-colors">
            Off you go.
          </Link>
        </p>
      </div>

      {/* Mary Anning section */}
      <div className="border-t pt-6 space-y-4 font-serif text-base leading-relaxed">
        <h2 className="font-mono text-[10px] tracking-[2px] text-muted-foreground uppercase">
          A debt acknowledged
        </h2>

        <p>
          This project takes its spirit from{' '}
          <a
            href="https://en.wikipedia.org/wiki/Mary_Anning"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-4 hover:text-muted-foreground transition-colors"
          >
            Mary Anning
          </a>{' '}
          (1799–1847), the fossil hunter of Lyme Regis who spent decades walking the Jurassic Coast
          of Dorset after storms, finding creatures the world had walked past for centuries.
        </p>

        <p>
          She could not afford a formal education. She was not a fellow of any learned society. She
          was a working-class woman in Regency England — and she found the first ichthyosaur, the
          first plesiosaur, the first pterosaur ever properly documented in Britain. Specimens that
          rewrote what scientists understood about the history of life on Earth.
        </p>

        <p>
          She was paid for the specimens. Geologists wrote to her, visited her, learned from her —
          and barred her from their society because she was a woman.
        </p>

        <p>
          Her real legacy is not only the fossils, though the fossils rewrote a science. It is also
          the disposition. To walk a known beach a thousand times and look again the thousand-and-first;
          to trust that the world is full of things no one has thought to look for; to keep wanting,
          against the grain, to understand. Anyone who carries even a fragment of that disposition
          through life — who asks one more question than is expected, who looks once more at the
          unremarkable — owes her a small debt.
        </p>

        <p className="italic text-muted-foreground">
          The geological vocabulary you've been reading — strata, specimens, cabinet — is her
          vocabulary. With any luck, a little of the wonder of finding came along with them.
        </p>
      </div>

      {/* Catalogue CTA */}
      <div className="pt-2 text-center">
        <Link
          to="/catalogue"
          className="font-mono text-sm tracking-widest text-muted-foreground hover:text-foreground transition-colors"
        >
          BROWSE THE CATALOGUE →
        </Link>
      </div>
    </main>
  )
}
