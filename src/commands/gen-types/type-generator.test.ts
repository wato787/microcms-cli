import { describe, expect, it } from 'bun:test';
import { renderDefinitionsFile } from './type-generator.js';
import type { GenerationTarget, ManagementApiSchema } from './types.js';

function createSchema(overrides: Partial<ManagementApiSchema> = {}): ManagementApiSchema {
  return {
    apiFields: [],
    customFields: [],
    ...overrides,
  };
}

function createTarget(
  endpoint: string,
  overrides: Partial<GenerationTarget> = {},
): GenerationTarget {
  return {
    endpoint,
    schema: createSchema(),
    ...overrides,
  };
}

describe('renderDefinitionsFile', () => {
  it('endpoint 名の PascalCase が衝突しても型名を一意化する', () => {
    const source = renderDefinitionsFile([
      createTarget('blog-post', { apiType: 'LIST' }),
      createTarget('blog_post', { apiType: 'LIST' }),
    ]);

    const schemaTypeNames = Array.from(
      source.matchAll(/export type (\w+)Schema =/g),
      (match) => match[1] ?? '',
    );
    const listResponseTypeNames = Array.from(
      source.matchAll(/export type (\w+)ListResponse =/g),
      (match) => match[1] ?? '',
    );

    expect(schemaTypeNames).toContain('BlogPost');
    expect(schemaTypeNames).toContain('BlogPost2');
    expect(new Set(schemaTypeNames).size).toBe(schemaTypeNames.length);
    expect(new Set(listResponseTypeNames).size).toBe(listResponseTypeNames.length);
  });
});
