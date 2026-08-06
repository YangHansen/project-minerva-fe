const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

let authToken: string | null = null
export function setAuthToken(token: string | null): void {
  authToken = token
}

type RequestOptions = { body?: unknown }

export async function request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
  const url = new URL(API_BASE_URL + path)
  const headers: Record<string, string> = {}
  if (authToken) headers.Authorization = `Bearer ${authToken}`
  if (options.body !== undefined) headers['Content-Type'] = 'application/json'
  const res = await fetch(url, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  })
  const data = (await res.json().catch(() => null)) as { success?: boolean; message?: string } | null
  if (!res.ok || (data && data.success === false)) {
    throw new ApiError(res.status, data?.message || `Request failed (${res.status})`)
  }
  return data as T
}
