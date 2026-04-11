// ABOUT: Cloudflare Worker entrypoint — serves the SPA and handles API routes
// ABOUT: POST /api/generate-creature → Gemini illustration + Claude field notes + R2 upload

import { handleGenerateCreature, type Env } from '../workers/generate-creature/index'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/generate-creature') {
      return handleGenerateCreature(request, env)
    }

    // All other paths are handled by Cloudflare's [assets] binding (SPA fallback).
    // This handler is only reached for paths that bypass the asset store.
    return new Response('Not found', { status: 404 })
  },
}
