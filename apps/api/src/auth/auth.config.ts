const DEFAULT_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7;
const DEVELOPMENT_JWT_SECRET = 'dev-only-change-me-ai-book-illustrator';
const INSECURE_JWT_SECRETS = new Set([
  DEVELOPMENT_JWT_SECRET,
  'change-me-use-a-long-random-secret'
]);

export interface AuthConfig {
  readonly jwtSecret: string;
  readonly jwtExpiresInSeconds: number;
}

export function getAuthConfig(): AuthConfig {
  const jwtSecret = process.env.JWT_SECRET?.trim() || getDevelopmentJwtSecret();

  if (isProduction() && INSECURE_JWT_SECRETS.has(jwtSecret)) {
    throw new Error('JWT_SECRET must be set to a strong secret in production.');
  }

  return {
    jwtSecret,
    jwtExpiresInSeconds: parsePositiveInt(
      process.env.JWT_EXPIRES_IN_SECONDS,
      DEFAULT_EXPIRES_IN_SECONDS
    )
  };
}

function getDevelopmentJwtSecret(): string {
  if (isProduction()) {
    throw new Error('JWT_SECRET is required in production.');
  }

  return DEVELOPMENT_JWT_SECRET;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
