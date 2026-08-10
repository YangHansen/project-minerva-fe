import { treaty } from '@elysia/eden'

export const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '')

export interface ApiRequestOptions extends Omit<RequestInit, 'body'> {
  body?: BodyInit | object | null
}

export class ApiError extends Error {
  readonly status: number
  readonly details: unknown

  constructor(message: string, status = 0, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

const isRawBody = (body: ApiRequestOptions['body']): body is BodyInit => (
  typeof body === 'string'
  || body instanceof FormData
  || body instanceof URLSearchParams
  || body instanceof Blob
  || body instanceof ArrayBuffer
  || ArrayBuffer.isView(body)
  || (typeof ReadableStream !== 'undefined' && body instanceof ReadableStream)
)

const readResponse = async (response: Response): Promise<unknown> => {
  if (response.status === 204) return undefined

  const text = await response.text()
  if (!text) return undefined

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('json')) {
    try { return JSON.parse(text) as unknown }
    catch { throw new ApiError('The server returned an invalid JSON response.', response.status, text) }
  }

  return text
}

const errorMessage = (payload: unknown, fallback: string) => {
  if (typeof payload === 'string' && payload.trim()) return payload
  if (payload && typeof payload === 'object') {
    const value = payload as Record<string, unknown>
    if (value.error && typeof value.error === 'object') {
      const nested = value.error as Record<string, unknown>
      if (typeof nested.message === 'string' && nested.message) return nested.message
    }
    for (const key of ['message', 'error', 'reason']) {
      if (typeof value[key] === 'string' && value[key]) return value[key]
    }
  }
  return fallback
}

/**
 * Small fetch wrapper shared by every frontend feature. It keeps cookies on
 * cross-origin localhost calls, serializes plain objects as JSON, preserves
 * FormData boundaries, and turns API failures into a consistent ApiError.
 */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const headers = new Headers(options.headers)
  if (!headers.has('Accept')) headers.set('Accept', 'application/json')

  let requestBody: BodyInit | null | undefined
  if (options.body != null) {
    if (isRawBody(options.body)) {
      requestBody = options.body
    } else {
      requestBody = JSON.stringify(options.body)
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    }
  }

  const url = /^https?:\/\//i.test(path)
    ? path
    : `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`

  let response: Response
  try {
    response = await fetch(url, {
      ...options,
      headers,
      body: requestBody,
      credentials: options.credentials ?? 'include',
    })
  } catch (error) {
    throw new ApiError(
      'Unable to reach Minerva. Check that the backend is running and try again.',
      0,
      error,
    )
  }

  const payload = await readResponse(response)
  if (!response.ok) {
    throw new ApiError(
      errorMessage(payload, `Request failed with status ${response.status}.`),
      response.status,
      payload,
    )
  }

  return payload as T
}

/**
 * Untyped Eden client retained for legacy callers. New feature calls go
 * through apiRequest with local types (e.g. src/services/ielts.ts).
 */
export const api = treaty(API_BASE_URL, {
  fetch: { credentials: 'include' },
})
