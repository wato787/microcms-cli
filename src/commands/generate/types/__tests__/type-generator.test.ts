import { describe, expect, it } from 'bun:test';
import { renderDefinitionsFile } from '../type-generator.js';
import type { GenerationTarget, ManagementApiSchema } from '../types.js';

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

  it('OBJECT API は ObjectContent を使い、ListResponse を生成しない', () => {
    const source = renderDefinitionsFile([
      createTarget('settings', {
        apiType: 'object',
        schema: createSchema({
          apiFields: [{ fieldId: 'siteName', kind: 'text', required: true, multipleSelect: false }],
        }),
      }),
    ]);

    expect(source).toContain('export type SettingsContent = SettingsSchema & MicroCMSObjectContent;');
    expect(source).not.toContain('SettingsListResponse');
  });

  it('select フィールドは multipleSelect に関わらず常に string[] を生成する', () => {
    const source = renderDefinitionsFile([
      createTarget('product', {
        apiType: 'LIST',
        schema: createSchema({
          apiFields: [
            { fieldId: 'category', kind: 'select', required: true, multipleSelect: false },
            { fieldId: 'tags', kind: 'select', required: false, multipleSelect: true },
          ],
        }),
      }),
    ]);

    expect(source).toContain('category: string[];');
    expect(source).toContain('tags?: string[];');
    expect(source).not.toMatch(/category: string;/);
  });

  it('select フィールドに selectItems がある場合、文字列リテラルユニオンの配列型を生成する', () => {
    const source = renderDefinitionsFile([
      createTarget('product', {
        apiType: 'LIST',
        schema: createSchema({
          apiFields: [
            {
              fieldId: 'size',
              kind: 'select',
              required: true,
              multipleSelect: false,
              selectItems: ['S', 'M', 'L', 'XL'],
            },
          ],
        }),
      }),
    ]);

    expect(source).toContain('size: ("S" | "M" | "L" | "XL")[];');
  });

  it('relationList フィールドは参照先エンドポイントの Content 型を配列で生成する', () => {
    const source = renderDefinitionsFile([
      createTarget('article', {
        apiType: 'LIST',
        schema: createSchema({
          apiFields: [
            {
              fieldId: 'relatedPosts',
              kind: 'relationList',
              required: false,
              multipleSelect: false,
              referencedApiEndpoint: 'blog',
            },
            {
              fieldId: 'authors',
              kind: 'relationList',
              required: true,
              multipleSelect: false,
            },
          ],
        }),
      }),
    ]);

    expect(source).toContain('relatedPosts?: BlogContent[];');
    expect(source).toContain('authors: MicroCMSContentId[];');
  });

  it('custom/repeater の不正・未知データを安全にフォールバックして型生成する', () => {
    const source = renderDefinitionsFile([
      createTarget('page', {
        apiType: 'LIST',
        schema: createSchema({
          apiFields: [
            {
              fieldId: 'hero section',
              kind: 'custom',
              required: false,
              multipleSelect: false,
            },
            {
              fieldId: 'blocks',
              kind: 'repeater',
              required: false,
              multipleSelect: false,
              customFieldCreatedAtList: ['cf-1', 'missing-custom'],
            },
          ],
          customFields: [
            {
              createdAt: 'cf-1',
              fieldId: 'block-a',
              fields: [],
            },
          ],
        }),
      }),
    ]);

    expect(source).toContain('"hero section"?: Record<string, unknown>;');
    expect(source).toContain('export type PageBlockACustomField = Record<string, never>;');
    expect(source).toContain('fieldId: "block-a"');
    expect(source).toContain('Record<string, unknown>');
  });
});
