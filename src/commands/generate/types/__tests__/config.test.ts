import path from 'node:path';
import { afterEach, describe, expect, it } from 'bun:test';
import { resolveConfig, resolveOutputFilePath, resolveSingleEndpoint } from '../config.js';

const ORIGINAL_ENV = {
  serviceDomain: process.env.MICROCMS_SERVICE_DOMAIN,
  apiKey: process.env.MICROCMS_API_KEY,
  envDir: process.env.__MICROCMS_CLI_ENV_DIR,
};

function restoreEnv(): void {
  if (ORIGINAL_ENV.serviceDomain === undefined) {
    delete process.env.MICROCMS_SERVICE_DOMAIN;
  } else {
    process.env.MICROCMS_SERVICE_DOMAIN = ORIGINAL_ENV.serviceDomain;
  }

  if (ORIGINAL_ENV.apiKey === undefined) {
    delete process.env.MICROCMS_API_KEY;
  } else {
    process.env.MICROCMS_API_KEY = ORIGINAL_ENV.apiKey;
  }

  if (ORIGINAL_ENV.envDir === undefined) {
    delete process.env.__MICROCMS_CLI_ENV_DIR;
  } else {
    process.env.__MICROCMS_CLI_ENV_DIR = ORIGINAL_ENV.envDir;
  }
}

afterEach(() => {
  restoreEnv();
});

describe('config', () => {
  it('出力先がディレクトリ指定なら microcms.d.ts を補完する', () => {
    const resolved = resolveOutputFilePath('./tmp/types');
    expect(resolved).toBe(path.join(process.cwd(), 'tmp/types/microcms.d.ts'));
  });

  it('出力先が .d.ts 指定ならそのまま使う（大文字拡張子も許容）', () => {
    const lower = resolveOutputFilePath('./tmp/types/custom.d.ts');
    const upper = resolveOutputFilePath('./tmp/types/CUSTOM.D.TS');

    expect(lower).toBe(path.join(process.cwd(), 'tmp/types/custom.d.ts'));
    expect(upper).toBe(path.join(process.cwd(), 'tmp/types/CUSTOM.D.TS'));
  });

  it('resolveConfig は CLI 引数を環境変数より優先する', () => {
    process.env.MICROCMS_SERVICE_DOMAIN = 'env-domain';
    process.env.MICROCMS_API_KEY = 'env-key';

    const config = resolveConfig({
      serviceDomain: ' cli-domain ',
      apiKey: ' cli-key ',
    });

    expect(config).toEqual({
      serviceDomain: 'cli-domain',
      apiKey: 'cli-key',
    });
  });

  it('resolveConfig は不足時に探索情報つきでエラーを返す', () => {
    delete process.env.MICROCMS_SERVICE_DOMAIN;
    delete process.env.MICROCMS_API_KEY;
    process.env.__MICROCMS_CLI_ENV_DIR = '/tmp/project-env';

    expect(() => resolveConfig({})).toThrow('MICROCMS_SERVICE_DOMAIN is required.');
    expect(() => resolveConfig({})).toThrow('(Searched for .env / .env.local in: /tmp/project-env.');
  });

  it('resolveSingleEndpoint は trim して返し、空値は拒否する', () => {
    expect(resolveSingleEndpoint('  blog  ')).toBe('blog');
    expect(() => resolveSingleEndpoint('   ')).toThrow(
      'endpointId is required unless --all is specified.',
    );
  });
});
