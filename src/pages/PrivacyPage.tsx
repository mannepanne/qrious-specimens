// ABOUT: Privacy policy page — data handling, GDPR rights, contact
// ABOUT: Personal project policy; no commercial data use

import { Link } from 'react-router-dom'

export function PrivacyPage() {
  return (
    <main className="px-4 pt-6 pb-10 max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-medium">Privacy policy</h1>
        <p className="font-mono text-[10px] tracking-[2px] text-muted-foreground mt-1">
          LAST UPDATED · 4 MAY 2026
        </p>
      </div>

      {/* Sections */}
      <div className="space-y-8 font-serif text-base leading-relaxed">

        <section className="space-y-2">
          <h2 className="font-serif text-lg font-medium">Who we are</h2>
          <p>
            QRious Specimens is a personal project — a digital cabinet of curiosities built for the
            pure joy of exploration and generative discovery. It is not a commercial product. There
            is no company behind it, no marketing department, and no interest in monetising your data.
          </p>
          <p>
            The site has gentle gamification — your Explorer Rank, badges, the Gazette — and we
            intend to develop that further over time. The principle we work to is simple: collect
            the minimum personal information needed to make any of it work, and nothing else.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-lg font-medium">What data we collect and why</h2>

          <div className="space-y-1">
            <h3 className="font-serif text-base font-medium italic">Email address</h3>
            <p>
              When you create an account, we collect your email address. We use it to send you a
              one-time magic link to sign in (we do not use passwords, so there is nothing to
              recover or reset) and for service-related communications such as important changes to
              the platform, security notices, or updates to these terms. We may also contact you on
              a one-off basis to invite you to opt in to occasional updates or newsletters, but you
              will never be subscribed to any mailing list without your explicit consent. Your email
              will never be shared with any third party for any reason.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="font-serif text-base font-medium italic">Your specimens</h3>
            <p>
              When you scan a QR code, we store the generated creature data (its traits,
              illustration, and field notes) so your cabinet persists across sessions and devices.
              We do not store the original QR code content — only a one-way hash used for
              deduplication.
            </p>
          </div>

          <div className="space-y-1">
            <h3 className="font-serif text-base font-medium italic">Page navigation (signed-in users)</h3>
            <p>
              When you are signed in, we record which routes within the site you visit (for
              example, <span className="font-mono text-sm">/catalogue</span>,{' '}
              <span className="font-mono text-sm">/specimen/...</span>) along with a session
              identifier and a timestamp. This is the minimum signal we need to calculate your
              Explorer Rank — your activity, days active, and account age all factor into the rank
              score. We do not record the contents of any page, your interactions within a page,
              or anything beyond the route name itself. Visits while signed out are recorded only
              as a route and an anonymous session identifier — no account is associated with them.
            </p>
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif text-lg font-medium">Aggregate analytics</h2>
          <p>
            We use a privacy-friendly analytics tool (Cloudflare Web Analytics) to understand basic
            traffic patterns such as page views and visit counts. This data is aggregated and
            anonymous — it is not linked to your account, email, or any personal information.
            Cloudflare Web Analytics is cookieless and does not perform cross-site tracking. We do
            not use tracking pixels, advertising trackers, or any form of device fingerprinting.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif text-lg font-medium">Third-party services we use</h2>
          <p>
            To deliver the experience of QRious Specimens we rely on a small number of third-party
            services. Supabase, as our database and authentication provider, holds the data
            described above (including your email address). The remaining services receive only
            what is described in the relevant section below — none of them is sent your email
            address.
          </p>
          <ul className="space-y-2 ml-4">
            <li className="flex gap-2">
              <span className="shrink-0 text-muted-foreground">—</span>
              <span>
                <span className="font-medium">Supabase</span> (our database and authentication
                provider) — stores your account, your specimens, and the page navigation events
                described above. Encryption at rest and in transit is provided by Supabase. Our
                Supabase project is hosted in Ireland (AWS{' '}
                <span className="font-mono text-sm">eu-west-1</span>).
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-muted-foreground">—</span>
              <span>
                <span className="font-medium">Cloudflare Workers, Pages, and Images</span> —
                hosting and image storage. Your specimen illustrations are served from Cloudflare's
                global image delivery network.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-muted-foreground">—</span>
              <span>
                <span className="font-medium">Google Gemini</span> — when a new specimen is
                discovered, the creature's traits (a structured description derived from the QR
                code's hash, with no personal information attached) are sent to Google's Gemini API
                to generate the Victorian-style illustration. The illustration is then stored on
                Cloudflare Images.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-muted-foreground">—</span>
              <span>
                <span className="font-medium">Anthropic Claude</span> — the same trait description
                is sent to Anthropic's Claude API to generate the field notes that accompany each
                specimen. Again, no personal information is included.
              </span>
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif text-lg font-medium">Cookies and local storage</h2>
          <p>
            We do not set any tracking or advertising cookies. Your sign-in session is kept in your
            browser's <span className="font-mono text-sm">localStorage</span> (not a cookie), and a
            short-lived session identifier used for the page navigation events above is kept in{' '}
            <span className="font-mono text-sm">sessionStorage</span> (which is cleared when you
            close the browser tab). Cloudflare Web Analytics is cookieless. No cross-site tracking
            takes place.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif text-lg font-medium">How long we keep your data</h2>
          <p>
            We keep your account data — including your email, your specimens, and your page
            navigation events — for as long as your account exists. If you delete your account, we
            remove your profile, your specimens, your badges, and your activity. Your page
            navigation events are de-identified — the link to your account is severed, but the
            underlying analytics records are kept. Your sign-in record (which holds your email
            address) is removed in a separate administrative step shortly after deletion.
          </p>
          <p>
            The species themselves — their taxonomy, illustrations, and field notes — are
            deterministically generated from QR codes and form part of the shared catalogue. These
            are retained so that other explorers who discover the same species are unaffected. Where
            you were the first discoverer of a species, your name is removed from the public record,
            but the species and its discovery date are kept.
          </p>
          <p className="text-sm text-muted-foreground">
            One further exception: if you have previously written to us via the contact form, those
            messages may be retained as a record of our correspondence — a legitimate interest in
            demonstrating that we received and acted on what you wrote (GDPR Article 17(3)).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif text-lg font-medium">International transfers</h2>
          <p>
            Our Supabase database is hosted in Ireland (within the European Economic Area).
            Cloudflare, our hosting and image delivery provider, is a US-headquartered company
            operating globally — your specimen illustrations may be served from edge locations
            close to you, and Cloudflare operates under standard contractual clauses for
            international transfers. The AI services we use (Google Gemini and Anthropic Claude)
            are also operated by US-based providers; calls to these services may transfer the
            trait description outside the EEA. These providers operate under their own privacy
            commitments and rely on standard contractual clauses for international transfers where
            applicable.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-lg font-medium">Your rights</h2>
          <p>You have the right to:</p>
          <ul className="space-y-2 ml-4">
            <li className="flex gap-2">
              <span className="shrink-0 text-muted-foreground">—</span>
              <span>
                <span className="font-medium">Export your data</span> — request a full copy of
                everything we hold about you
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-muted-foreground">—</span>
              <span>
                <span className="font-medium">Delete your account</span> — request removal of your
                profile, your specimens, your badges, and your activity, plus de-identification of
                your page navigation events. Shared species data (taxonomy, illustrations, field
                notes) is retained as described under "How long we keep your data" above
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-muted-foreground">—</span>
              <span>
                <span className="font-medium">Correct your data</span> — request correction of your
                account details
              </span>
            </li>
          </ul>
          <p>
            To exercise any of these rights, contact us using the form below.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="font-serif text-lg font-medium">Children</h2>
          <p>
            QRious Specimens isn't directed specifically at children, though its themes —
            creatures, scanning, illustrated cabinets — may well appeal to younger naturalists. The
            site is deliberately small in what it collects and what it exposes:
          </p>
          <ul className="space-y-2 ml-4">
            <li className="flex gap-2">
              <span className="shrink-0 text-muted-foreground">—</span>
              <span>
                Sign-in is by magic link to an email address. Your email is never shown to other
                users.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-muted-foreground">—</span>
              <span>
                On the site you appear under an auto-generated explorer name like{' '}
                <span className="italic">M. Anning</span> — never your real name or your email.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-muted-foreground">—</span>
              <span>
                There is no chat, no comments, no direct messaging — no way for users to contact
                each other through the platform.
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-muted-foreground">—</span>
              <span>
                Aggregate analytics are anonymous and not linked to your account.
              </span>
            </li>
          </ul>
          <p>
            Given this, the privacy risks are kept low. Saying that, if you are a parent or
            guardian and would prefer your child's account be removed, contact us and we will do so
            promptly.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif text-lg font-medium">Advertising</h2>
          <p>
            We may in the future display simple advertisements to help support the running costs of
            this project. If we do, these will be contextual and non-personalised — they will never
            be targeted based on your account data, email address, browsing history, or specimen
            collection. We will not share any personal information with advertisers.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif text-lg font-medium">Changes to this policy</h2>
          <p>
            Given the limited scope of data collection, we do not anticipate significant changes to
            this policy. If changes are made, the updated date above will be revised.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif text-lg font-medium">Contact</h2>
          <p>
            If you have any questions about this policy or your data, please{' '}
            <Link
              to="/contact"
              className="underline underline-offset-4 hover:text-muted-foreground transition-colors"
            >
              get in touch via our contact form
            </Link>
            .
          </p>
        </section>

      </div>
    </main>
  )
}
