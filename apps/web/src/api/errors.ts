export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NetworkError extends Error {
  constructor(
    message: string,
    readonly originalCause?: unknown
  ) {
    super(message);
    this.name = 'NetworkError';
  }
}
