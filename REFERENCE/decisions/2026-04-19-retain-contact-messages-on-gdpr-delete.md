# ADR: Retain contact messages when processing a GDPR erasure request

**Date:** 2026-04-19
**Status:** Active
**Supersedes:** N/A

---

## Decision

When `admin_delete_user_data()` is called to process a GDPR right-to-erasure request, contact messages submitted via the /contact form are deliberately NOT deleted, even if the sender's email matches the user being erased.

## Context

Phase 8 introduced a GDPR erasure tool in the admin dashboard. During the PR review a question arose: should `contact_messages` be deleted as part of a user data erasure? The messages contain `sender_email`, which is personal data, so there is a reasonable argument for deletion. However, the messages represent inbound correspondence *to the organisation*, not outbound user-generated content *owned by the user*.

## Alternatives considered

- **Delete contact_messages matching sender_email:** Full erasure of all personal data, simplest GDPR interpretation.
  - Why not: Destroys the organisation's record of receiving and acting on the user's enquiries. If the user later disputes how their request was handled, we have no evidence of what they sent us or when.

- **Anonymise sender_email in retained messages:** Replace the email with a placeholder like `[redacted]` on erasure.
  - Why not: Adds complexity, and partial anonymisation may not satisfy a user who expects full deletion. Retention with full reasoning is cleaner than partial scrubbing.

- **Chosen — Retain messages in full, document the legal basis:** Keep contact messages intact, citing legitimate interest and legal record-keeping as the basis.

## Reasoning

**Contact messages are organisational correspondence, not user content**

A message sent to the curators is analogous to a letter posted to a company — the recipient organisation has a legitimate interest in retaining it. The user chose to communicate with us; the message is a record of that communication, not a personal document they own.

**GDPR provides grounds for retention**

GDPR Article 17(3) allows retention even after an erasure request when processing is necessary for:
- Compliance with a legal obligation (Art. 17(3)(b))
- Establishment, exercise, or defence of legal claims (Art. 17(3)(e))

Retaining records of what users told us, and when, falls under both grounds.

**Provability matters**

If a user later claims their contact was ignored, mishandled, or never received, the retained message is our evidence. Deleting it would be contrary to our interests and potentially harmful to the user if they need to prove we acted on their request.

**The sender_email field does not reference auth.users**

`contact_messages.sender_email` is a plain text column with no foreign key constraint to `auth.users` or `profiles`. When a user's auth account and profile are deleted, the contact messages remain as standalone records with no linkage to the deleted account — they are not browseable by user ID in any admin view.

## Trade-offs accepted

**Personal data is retained after erasure request**

The `sender_email` field in retained messages is personal data. This is a deliberate exception to full erasure, justified by legitimate interest. If challenged, the legal basis must be articulable (see above).

**Requires documentation**

The exception must be explicitly documented — in code comments, this ADR, and ideally in the Privacy Policy — so that any future developer does not "fix" the omission by adding deletion. The migration comment and this ADR serve that purpose.

**May need to be disclosed in the Privacy Policy**

Phase 9 should ensure the Privacy Policy states that contact messages may be retained after an account deletion request for record-keeping purposes.

## Implications

**Enables:**
- Evidence trail that contact was received and acted on
- Defence against disputes about how user requests were handled
- Simpler erasure logic (no email-matching deletion to maintain)

**Prevents:**
- Full data erasure for users who submitted contact forms
- Contact message data being cleaned up in automated erasure flows

---

## References

- GDPR Article 17 — Right to erasure
- GDPR Article 17(3)(b),(e) — Exceptions for legal obligations and claims
- GDPR Recital 47 — Legitimate interests
- Migration: `supabase/migrations/20260419000000_phase8_settings_admin.sql`
- Phase 9 spec: `SPECIFICATIONS/09-polish-launch.md` (Privacy Policy content)
