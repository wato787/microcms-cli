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

export function parseArray<T>(rawArray: unknown, parser: (item: unknown) => T | null): T[] {
  if (!Array.isArray(rawArray)) return [];
  return rawArray.map(parser).filter((item): item is T => item !== null);
}
