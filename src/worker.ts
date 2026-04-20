// ABOUT: Cloudflare Worker entrypoint — serves the SPA and handles API routes
// ABOUT: POST /api/generate-creature → Gemini illustration + Claude field notes + Cloudflare Images upload
// ABOUT: POST /api/contact → contact form submission + Resend admin notification

import { handleGenerateCreature, type Env } from '../workers/generate-creature/index'
import { handleContact } from '../workers/contact/index'

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (url.pathname === '/api/generate-creature') {
      return handleGenerateCreature(request, env)
    }

    if (url.pathname === '/api/contact') {
      return handleContact(request, env)
    }

    // All other paths — static assets and SPA routes — are served by the assets binding.
    // The binding's not_found_handling = "single-page-application" ensures unknown paths
    // receive index.html so React Router can handle client-side navigation.
    return env.ASSETS.fetch(request)
  },
}
