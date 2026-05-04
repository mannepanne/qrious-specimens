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
              or anything beyond the route name itself. Anonymous (signed-out) visits are not
              stored against any account.
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
            services. None of them are sent your email address or any directly identifying
            information beyond what is described above.
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
            navigation events — for as long as your account exists. If you delete your account, all
            associated data is removed (with the limited exception of any prior contact-form
            messages, described under "Your rights" below).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif text-lg font-medium">International transfers</h2>
          <p>
            Our Supabase database is hosted in Ireland (within the European Economic Area).
            Cloudflare's services are global, and your specimen illustrations may be served from
            edge locations close to you. The AI services we use (Google Gemini and Anthropic
            Claude) are operated by US-based providers; calls to these services may therefore
            transfer the trait description outside the EEA. These providers operate under their
            own privacy commitments and rely on standard contractual clauses for international
            transfers where applicable.
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
                <span className="font-medium">Delete your account</span> — request complete removal
                of your account and all associated data, including specimens, illustrations, field
                notes, and page navigation events
              </span>
            </li>
            <li className="flex gap-2">
              <span className="shrink-0 text-muted-foreground">—</span>
              <span>
                <span className="font-medium">Correct your data</span> — update your email address
                or other account details
              </span>
            </li>
          </ul>
          <p>
            To exercise any of these rights, use the account settings within the app or contact us
            at the address below.
          </p>
          <p className="text-sm text-muted-foreground">
            One small exception: if you have previously written to us via the contact form, those
            messages may be retained as a record of our correspondence — a legitimate interest in
            demonstrating that we received and acted on what you wrote (GDPR Article 17(3)).
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif text-lg font-medium">Children</h2>
          <p>
            QRious Specimens is not specifically directed to children, but we recognise that its
            themes — creatures, scanning, illustrated cabinets — may appeal to younger naturalists.
            Account creation is intended for users aged 13 or over. If you are under 13, please use
            the site under an account managed by a parent or guardian. If we become aware that a
            child has registered an account without parental involvement, we will remove the
            account and any associated data.
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
