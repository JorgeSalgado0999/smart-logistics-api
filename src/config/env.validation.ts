export const STORAGE_KINDS = ['memory', 'mongo'] as const;
export type StorageKind = (typeof STORAGE_KINDS)[number];

/** Environment after validation and defaults. */
export interface EnvConfig {
  STORAGE: StorageKind;
  PORT: number;
  /** Required when STORAGE=mongo. */
  MONGO_URI?: string;
  MONGO_DB: string;
}

/**
 * Validates process env for ConfigModule. Throws one error listing every
 * problem, so startup fails with a clear message instead of a bad config.
 */
export function validateEnv(raw: Record<string, unknown>): EnvConfig {
  const errors: string[] = [];

  const storage = readString(raw.STORAGE) ?? 'memory';
  if (!isStorageKind(storage)) {
    errors.push(
      `STORAGE must be one of: ${STORAGE_KINDS.join(', ')} (got "${storage}")`,
    );
  }

  const portText = readString(raw.PORT) ?? '3000';
  const port = Number(portText);
  if (!/^\d+$/.test(portText) || port < 1 || port > 65535) {
    errors.push(`PORT must be an integer from 1 to 65535 (got "${portText}")`);
  }

  const mongoUri = readString(raw.MONGO_URI);
  if (storage === 'mongo' && mongoUri === undefined) {
    errors.push('MONGO_URI is required when STORAGE=mongo');
  }
  if (mongoUri !== undefined && !/^mongodb(\+srv)?:\/\//.test(mongoUri)) {
    errors.push('MONGO_URI must start with mongodb:// or mongodb+srv://');
  }

  const mongoDb = readString(raw.MONGO_DB) ?? 'smart_logistics';
  if (!/^[A-Za-z0-9_-]{1,63}$/.test(mongoDb)) {
    errors.push(
      `MONGO_DB must be 1-63 letters, digits, _ or - (got "${mongoDb}")`,
    );
  }

  if (errors.length > 0) {
    throw new Error(`Invalid environment:\n- ${errors.join('\n- ')}`);
  }
  return {
    STORAGE: storage as StorageKind,
    PORT: port,
    MONGO_URI: mongoUri,
    MONGO_DB: mongoDb,
  };
}

/** Trimmed string, or undefined when missing or blank. */
function readString(value: unknown): string | undefined {
  if (typeof value !== 'string' && typeof value !== 'number') return undefined;
  const text = String(value).trim();
  return text === '' ? undefined : text;
}

function isStorageKind(value: string): value is StorageKind {
  return (STORAGE_KINDS as readonly string[]).includes(value);
}
