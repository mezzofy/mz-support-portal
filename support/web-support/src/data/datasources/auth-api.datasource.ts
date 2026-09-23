/**
 * AuthApiDatasource — Support Console
 *
 * Option B (auth reuse): the support console authenticates staff against the
 * mz-ai-assistant auth API — a two-step email+password -> OTP -> JWT flow.
 * Base URL: VITE_AUTH_API_URL (the mz-ai-assistant server, e.g. http://localhost:8000).
 *
 * Endpoints (mz-ai-assistant app/api/auth.py):
 *   POST /auth/login       {email, password}   -> {status:"otp_required", otp_token, message}
 *   POST /auth/verify-otp  {otp_token, code}   -> {access_token, refresh_token, token_type, user_info}
 *   POST /auth/resend-otp  {otp_token}         -> {message}
 */

const AUTH_BASE = import.meta.env.VITE_AUTH_API_URL || 'http://localhost:8000'

export interface LoginOtpResponse {
  status: string
  otp_token: string
  message?: string
}

export interface UserInfo {
  id: string
  email: string
  name: string
  department: string
  role: string
  permissions: string[]
}

export interface VerifyOtpResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user_info: UserInfo
}

export class AuthApiError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = 'AuthApiError'
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${AUTH_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  } catch {
    throw new AuthApiError('NETWORK', 'Unable to reach the login service.')
  }

  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    /* empty / non-JSON body */
  }

  if (!res.ok) {
    const detail =
      (data as { detail?: unknown; message?: unknown })?.detail ??
      (data as { message?: unknown })?.message
    const message = typeof detail === 'string' ? detail : `Request failed (${res.status})`
    throw new AuthApiError(String(res.status), message)
  }

  return data as T
}

export const authApi = {
  login: (email: string, password: string) =>
    post<LoginOtpResponse>('/auth/login', { email, password }),

  verifyOtp: (otpToken: string, code: string) =>
    post<VerifyOtpResponse>('/auth/verify-otp', { otp_token: otpToken, code }),

  resendOtp: (otpToken: string) =>
    post<{ message?: string }>('/auth/resend-otp', { otp_token: otpToken }),
}
