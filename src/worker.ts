// ABOUT: Cloudflare Worker entrypoint
// ABOUT: Serves the SPA for all routes; API Worker routes added in Phase 4
export default {
  async fetch(request: Request): Promise<Response> {
    // Static assets and SPA fallback handled by [assets] config in wrangler.toml
    // This entrypoint exists as a placeholder for Phase 4 API routes
    return new Response('Not found', { status: 404 })
  },
}
