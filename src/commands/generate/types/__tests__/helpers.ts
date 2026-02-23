import type { GenerationTarget, ManagementApiSchema } from '../types.js';

export function createSchema(overrides: Partial<ManagementApiSchema> = {}): ManagementApiSchema {
  return {
    apiFields: [],
    customFields: [],
    ...overrides,
  };
}

export function createTarget(
  endpoint: string,
  overrides: Partial<GenerationTarget> = {},
): GenerationTarget {
  return {
    endpoint,
    schema: createSchema(),
    ...overrides,
  };
}
