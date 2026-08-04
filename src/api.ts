import { treaty } from '@elysia/eden'

/**
 * Shared Eden Treaty client. Set VITE_API_URL when the Elysia API is available.
 * Once the backend exports `type App = typeof app`, pass that type to treaty
 * here for end-to-end route and payload inference.
 */
export const api = treaty(import.meta.env.VITE_API_URL || 'http://localhost:3000')
