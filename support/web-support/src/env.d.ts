/// <reference types="vite/client" />

/**
 * Environment Variables Type Definitions — Support Console
 */
interface ImportMetaEnv {
  /** GraphQL endpoint of svc-support (frozen: /support/api/graphql, port 8005). */
  readonly VITE_SUPPORT_API_URL: string

  /** Gateway URL — used for cross-app navigation and logout fallback. */
  readonly VITE_GATEWAY_URL: string

  /** Auth URL — gateway route to IAM staff login for logout/redirect. */
  readonly VITE_AUTH_URL: string

  /** Dev bypass — 'true' skips the real staff token and uses the X-Agent-Id dev header. */
  readonly VITE_MOCK_AUTH: string

  /** Dev agent identity used with the X-Agent-Id bypass (development only). */
  readonly VITE_DEV_AGENT_ID: string
  readonly VITE_DEV_AGENT_NAME: string
  readonly VITE_DEV_AGENT_TEAM: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
