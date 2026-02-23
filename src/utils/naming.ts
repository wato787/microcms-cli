export function toPascalCase(value: string): string {
  const chunks = value.split(/[^A-Za-z0-9]+/).filter((chunk) => chunk.length > 0);
  const raw = chunks.map((chunk) => `${chunk.charAt(0).toUpperCase()}${chunk.slice(1)}`).join('');

  const safe = raw.length > 0 ? raw : 'Generated';
  return /^[A-Za-z_$]/.test(safe) ? safe : `T${safe}`;
}

export function toTypePropertyName(value: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) ? value : JSON.stringify(value);
}

export function getUniqueName(baseName: string, usedNames: Set<string>): string {
  let candidate = baseName;
  let suffix = 2;

  while (usedNames.has(candidate)) {
    candidate = `${baseName}${suffix}`;
    suffix += 1;
  }

  usedNames.add(candidate);
  return candidate;
}
