// ABOUT: Tests for the WorkerError class and parseWorkerError helper

import { describe, it, expect } from 'vitest'
import { WorkerError, parseWorkerError } from './worker'

describe('parseWorkerError', () => {
  it('extracts error code and correlationId from a JSON body', async () => {
    const res = new Response(
      JSON.stringify({ error: 'Invalid token', correlationId: '7c63530a-a224-48c9' }),
      { status: 401 },
    )
    const err = await parseWorkerError(res)
    expect(err).toBeInstanceOf(WorkerError)
    expect(err.status).toBe(401)
    expect(err.errorCode).toBe('Invalid token')
    expect(err.correlationId).toBe('7c63530a-a224-48c9')
  })

  it('falls back gracefully when the body is not JSON', async () => {
    const res = new Response('Internal Server Error', { status: 500 })
    const err = await parseWorkerError(res)
    expect(err.status).toBe(500)
    expect(err.errorCode).toBe('Unknown')
    expect(err.correlationId).toBeNull()
    expect(err.message).toContain('500')
    expect(err.message).toContain('Internal Server Error')
  })

  it('handles a JSON body without error or correlationId fields', async () => {
    const res = new Response(JSON.stringify({ foo: 'bar' }), { status: 503 })
    const err = await parseWorkerError(res)
    expect(err.status).toBe(503)
    expect(err.errorCode).toBe('Unknown')
    expect(err.correlationId).toBeNull()
  })
})
