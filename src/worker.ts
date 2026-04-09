// ABOUT: Cloudflare Worker entrypoint
// ABOUT: Serves the SPA for all routes; API Worker routes added in Phase 4

// Cloudflare evaluates [assets] routes BEFORE calling this fetch handler.
// Matched static files (JS, CSS, images) are served directly from the asset store.
// Unmatched paths fall through to not_found_handling = "single-page-application"
// in wrangler.toml, which serves index.html — enabling client-side SPA routing.
// This fetch handler is only reached for paths that are neither static assets
// nor handled by the SPA fallback — in practice, never, until Phase 4 adds
// explicit API routes here.
export default {
  async fetch(_request: Request): Promise<Response> {
    return new Response('Not found', { status: 404 })
  },
}
