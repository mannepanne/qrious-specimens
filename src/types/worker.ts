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
