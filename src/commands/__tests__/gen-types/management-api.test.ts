import { afterEach, describe, expect, it } from 'bun:test';
import { fetchApiList, fetchApiSchema } from '../../gen-types/management-api.js';
import type { ManagementClientConfig } from '../../gen-types/types.js';

const FIXTURE_CONFIG: ManagementClientConfig = {
  serviceDomain: 'sample',
  apiKey: 'secret',
};

const ORIGINAL_FETCH = globalThis.fetch;

function setMockFetch(
  implementation: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
): void {
  globalThis.fetch = implementation as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
});

describe('management-api', () => {
  it('fetchApiList は URL/ヘッダーを設定し、複数形式の一覧レスポンスを解析する', async () => {
    let requestedUrl = '';
    let apiKeyHeader = '';

    setMockFetch(async (input, init) => {
      const request = new Request(input, init);
      requestedUrl = request.url;
      apiKeyHeader = request.headers.get('X-MICROCMS-API-KEY') ?? '';

      return new Response(
        JSON.stringify({
          apis: [
            { endpoint: 'blog', type: 'LIST', name: 'Blog' },
            { apiEndpoint: 'news', apiType: 'OBJECT', apiName: 'News' },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });

    const list = await fetchApiList(FIXTURE_CONFIG);

    expect(requestedUrl).toBe('https://sample.microcms-management.io/api/v1/apis');
    expect(apiKeyHeader).toBe('secret');
    expect(list).toEqual([
      { apiEndpoint: 'blog', apiName: 'Blog', apiType: 'LIST' },
      { apiEndpoint: 'news', apiName: 'News', apiType: 'OBJECT' },
    ]);
  });

  it('fetchApiList は解析不能なレスポンスでエラーにする', async () => {
    setMockFetch(async () => new Response(JSON.stringify({ invalid: true }), { status: 200 }));

    await expect(fetchApiList(FIXTURE_CONFIG)).rejects.toThrow(
      'Failed to parse API list from Management API response.',
    );
  });

  it('fetchApiSchema は endpoint を URL エンコードし、無効フィールドを除外する', async () => {
    let requestedUrl = '';

    setMockFetch(async (input, init) => {
      const request = new Request(input, init);
      requestedUrl = request.url;

      return new Response(
        JSON.stringify({
          apiEndpoint: 'blog/news',
          apiType: 'LIST',
          apiFields: [
            { fieldId: 'title', kind: 'text', required: true },
            { kind: 'number' },
            {
              fieldId: 'related',
              kind: 'relation',
              referencedApiEndpoint: 'articles',
            },
          ],
          customFields: [
            {
              createdAt: 'cf-1',
              fieldId: 'hero',
              fields: [{ fieldId: 'caption', kind: 'text' }],
            },
            {
              createdAt: '',
              fieldId: 'invalid',
              fields: [],
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      );
    });

    const schema = await fetchApiSchema(FIXTURE_CONFIG, 'blog/news');

    expect(requestedUrl).toBe('https://sample.microcms-management.io/api/v1/apis/blog%2Fnews');
    expect(schema.apiType).toBe('LIST');
    expect(schema.apiEndpoint).toBe('blog/news');
    expect(schema.apiFields).toEqual([
      {
        fieldId: 'title',
        kind: 'text',
        required: true,
        multipleSelect: false,
        referencedApiEndpoint: undefined,
        customFieldCreatedAt: undefined,
        customFieldCreatedAtList: undefined,
      },
      {
        fieldId: 'related',
        kind: 'relation',
        required: false,
        multipleSelect: false,
        referencedApiEndpoint: 'articles',
        customFieldCreatedAt: undefined,
        customFieldCreatedAtList: undefined,
      },
    ]);
    expect(schema.customFields).toEqual([
      {
        createdAt: 'cf-1',
        fieldId: 'hero',
        fields: [
          {
            fieldId: 'caption',
            kind: 'text',
            required: false,
            multipleSelect: false,
            referencedApiEndpoint: undefined,
            customFieldCreatedAt: undefined,
            customFieldCreatedAtList: undefined,
          },
        ],
      },
    ]);
  });

  it('401 応答時は API キー向けの専用エラーメッセージを返す', async () => {
    setMockFetch(async () => new Response('invalid key', { status: 401, statusText: 'Unauthorized' }));

    await expect(fetchApiList(FIXTURE_CONFIG)).rejects.toThrow(
      'Management API authentication failed (401). Check MICROCMS_API_KEY. invalid key',
    );
  });

  it('403 応答時は権限不足向けの専用エラーメッセージを返す', async () => {
    setMockFetch(async () => new Response('no permission', { status: 403, statusText: 'Forbidden' }));

    await expect(fetchApiSchema(FIXTURE_CONFIG, 'blog')).rejects.toThrow(
      'Management API authorization failed (403). Ensure "API情報の取得" is enabled for the key. no permission',
    );
  });
});
