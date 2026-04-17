// ABOUT: Cloudflare Worker entrypoint — serves the SPA and handles API routes
// ABOUT: POST /api/generate-creature → Gemini illustration + Claude field notes + R2 upload

import { handleGenerateCreature, type Env } from '../workers/generate-creature/index'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/generate-creature') {
      return handleGenerateCreature(request, env)
    }

    // All other paths — static assets and SPA routes — are served by the assets binding.
    // The binding's not_found_handling = "single-page-application" ensures unknown paths
    // receive index.html so React Router can handle client-side navigation.
    return env.ASSETS.fetch(request)
  },
}
