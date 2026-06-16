export interface CorsConfig {
  readonly origins: readonly string[];
}

const DEFAULT_DEVELOPMENT_ORIGINS = ['http://localhost:5173', 'http://127.0.0.1:5173'] as const;

export function getCorsConfig(): CorsConfig {
  const configuredOrigins = parseOrigins(process.env.CORS_ORIGINS);

  if (configuredOrigins.length > 0) {
    return { origins: configuredOrigins };
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('CORS_ORIGINS must be set in production.');
  }

  return { origins: DEFAULT_DEVELOPMENT_ORIGINS };
}

function parseOrigins(value: string | undefined): readonly string[] {
  return [
    ...new Set(
      (value ?? '')
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    )
  ];
}
