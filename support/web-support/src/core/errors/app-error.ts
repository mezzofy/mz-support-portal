/**
 * Application Error Handling — Support Console
 * Centralized error types and error class for consistent error management.
 */

export enum ErrorCode {
  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  FIELD_REQUIRED = 'FIELD_REQUIRED',
  INVALID_TRANSITION = 'INVALID_TRANSITION',

  // Authentication / authorization errors
  AUTHENTICATION_FAILED = 'AUTHENTICATION_FAILED',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  TOKEN_INVALID = 'TOKEN_INVALID',

  // Network errors
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  SERVER_ERROR = 'SERVER_ERROR',

  // Resource errors
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',

  // Data errors
  DATA_FETCH_ERROR = 'DATA_FETCH_ERROR',
  GRAPHQL_ERROR = 'GRAPHQL_ERROR',

  // Unknown
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export class AppError extends Error {
  public readonly code: ErrorCode
  public readonly details?: Record<string, unknown>
  public readonly timestamp: Date

  constructor(code: ErrorCode, message: string, details?: Record<string, unknown>) {
    super(message)
    this.name = 'AppError'
    this.code = code
    this.details = details
    this.timestamp = new Date()
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError)
    }
  }

  static isAppError(error: unknown): error is AppError {
    return error instanceof AppError
  }

  static forbidden(message = 'You do not have permission to perform this action.', details?: Record<string, unknown>) {
    return new AppError(ErrorCode.FORBIDDEN, message, details)
  }

  static graphql(message: string, details?: Record<string, unknown>) {
    return new AppError(ErrorCode.GRAPHQL_ERROR, message, details)
  }

  static network(message: string, details?: Record<string, unknown>) {
    return new AppError(ErrorCode.NETWORK_ERROR, message, details)
  }

  static validation(message: string, details?: Record<string, unknown>) {
    return new AppError(ErrorCode.VALIDATION_ERROR, message, details)
  }

  static unknown(error: unknown) {
    if (error instanceof AppError) return error
    if (error instanceof Error) {
      return new AppError(ErrorCode.UNKNOWN_ERROR, error.message, { originalError: error.name })
    }
    return new AppError(ErrorCode.UNKNOWN_ERROR, 'An unknown error occurred', {
      originalError: String(error),
    })
  }
}
