import { describe, expect, it } from 'bun:test';
import { createGenTypesCommand } from '../command.js';
import type {
  ApiListItem,
  GenerationTarget,
  GenTypesOptions,
  ManagementClientConfig,
} from '../types.js';
import { createSchema } from './helpers.js';

const FIXTURE_CONFIG: ManagementClientConfig = {
  serviceDomain: 'test-service',
  apiKey: 'test-key',
};

function createHarness(
  overrides: {
    resolveOutputFilePath?: (outputOption?: string) => string;
    resolveConfig?: (options: GenTypesOptions) => ManagementClientConfig;
    resolveSingleEndpoint?: (endpointId: string | undefined) => string;
    fetchApiList?: (config: ManagementClientConfig) => Promise<ApiListItem[]>;
    fetchApiSchema?: (
      config: ManagementClientConfig,
      endpointId: string,
    ) => Promise<ManagementApiSchema>;
    renderDefinitionsFile?: (targets: GenerationTarget[]) => string;
  } = {},
) {
  const calls = {
    fetchApiSchemaEndpoints: [] as string[],
    renderedTargets: [] as GenerationTarget[][],
    mkdir: [] as Array<{ targetPath: string; options?: unknown }>,
    write: [] as Array<{ filePath: string; source: string; encoding?: unknown }>,
    warn: [] as string[],
    log: [] as string[],
    error: [] as unknown[][],
    exit: [] as number[],
    resolveOutputArgs: [] as Array<string | undefined>,
  };

  const command = createGenTypesCommand({
    resolveOutputFilePath:
      overrides.resolveOutputFilePath ??
      ((outputOption?: string) => {
        calls.resolveOutputArgs.push(outputOption);
        return '/tmp/generated/microcms.d.ts';
      }),
    resolveConfig: overrides.resolveConfig ?? (() => FIXTURE_CONFIG),
    resolveSingleEndpoint:
      overrides.resolveSingleEndpoint ??
      ((endpointId: string | undefined) => {
        if (!endpointId) {
          throw new Error('endpointId is required');
        }
        return endpointId;
      }),
    fetchApiList: overrides.fetchApiList ?? (async () => []),
    fetchApiSchema:
      overrides.fetchApiSchema ??
      (async (_config: ManagementClientConfig, endpointId: string) => {
        calls.fetchApiSchemaEndpoints.push(endpointId);
        return createSchema({ apiEndpoint: endpointId });
      }),
    renderDefinitionsFile:
      overrides.renderDefinitionsFile ??
      ((targets: GenerationTarget[]) => {
        calls.renderedTargets.push(targets);
        return '// generated definitions';
      }),
    mkdirSync: (targetPath: string, options?: unknown) => {
      calls.mkdir.push({ targetPath, options });
    },
    writeFileSync: (filePath: string, source: string, encoding?: unknown) => {
      calls.write.push({ filePath, source, encoding });
    },
    warn: (message: string) => {
      calls.warn.push(message);
    },
    log: (message: string) => {
      calls.log.push(message);
    },
    error: (...args: unknown[]) => {
      calls.error.push(args);
    },
    exit: (code: number) => {
      calls.exit.push(code);
    },
  });

  return { command, calls };
}

