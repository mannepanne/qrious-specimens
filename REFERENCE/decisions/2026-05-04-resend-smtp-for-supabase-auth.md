# ADR: Route Supabase Auth emails through Resend SMTP

**Date:** 2026-05-04
**Status:** Active
**Supersedes:** N/A

---

## Decision

Supabase Auth's transactional emails (signup confirmation, magic link) are sent via Resend's SMTP relay, configured under Supabase's Custom SMTP settings, instead of Supabase's built-in mailer. The sender address is `gazette@hultberg.org` with display name `QRious Specimens`.

## Context

Supabase ships with a built-in email service intended for development only. Its undocumented-but-observable rate limit is in the order of three to four emails per hour per project. During iteration on the auth email templates this limit was hit, surfaced to the end user as the friendly *"Too many dispatches in a short time"* message that `useAuth.ts` maps from any error containing `rate limit`.

A working Resend integration already exists in the project: the `RESEND_API_KEY` Worker secret is set, `hultberg.org` is verified as a sending domain in Resend, and the Cloudflare Worker (`src/worker.ts`) calls Resend's HTTP API to send admin notifications when a contact-form message is submitted. Supabase Auth, however, cannot consume that HTTP API — it speaks SMTP only. The decision is whether to wire SMTP up at all, and if so, to which provider.

## Alternatives considered

- **Remain on the Supabase built-in mailer.**
  - Why not: Three-to-four-per-hour is incompatible with realistic onboarding and template iteration. Production sign-ups would silently fail under any moderate burst (a single shared QR code on a busy day, a small launch wave). This is also the explicitly-discouraged path in Supabase's own documentation.

- **Adopt a different SMTP provider (SendGrid, Postmark, Mailgun, AWS SES).**
  - Why not: Each requires a new account, a new domain verification dance, a new set of credentials to rotate, and another vendor in the dependency surface. There is no functional gain over Resend for transactional volume at this scale.

- **Run our own SMTP relay (e.g. on Cloudflare or Fly).**
  - Why not: Operating an outbound SMTP relay in good standing — IP warm-up, SPF/DKIM/DMARC, deliverability monitoring, abuse handling — is a project in its own right. Wildly disproportionate to the problem.

- **Chosen — Use Resend's SMTP relay with the existing account and verified domain.**
  - Why this won: Reuses infrastructure that already exists, requires no new vendor, raises the limit from ~4/hour to 3000/day, and unlocks a branded sender address on `hultberg.org`.

## Reasoning

**The existing Resend account already covers the hard parts.** Domain verification, DKIM records, abuse standing — all of these are sunk cost. Switching to Resend SMTP is a configuration change in the Supabase dashboard, not an integration project.

**SMTP and the HTTP API can share an API key.** Resend's SMTP relay accepts the literal username `resend` with any valid API key as the password. We can either reuse the existing Worker key or create a second key scoped to SMTP for independent rotation. Both work; rotation hygiene is the only difference.

**Branded sender addresses meaningfully reinforce the product voice.** Supabase's built-in mailer sends from `noreply@mail.app.supabase.io`, which lands in the inbox listing as a generic Supabase-branded From line. Sending from `QRious Specimens <gazette@hultberg.org>` keeps the Victorian-newspaper framing consistent from inbox preview through to email body — the email is the first thing a new user sees, and the From line shows up before the subject does.

**The dependency footprint is honest.** We are already depending on Resend for the contact-form admin notification; routing auth through the same provider does not add a new vendor, it consolidates onto one. Separate vendors would have given the illusion of redundancy without the reality of it (auth emails being undeliverable is a sign-in outage regardless of whether contact-form notifications still work).

## Trade-offs accepted

**Resend becomes a single point of failure for outbound mail.** If Resend is down, both auth emails and contact-form admin notifications fail. The user-facing impact is sign-in being unavailable for the duration. Mitigation: Resend's status is monitored externally and Supabase's auth settings can be reverted to the built-in mailer in a few clicks if a sustained outage occurs.

**Two integration paths to the same vendor.** Contact-form emails go through Resend's HTTP API (in our Worker), auth emails go through Resend's SMTP relay (in Supabase). This is intentional — the Supabase-managed path cannot use HTTP, and rewriting auth emails to flow through our Worker would require taking over Supabase's auth template system, which is far more disruptive than accepting two paths.

**SMTP credentials live in the Supabase dashboard, not in version control.** This matches how every other Supabase auth setting is managed and is documented in `REFERENCE/environment-setup.md`. The credential is rotateable independently of code.

**Supabase still rate-limits its own auth endpoints.** Switching the SMTP backend lifts the *delivery* limit but does not change Supabase's per-IP / per-email request-side throttles on `signInWithOtp` and friends. The friendly "too many dispatches" message can still surface under aggressive testing, just much less easily.

## Implications

**Enables:**
- Realistic email-template iteration without burning the per-hour quota
- Production-grade transactional volume for sign-ups (3000/day on Resend's free tier)
- A branded From address that reinforces the product voice
- Future template work — for example, adding `Reply-To: contact@hultberg.org` so users replying to a sign-in email reach a real inbox

**Prevents / makes harder:**
- Switching email vendors casually — the sender address, From-name, and SMTP credential all live in Supabase's dashboard, not in code, so a vendor change is a manual operation
- Local-development email testing without internet access to Resend (acceptable; the dev flow has always required network)

## Implementation notes

The dashboard change happens in **Supabase → Project Settings → Auth → SMTP Settings → Enable Custom SMTP** with these values:

- **Host:** `smtp.resend.com`
- **Port:** `587`
- **Username:** `resend`
- **Password:** the existing `RESEND_API_KEY` value (or a fresh, SMTP-scoped Resend key if independent rotation is wanted)
- **Sender email:** `gazette@hultberg.org`
- **Sender name:** `QRious Specimens`

Verification is the **Send Test Email** button in the same panel, followed by an actual sign-in attempt against the live app once the test passes.

## Follow-ups

- Update `REFERENCE/environment-setup.md` to describe the new email path (Supabase Auth → Resend SMTP) alongside the existing contact-form path (Worker → Resend HTTP API)
- If the existing `RESEND_API_KEY` is reused, no secret changes are needed; if a new SMTP-scoped key is created, document its location and rotation cadence

---

## References

- [`REFERENCE/environment-setup.md`](../environment-setup.md) — Resend account configuration and Worker secrets
- [`src/worker.ts`](../../src/worker.ts) — existing Resend HTTP API integration (contact-form notifications)
- [`src/hooks/useAuth.ts`](../../src/hooks/useAuth.ts) — `friendlyAuthMessage` mapping that surfaced the rate-limit symptom
- Resend SMTP documentation: `resend.com/docs/send-with-smtp`
- Supabase Auth Custom SMTP documentation: `supabase.com/docs/guides/auth/auth-smtp`
