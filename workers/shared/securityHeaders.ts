// ABOUT: Shared security-response-header helper applied to every Worker response
// ABOUT: Builds the Content-Security-Policy + hardening headers; HSTS is intentionally owned by the Cloudflare edge

/**
 * Content-Security-Policy for the SPA, grounded in the resources the app
 * actually loads in the browser:
 *
 * - script-src   own Vite bundle (self) + the Cloudflare Insights beacon
 * - style-src    'unsafe-inline' is required because Radix/Tailwind inject
 *                inline style attributes; Google Fonts stylesheet stays remote
 * - font-src     EB Garamond / JetBrains Mono are served from fonts.gstatic.com
 * - img-src      Cloudflare Images, plus data:/blob: for the favicon and the
 *                html5-qrcode canvas frames
 * - connect-src  the Supabase project (REST + auth over https, realtime over
 *                wss) and the Cloudflare Insights beacon endpoint
 *
 * Server-side hosts the Worker talks to (Gemini, Anthropic, Resend, the
 * Cloudflare API) are deliberately absent — CSP is browser-enforced and those
 * calls never originate from the page.
 *
 * HSTS is set at the Cloudflare edge (SSL/TLS → HSTS), not here, so the browser
 * never receives two conflicting Strict-Transport-Security headers.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "script-src 'self' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://imagedelivery.net",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://cloudflareinsights.com",
].join('; ')

/**
 * Static security headers added to every response.
 *
 * `Permissions-Policy` grants `camera=(self)` on purpose: the QR scanner
 * (html5-qrcode) needs the camera on the app's own origin. Microphone and
 * geolocation are denied outright — the app never uses them.
 */
export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
}

/**
 * Return a copy of `response` with the security headers applied. A new Response
 * is constructed because responses from the static-assets binding have
 * immutable headers; the body stream and status are preserved.
 */
export function withSecurityHeaders(response: Response): Response {
  const wrapped = new Response(response.body, response)
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    wrapped.headers.set(name, value)
  }
  return wrapped
}
