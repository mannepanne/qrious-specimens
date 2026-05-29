// ABOUT: Cloudflare Worker entrypoint — serves the SPA and handles API routes
// ABOUT: POST /api/generate-creature → Gemini illustration + Claude field notes + Cloudflare Images upload
// ABOUT: POST /api/contact → contact form submission + Resend admin notification
// ABOUT: POST /api/admin-delete-user → admin-only erasure (app data RPC + Supabase Auth row)

import { handleGenerateCreature, type Env } from '../workers/generate-creature/index'
import { handleContact } from '../workers/contact/index'
import { handleAdminDeleteUser } from '../workers/admin-delete-user/index'
import { withSecurityHeaders } from '../workers/shared/securityHeaders'

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)

  if (url.pathname === '/api/generate-creature') {
    return handleGenerateCreature(request, env)
  }

  if (url.pathname === '/api/contact') {
    return handleContact(request, env)
  }

  if (url.pathname === '/api/admin-delete-user') {
    return handleAdminDeleteUser(request, env)
  }

  // All other paths — static assets and SPA routes — are served by the assets binding.
  // The binding's not_found_handling = "single-page-application" ensures unknown paths
  // receive index.html so React Router can handle client-side navigation.
  return env.ASSETS.fetch(request)
}

export default {
  // Every response — API routes and static assets alike — is wrapped with the
  // shared security headers (CSP + hardening) so the policy lives in one place.
  //
  // Because run_worker_first routes every request (including static assets)
  // through this handler, an unhandled throw in route() or the wrapper would
  // otherwise blank the whole site. The fallback serves the requested asset
  // directly so a routing/wrapper bug degrades to "no security headers on one
  // response" rather than "site down".
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      return withSecurityHeaders(await route(request, env))
    } catch {
      return withSecurityHeaders(await env.ASSETS.fetch(request))
    }
  },
}
