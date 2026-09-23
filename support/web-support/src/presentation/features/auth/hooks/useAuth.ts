/**
 * useAuth Hook — Support Console
 *
 * Option B (auth reuse): staff authenticate in-app against the mz-ai-assistant
 * auth API (email+password -> OTP -> JWT). The JWT access token + user_info are
 * persisted in localStorage; the GraphQL datasource attaches the token as a
 * Bearer credential (svc-support validates it as a mz-ai access token).
 *
 * Also exposes non-hook getters (getAuthToken / getAgentIdentity) so the
 * datasource can read the token / identity without React context, and
 * saveSession() for the LoginPage to persist a successful login.
 */
import { useState, useEffect } from 'react'
import type { Agent } from '../../../../domain/entities/agent.entity'
import type { VerifyOtpResponse } from '../../../../data/datasources/auth-api.datasource'

export interface AuthUser {
  id: string
  email: string
  name: string
  team?: string
  department?: string
  role?: string
  [key: string]: unknown
}

export interface AuthState {
  isAuthenticated: boolean
  agent: Agent | null
  loading: boolean
}

const DEV = import.meta.env.DEV
const MOCK_AUTH = import.meta.env.VITE_MOCK_AUTH === 'true'

const TOKEN_KEY = 'authToken'
const REFRESH_KEY = 'refreshToken'
const USER_KEY = 'user'

/** True when the local dev bypass (mock auth) is active. */
export function isDevBypass(): boolean {
  return DEV && MOCK_AUTH
}

/** JWT access token (or null). Attached as Bearer by the datasource. */
export function getAuthToken(): string | null {
  if (isDevBypass()) return 'dev-mock-token'
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

/** The signed-in agent identity, or null. Used for X-Agent-Id + "my" scoping. */
export function getAgentIdentity(): Agent | null {
  if (isDevBypass()) {
    return {
      agentId: import.meta.env.VITE_DEV_AGENT_ID || 'agent-dev-001',
      agentName: import.meta.env.VITE_DEV_AGENT_NAME || 'Dev Agent',
      email: 'dev-agent@mezzofy.com',
      team: import.meta.env.VITE_DEV_AGENT_TEAM || 'SUPPORT',
    }
  }
  try {
    const userJson = localStorage.getItem(USER_KEY)
    if (!userJson) return null
    const user = JSON.parse(userJson) as AuthUser
    if (!user?.id) return null
    // mz-ai user_info carries `department`; the console team is its uppercase form.
    const team =
      user.team || (user.department ? String(user.department).toUpperCase() : undefined)
    return {
      agentId: user.id,
      agentName: user.name || user.email || user.id,
      email: user.email || '',
      team,
    }
  } catch {
    return null
  }
}

/** Persist a successful login (called by LoginPage after verify-otp). */
export function saveSession(session: VerifyOtpResponse): void {
  try {
    localStorage.setItem(TOKEN_KEY, session.access_token)
    if (session.refresh_token) localStorage.setItem(REFRESH_KEY, session.refresh_token)
    localStorage.setItem(USER_KEY, JSON.stringify(session.user_info))
  } catch {
    /* storage unavailable — the caller still navigates; a reload would re-prompt */
  }
}

function readAuthState(): AuthState {
  if (isDevBypass()) {
    return { isAuthenticated: true, agent: getAgentIdentity(), loading: false }
  }
  try {
    const token = getAuthToken()
    const agent = getAgentIdentity()
    if (token && agent) {
      return { isAuthenticated: true, agent, loading: false }
    }
    return { isAuthenticated: false, agent: null, loading: false }
  } catch {
    return { isAuthenticated: false, agent: null, loading: false }
  }
}

export function useAuth(): AuthState {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    agent: null,
    loading: true,
  })

  useEffect(() => {
    setAuthState(readAuthState())
  }, [])

  return authState
}

/** In-app login route (respects the Vite basename, e.g. /support/). */
export function loginPath(): string {
  const base = import.meta.env.BASE_URL || '/'
  return `${base}${base.endsWith('/') ? '' : '/'}login`
}

/** Clear the staff session and return to the in-app login. */
export function logout(): void {
  try {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(REFRESH_KEY)
    localStorage.removeItem(USER_KEY)
  } catch {
    /* ignore */
  }
  window.location.replace(loginPath())
}
