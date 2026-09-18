/**
 * useAuth Hook — Support Console
 *
 * Reads the support-staff session from localStorage (set by IAM after the
 * staff email+OTP flow -> /iam/api/staff/session). The claim carries no
 * merchantId; it carries the agent identity (userId/email/staffTeam).
 *
 * Also exposes non-hook getters (getAuthToken / getAgentIdentity) so the
 * GraphQL datasource can attach the Bearer token and the X-Agent-Id dev header
 * without React context.
 */
import { useState, useEffect } from 'react'
import type { Agent } from '../../../../domain/entities/agent.entity'

export interface AuthUser {
  id: string
  email: string
  name: string
  team?: string
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

/** True when the local dev bypass (mock auth) is active. */
export function isDevBypass(): boolean {
  return DEV && MOCK_AUTH
}

/** Opaque staff Bearer token, or null. Used by the datasource. */
export function getAuthToken(): string | null {
  if (isDevBypass()) return 'dev-mock-token'
  try {
    return localStorage.getItem('authToken')
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
    const userJson = localStorage.getItem('user')
    if (!userJson) return null
    const user = JSON.parse(userJson) as AuthUser
    if (!user?.id) return null
    return {
      agentId: user.id,
      agentName: user.name || user.email || user.id,
      email: user.email || '',
      team: user.team,
    }
  } catch {
    return null
  }
}

function readAuthState(): AuthState {
  if (isDevBypass()) {
    return { isAuthenticated: true, agent: getAgentIdentity(), loading: false }
  }
  try {
    // Auth data handed off from IAM via ?auth= (base64 JSON), then persisted.
    const urlParams = new URLSearchParams(window.location.search)
    const authParam = urlParams.get('auth')
    if (authParam) {
      const authData = JSON.parse(atob(decodeURIComponent(authParam)))
      localStorage.setItem('authToken', authData.token)
      if (authData.refresh) localStorage.setItem('refreshToken', authData.refresh)
      localStorage.setItem('user', JSON.stringify(authData.user))
      window.history.replaceState({}, '', window.location.pathname)
    }

    const token = localStorage.getItem('authToken')
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

/** Clear the staff session and return to the IAM staff login. */
export function logout(): void {
  try {
    localStorage.removeItem('authToken')
    localStorage.removeItem('refreshToken')
    localStorage.removeItem('user')
  } catch {
    /* ignore */
  }
  const authUrl = import.meta.env.VITE_AUTH_URL
  if (authUrl) {
    window.location.replace(`${authUrl}/login`)
  } else {
    const gatewayUrl = import.meta.env.VITE_GATEWAY_URL
    window.location.replace(gatewayUrl ? `${gatewayUrl}/auth/login` : '/auth/login')
  }
}
