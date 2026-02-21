export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function toStringValue(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function toBooleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

export function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const values = value
    .map((item) => toStringValue(item))
    .filter((item): item is string => item !== undefined);

  return values.length > 0 ? values : undefined;
}

export function toPascalCase(value: string): string {
  const chunks = value.split(/[^A-Za-z0-9]+/).filter((chunk) => chunk.length > 0);
  const raw = chunks
    .map((chunk) => `${chunk.charAt(0).toUpperCase()}${chunk.slice(1)}`)
    .join('');

  const safe = raw.length > 0 ? raw : 'Generated';
  return /^[A-Za-z_$]/.test(safe) ? safe : `T${safe}`;
}

export function toTypePropertyName(value: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) ? value : JSON.stringify(value);
}

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
