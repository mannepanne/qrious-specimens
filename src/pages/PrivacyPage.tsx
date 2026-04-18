// ABOUT: Privacy policy page — data handling, GDPR rights, contact
// ABOUT: Personal project policy; no commercial data use

import { Link } from 'react-router-dom'

export function PrivacyPage() {
  return (
    <main className="px-4 pt-6 pb-10 max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-serif text-3xl font-medium">Privacy Policy</h1>
        <p className="font-mono text-[10px] tracking-[2px] text-muted-foreground mt-1">
          LAST UPDATED · 5 APRIL 2026
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
        </section>

        <section className="space-y-4">
          <h2 className="font-serif text-lg font-medium">What data we collect and why</h2>

          <div className="space-y-1">
            <h3 className="font-serif text-base font-medium italic">Email address</h3>
            <p>
              When you create an account, we collect your email address. This is used primarily for
              authentication (signing in and password recovery) and for service-related
              communications — such as important changes to the platform, security notices, or
              updates to these terms. We may also contact you on a one-off basis to invite you to
              opt in to occasional updates or newsletters, but you will never be subscribed to any
              mailing list without your explicit consent. Your email will never be shared with any
              third party for any reason.
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
        </section>

        <section className="space-y-2">
          <h2 className="font-serif text-lg font-medium">What we do not collect</h2>
          <p>
            We use a simple, privacy-friendly analytics tool (Cloudflare Web Analytics) to
            understand basic traffic patterns (e.g. page views and visit counts). This data is
            aggregated and anonymous — it is not linked to your account, email, or any personal
            information. We do not use tracking pixels or any form of cross-site tracking. We do not
            collect your location, device fingerprint, or browsing habits beyond this site.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="font-serif text-lg font-medium">How your data is stored</h2>
          <p>
            Your data is stored securely using Supabase, which provides encryption at rest and in
            transit. Authentication is handled through industry-standard protocols. Your password is
            never stored in plain text.
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
                of your account and all associated data, including specimens, illustrations, and
                field notes
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
          <h2 className="font-serif text-lg font-medium">Cookies and tracking</h2>
          <p>
            We use only essential cookies required for authentication (keeping you signed in). Our
            analytics tool may use a simple cookie to distinguish unique visits, but it does not
            track you across other sites. We do not use personalised advertising cookies or any form
            of cross-site tracking.
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
