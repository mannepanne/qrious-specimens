// ABOUT: Shared types for the generate-creature Worker response

export interface WorkerResponse {
  imageUrl: string
  imageUrl512: string
  imageUrl256: string
  fieldNotes: string
  isFirstDiscoverer: boolean
  discoveryCount: number
  cached: boolean
}

/**
 * Thrown by client-side callers of `/api/generate-creature` on a non-2xx
 * response. Carries the worker-supplied `error` code and `correlationId` so
 * the UI can render targeted feedback and the user has something to quote
 * to support that ties back to a server log line.
 */
export class WorkerError extends Error {
  constructor(
    public readonly status: number,
    public readonly errorCode: string,
    public readonly correlationId: string | null,
    message: string,
  ) {
    super(message)
    this.name = 'WorkerError'
  }
}

interface WorkerErrorBody {
  error?: string
  correlationId?: string
}

/** Parses a non-2xx response from `/api/generate-creature` into a WorkerError. */
export async function parseWorkerError(res: Response): Promise<WorkerError> {
  const body = await res.text()
  let parsed: WorkerErrorBody | null = null
  try {
    parsed = JSON.parse(body) as WorkerErrorBody
  } catch {
    // Body wasn't JSON — keep the raw text in the message
  }
  return new WorkerError(
    res.status,
    parsed?.error ?? 'Unknown',
    parsed?.correlationId ?? null,
    `Worker error ${res.status}: ${body.slice(0, 200)}`,
  )
}
