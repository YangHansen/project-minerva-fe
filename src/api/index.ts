import { request } from './client'
import type { LoginResponse, MessageResponse } from '../types/api'

export const auth = {
  login: (email: string, password: string) =>
    request<LoginResponse>('POST', '/api/auth/login', { body: { email, password } }),
  register: (email: string, password: string) =>
    request<MessageResponse>('POST', '/api/auth/register', { body: { email, password } }),
  forgotPassword: (email: string) =>
    request<MessageResponse>('POST', '/api/auth/forgot-password', { body: { email } }),
  resetPassword: (token: string, newPassword: string) =>
    request<MessageResponse>('POST', `/api/auth/reset-password/${token}`, { body: { newPassword } })
}
