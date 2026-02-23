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

  it('全フィールドタイプの型マッピングを正しく生成する', () => {
    const source = renderDefinitionsFile([
      createTarget('full-test', {
        apiType: 'LIST',
        schema: createSchema({
          apiFields: [
            { fieldId: 'title', kind: 'text', required: true, multipleSelect: false },
            { fieldId: 'body', kind: 'textArea', required: false, multipleSelect: false },
            { fieldId: 'content', kind: 'richEditor', required: false, multipleSelect: false },
            { fieldId: 'contentV2', kind: 'richEditorV2', required: false, multipleSelect: false },
            { fieldId: 'contentOld', kind: 'richEditorOld', required: false, multipleSelect: false },
            { fieldId: 'publishDate', kind: 'date', required: false, multipleSelect: false },
            { fieldId: 'order', kind: 'number', required: false, multipleSelect: false },
            { fieldId: 'isPublished', kind: 'boolean', required: true, multipleSelect: false },
            { fieldId: 'thumbnail', kind: 'media', required: false, multipleSelect: false },
            { fieldId: 'gallery', kind: 'mediaList', required: false, multipleSelect: false },
            { fieldId: 'document', kind: 'file', required: false, multipleSelect: false },
            {
              fieldId: 'category',
              kind: 'relation',
              required: false,
              multipleSelect: false,
              referencedApiEndpoint: 'categories',
            },
            {
              fieldId: 'relatedPosts',
              kind: 'relationList',
              required: false,
              multipleSelect: false,
              referencedApiEndpoint: 'blog',
            },
            {
              fieldId: 'status',
              kind: 'select',
              required: true,
              multipleSelect: false,
              selectItems: ['draft', 'published', 'archived'],
            },
            { fieldId: 'tags', kind: 'select', required: false, multipleSelect: true },
            { fieldId: 'widget', kind: 'iframe', required: false, multipleSelect: false },
            { fieldId: 'plugin', kind: 'extension', required: false, multipleSelect: false },
            {
              fieldId: 'hero',
              kind: 'custom',
              required: false,
              multipleSelect: false,
              customFieldCreatedAt: 'cf-hero',
            },
            {
              fieldId: 'sections',
              kind: 'repeater',
              required: false,
              multipleSelect: false,
              customFieldCreatedAtList: ['cf-text-block', 'cf-image-block'],
            },
            {
              fieldId: 'orphanRelation',
              kind: 'relation',
              required: false,
              multipleSelect: false,
            },
            {
              fieldId: 'orphanRelationList',
              kind: 'relationList',
              required: false,
              multipleSelect: false,
            },
            { fieldId: 'unknownKind', kind: 'futureType', required: false, multipleSelect: false },
          ],
          customFields: [
            {
              createdAt: 'cf-hero',
              fieldId: 'hero-banner',
              fields: [
                { fieldId: 'image', kind: 'media', required: true, multipleSelect: false },
                { fieldId: 'caption', kind: 'text', required: false, multipleSelect: false },
              ],
            },
            {
              createdAt: 'cf-text-block',
              fieldId: 'text-block',
              fields: [
                { fieldId: 'heading', kind: 'text', required: true, multipleSelect: false },
                { fieldId: 'paragraph', kind: 'richEditor', required: false, multipleSelect: false },
              ],
            },
            {
              createdAt: 'cf-image-block',
              fieldId: 'image-block',
              fields: [
                { fieldId: 'image', kind: 'media', required: true, multipleSelect: false },
                { fieldId: 'alt', kind: 'text', required: false, multipleSelect: false },
              ],
            },
          ],
        }),
      }),
    ]);

    // text → string
    expect(source).toContain('title: string;');
    // textArea → string (optional)
    expect(source).toContain('body?: string;');
    // richEditor → string
    expect(source).toContain('content?: string;');
    // richEditorV2 → string
    expect(source).toContain('contentV2?: string;');
    // richEditorOld → string
    expect(source).toContain('contentOld?: string;');
    // date → string
    expect(source).toContain('publishDate?: string;');
    // number → number
    expect(source).toContain('order?: number;');
    // boolean → boolean
    expect(source).toContain('isPublished: boolean;');
    // media → MicroCMSImage
    expect(source).toContain('thumbnail?: MicroCMSImage;');
    // mediaList → MicroCMSImage[]
    expect(source).toContain('gallery?: MicroCMSImage[];');
    // file → MicroCMSFile
    expect(source).toContain('document?: MicroCMSFile;');
    // relation (with endpoint) → XxxContent | null
    expect(source).toContain('category?: CategoriesContent | null;');
    // relationList (with endpoint) → XxxContent[]
    expect(source).toContain('relatedPosts?: BlogContent[];');
    // select (with selectItems) → literal union array
    expect(source).toContain('status: ("draft" | "published" | "archived")[];');
    // select (without selectItems) → string[]
    expect(source).toContain('tags?: string[];');
    // iframe → Record<string, unknown>
    expect(source).toContain('widget?: Record<string, unknown>;');
    // extension → Record<string, unknown>
    expect(source).toContain('plugin?: Record<string, unknown>;');
    // custom → custom type
    expect(source).toContain('hero?: FullTestHeroBannerCustomField;');
    // repeater → Array<union of custom types>
    expect(source).toMatch(/sections\?: Array<.*TextBlock.*ImageBlock/);
    // relation (without endpoint) → MicroCMSContentId | null
    expect(source).toContain('orphanRelation?: MicroCMSContentId | null;');
    // relationList (without endpoint) → MicroCMSContentId[]
    expect(source).toContain('orphanRelationList?: MicroCMSContentId[];');
    // unknown kind → unknown
    expect(source).toContain('unknownKind?: unknown;');

    // custom field types
    expect(source).toContain('export type FullTestHeroBannerCustomField = {');
    expect(source).toContain('export type FullTestTextBlockCustomField = {');
    expect(source).toContain('export type FullTestImageBlockCustomField = {');

    // LIST API generates ListResponse
    expect(source).toContain(
      'export type FullTestListResponse = MicroCMSListResponse<FullTestSchema>;',
    );
    // LIST API uses MicroCMSListContent
    expect(source).toContain(
      'export type FullTestContent = FullTestSchema & MicroCMSListContent;',
    );
  });

  it('共通型が microcms-js-sdk の型定義と一致する', () => {
    const source = renderDefinitionsFile([createTarget('dummy', { apiType: 'LIST' })]);

    // MicroCMSContentId
    expect(source).toContain('export interface MicroCMSContentId {');
    expect(source).toContain('  id: string;');

    // MicroCMSDate
    expect(source).toContain('export interface MicroCMSDate {');
    expect(source).toContain('  createdAt: string;');
    expect(source).toContain('  updatedAt: string;');
    expect(source).toContain('  publishedAt?: string;');
    expect(source).toContain('  revisedAt?: string;');

    // MicroCMSImage
    expect(source).toContain('export interface MicroCMSImage {');
    expect(source).toContain('  url: string;');
    expect(source).toContain('  width?: number;');
    expect(source).toContain('  height?: number;');
    expect(source).toContain('  alt?: string;');

    // MicroCMSListResponse
    expect(source).toContain('export interface MicroCMSListResponse<T> {');
    expect(source).toContain('  contents: (T & MicroCMSListContent)[];');
    expect(source).toContain('  totalCount: number;');
    expect(source).toContain('  limit: number;');
    expect(source).toContain('  offset: number;');

    // MicroCMSListContent / MicroCMSObjectContent
    expect(source).toContain(
      'export type MicroCMSListContent = MicroCMSContentId & MicroCMSDate;',
    );
    expect(source).toContain('export type MicroCMSObjectContent = MicroCMSDate;');
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
