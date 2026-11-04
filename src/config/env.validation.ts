export const STORAGE_KINDS = ['memory'] as const;
export type StorageKind = (typeof STORAGE_KINDS)[number];

/** Environment after validation and defaults. */
export interface EnvConfig {
  STORAGE: StorageKind;
  PORT: number;
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

  if (errors.length > 0) {
    throw new Error(`Invalid environment:\n- ${errors.join('\n- ')}`);
  }
  return { STORAGE: storage as StorageKind, PORT: port };
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
