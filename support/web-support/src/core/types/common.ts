/**
 * Common Types — Support Console
 * Shared type definitions used across the application.
 */

/** Result type for success/error handling. */
export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E }

/** Async result type for asynchronous operations. */
export type AsyncResult<T, E = Error> = Promise<Result<T, E>>

/** Paginated response type for list endpoints. */
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

/** Generic ID type. */
export type ID = string

/** Timestamp type (ISO 8601 string). */
export type Timestamp = string
