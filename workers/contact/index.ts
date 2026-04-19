// ABOUT: Contact form Worker handler — inserts contact_messages and sends Resend notification
// ABOUT: No auth required (public form); honeypot and VictorianCaptcha validation is client-side

import type { Env } from '../generate-creature/index'

interface ContactBody {
  sender_email?: string
  sender_name?: string
  message?: string
}

/** Send an admin notification email via Resend. Non-fatal on failure. */
async function sendResendNotification(
  resendApiKey: string,
  senderEmail: string,
  senderName: string | undefined,
  message: string,
): Promise<void> {
  const from = senderName ? `${senderName} <${senderEmail}>` : senderEmail
  const body = {
    from: 'QRious Specimens <noreply@hultberg.org>',
    to: ['magnus.hultberg@gmail.com'],
    reply_to: senderEmail,
    subject: 'New correspondence received — QRious Specimens',
    text: [
      `New message from: ${from}`,
      '',
      message,
      '',
      '— Check the admin dashboard for the full message.',
    ].join('\n'),
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const detail = await res.text()
    throw new Error(`Resend error ${res.status}: ${detail}`)
  }
}

export async function handleContact(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('Origin')
  const allowed = ['https://qrious.hultberg.org', 'http://localhost:5173']
  const allowedOrigin = origin && allowed.includes(origin) ? origin : allowed[0]
  const cors = {
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors })
  }
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  let body: ContactBody
  try {
    body = (await request.json()) as ContactBody
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  const { sender_email, sender_name, message } = body

  if (!sender_email || !message) {
    return new Response(JSON.stringify({ error: 'sender_email and message are required' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }
  if (message.length > 2000 || sender_email.length > 320 || (sender_name && sender_name.length > 200)) {
    return new Response(JSON.stringify({ error: 'Input too long' }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  // Insert into contact_messages via service role (bypasses RLS)
  const insertRes = await fetch(`${env.SUPABASE_URL}/rest/v1/contact_messages`, {
    method: 'POST',
    headers: {
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ sender_email, sender_name: sender_name ?? null, message }),
  })

  if (!insertRes.ok) {
    const detail = await insertRes.text()
    console.error('contact_messages insert failed:', insertRes.status, detail)
    return new Response(JSON.stringify({ error: 'Failed to save message' }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })
  }

  // Send Resend notification — non-fatal
  if (env.RESEND_API_KEY) {
    try {
      await sendResendNotification(env.RESEND_API_KEY, sender_email, sender_name, message)
    } catch (err) {
      console.error('Resend notification failed (non-fatal):', (err as Error).message)
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
