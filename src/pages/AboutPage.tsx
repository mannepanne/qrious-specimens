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
          Here is a truth that most people have forgotten, or perhaps never knew: the world is full
          of invisible things. Not ghosts. Not dark matter. In the QR codes. They are everywhere — stuck to
          lampposts, printed on menus, hiding on the backs of name badges — and almost nobody looks
          at them twice.
        </p>

        <p>We thought that was a waste.</p>

        <p>
          QRious Specimens is what happens when you point a curious eye at the ordinary. Every QR
          code you scan generates a unique creature — something that has never existed before and
          never will again. Not randomly, mind you. The code itself determines the creature. Its
          patterns become anatomy. Its data becomes DNA. The same QR code will always produce the
          same specimen, which means these things are out there, right now, waiting on every café
          table and bus shelter and conference lanyard, and they have been this whole time.
        </p>

        <p>You just didn't have the means to discover them.</p>

        <p>
          Some specimens are common — the kind of thing you'd find stuck to every third parking
          meter. Others are rare, seen by only a handful of collectors. A few have been discovered
          by exactly one person, and if that person is you, well. The creature remembers. You'll
          know when it happens.
        </p>

        <p>
          There is no point to this, in the way that there is no point to pressing your face against
          the glass of a rock pool or opening a drawer in a museum you've never visited before. It
          is not productive. It will not improve your quarterly metrics. What it might do, on a good
          day, is make you look at a small square of black and white nonsense on a telephone pole
          and feel, for just a moment, the curious pull of wondering what's inside.
        </p>

        <p>
          That's the whole thing, really. Your cabinet awaits. The specimens will not find
          themselves.{' '}
          <Link to="/enter" className="underline underline-offset-4 hover:text-muted-foreground transition-colors">
            Go explore!
          </Link>
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