describe('genTypesCommand', () => {
  it('--all 指定時は endpoint を重複排除し、ソートして生成する', async () => {
    const fetchApiListCalls: ManagementClientConfig[] = [];
    const fetchApiSchemaEndpoints: string[] = [];
    const { command, calls } = createHarness({
      fetchApiList: async (config: ManagementClientConfig) => {
        fetchApiListCalls.push(config);
        return [
          { apiEndpoint: 'news', apiType: 'OBJECT' },
          { apiEndpoint: 'blog', apiType: 'LIST' },
          { apiEndpoint: 'blog', apiType: 'OBJECT' },
        ];
      },
      fetchApiSchema: async (_config: ManagementClientConfig, endpointId: string) => {
        fetchApiSchemaEndpoints.push(endpointId);
        return endpointId === 'news' ? createSchema() : createSchema({ apiEndpoint: endpointId });
      },
    });

    await command('blog', { all: true, output: './custom/path.d.ts' });

    expect(fetchApiListCalls).toEqual([FIXTURE_CONFIG]);
    expect(fetchApiSchemaEndpoints).toEqual(['blog', 'news']);
    expect(calls.warn).toContain('[warn] endpointId is ignored because --all is specified.');

    expect(calls.renderedTargets).toHaveLength(1);
    const [targets] = calls.renderedTargets;
    expect(targets.map((target) => target.endpoint)).toEqual(['blog', 'news']);
    expect(targets[1]?.schema.apiEndpoint).toBe('news');

    expect(calls.write).toEqual([
      {
        filePath: '/tmp/generated/microcms.d.ts',
        source: '// generated definitions',
        encoding: 'utf-8',
      },
    ]);
    expect(calls.log).toEqual(['Generated 2 endpoint type(s): /tmp/generated/microcms.d.ts']);
    expect(calls.exit).toEqual([]);
  });

  it('単一 endpoint で schema.apiType があれば /apis 取得をスキップする', async () => {
    let fetchApiListCount = 0;
    const { command, calls } = createHarness({
      fetchApiList: async () => {
        fetchApiListCount += 1;
        return [];
      },
      fetchApiSchema: async (_config: ManagementClientConfig, endpointId: string) =>
        createSchema({
          apiEndpoint: endpointId,
          apiType: 'OBJECT',
        }),
    });

    await command('blog', {});

    expect(fetchApiListCount).toBe(0);
    expect(calls.renderedTargets).toHaveLength(1);
    expect(calls.renderedTargets[0]?.[0]).toMatchObject({
      endpoint: 'blog',
      apiType: 'OBJECT',
    });
    expect(calls.warn).toEqual([]);
    expect(calls.exit).toEqual([]);
  });

  it('単一 endpoint で schema.apiType が無い場合は /apis から apiType を補完する', async () => {
    let fetchApiListCount = 0;
    const { command, calls } = createHarness({
      fetchApiList: async () => {
        fetchApiListCount += 1;
        return [{ apiEndpoint: 'blog', apiType: 'OBJECT' }];
      },
      fetchApiSchema: async (_config: ManagementClientConfig, endpointId: string) =>
        createSchema({
          apiEndpoint: endpointId,
        }),
    });

    await command('blog', {});

    expect(fetchApiListCount).toBe(1);
    expect(calls.renderedTargets[0]?.[0]).toMatchObject({
      endpoint: 'blog',
      apiType: 'OBJECT',
    });
    expect(calls.warn).toEqual([]);
    expect(calls.exit).toEqual([]);
  });

  it('apiType 解決に失敗した場合は警告し、LIST 扱いで生成する', async () => {
    const { command, calls } = createHarness({
      fetchApiList: async () => {
        throw new Error('temporarily unavailable');
      },
      fetchApiSchema: async (_config: ManagementClientConfig, endpointId: string) =>
        createSchema({
          apiEndpoint: endpointId,
        }),
    });

    await command('blog', {});

    expect(calls.warn).toHaveLength(2);
    expect(calls.warn[0]).toContain(
      'Failed to resolve apiType for "blog" from /apis: temporarily unavailable',
    );
    expect(calls.warn[1]).toBe(
      '[warn] apiType for "blog" could not be resolved. Falling back to LIST.',
    );
    expect(calls.renderedTargets[0]?.[0]).toMatchObject({
      endpoint: 'blog',
      apiType: undefined,
    });
    expect(calls.exit).toEqual([]);
  });

  it('--all で endpoint が 0 件ならエラーを出して終了する', async () => {
    const { command, calls } = createHarness({
      fetchApiList: async () => [],
    });

    await command(undefined, { all: true });

    expect(calls.error).toEqual([['Error:', 'No endpoints found from Management API.']]);
    expect(calls.exit).toEqual([1]);
    expect(calls.write).toEqual([]);
    expect(calls.log).toEqual([]);
  });

  it('output オプションを解決関数へ渡し、出力先ディレクトリを再帰作成する', async () => {
    const { command, calls } = createHarness({
      resolveOutputFilePath: (outputOption?: string) => {
        calls.resolveOutputArgs.push(outputOption);
        return '/tmp/generated/custom/microcms.d.ts';
      },
      fetchApiSchema: async (_config: ManagementClientConfig, endpointId: string) =>
        createSchema({
          apiEndpoint: endpointId,
          apiType: 'OBJECT',
        }),
    });

    await command('blog', { output: './my-types' });

    expect(calls.resolveOutputArgs).toEqual(['./my-types']);
    expect(calls.mkdir).toEqual([
      {
        targetPath: '/tmp/generated/custom',
        options: { recursive: true },
      },
    ]);
    expect(calls.write).toEqual([
      {
        filePath: '/tmp/generated/custom/microcms.d.ts',
        source: '// generated definitions',
        encoding: 'utf-8',
      },
    ]);
  });

  it('例外発生時はエラーを出力して exit(1) する', async () => {
    const { command, calls } = createHarness({
      resolveConfig: () => {
        throw new Error('missing MICROCMS_SERVICE_DOMAIN');
      },
    });

    await command('blog', {});

    expect(calls.error).toHaveLength(1);
    expect(calls.error[0]).toEqual(['Error:', 'missing MICROCMS_SERVICE_DOMAIN']);
    expect(calls.exit).toEqual([1]);
    expect(calls.write).toEqual([]);
    expect(calls.log).toEqual([]);
  });
});
