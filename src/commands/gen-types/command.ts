import fs from 'node:fs';
import path from 'node:path';
import { resolveConfig, resolveOutputFilePath, resolveSingleEndpoint } from './config.js';
import { fetchApiList, fetchApiSchema } from './management-api.js';
import { toErrorMessage } from './shared.js';
import { renderDefinitionsFile } from './type-generator.js';
import type {
  ApiListItem,
  GenerationTarget,
  GenTypesOptions,
  ManagementApiSchema,
  ManagementClientConfig,
} from './types.js';

export interface GenTypesCommandDeps {
  resolveOutputFilePath: (outputOption?: string) => string;
  resolveConfig: (options: GenTypesOptions) => ManagementClientConfig;
  resolveSingleEndpoint: (endpointId: string | undefined) => string;
  fetchApiList: (config: ManagementClientConfig) => Promise<ApiListItem[]>;
  fetchApiSchema: (
    config: ManagementClientConfig,
    endpointId: string,
  ) => Promise<ManagementApiSchema>;
  renderDefinitionsFile: (targets: GenerationTarget[]) => string;
  mkdirSync: (
    path: string,
    options?: fs.MakeDirectoryOptions & {
      recursive?: boolean | undefined;
    },
  ) => void;
  writeFileSync: (
    file: string,
    data: string,
    options?: BufferEncoding,
  ) => void;
  warn: (message: string) => void;
  log: (message: string) => void;
  error: (...args: unknown[]) => void;
  exit: (code: number) => void;
}

function getTargetEndpoints(apiList: ApiListItem[]): ApiListItem[] {
  const deduped = new Map<string, ApiListItem>();
  for (const api of apiList) {
    if (!deduped.has(api.apiEndpoint)) {
      deduped.set(api.apiEndpoint, api);
    }
  }

  return Array.from(deduped.values()).sort((a, b) =>
    a.apiEndpoint.localeCompare(b.apiEndpoint),
  );
}

function createGenerationTarget(
  endpoint: string,
  schema: ManagementApiSchema,
  apiType?: string,
): GenerationTarget {
  return {
    endpoint,
    apiType,
    schema: {
      ...schema,
      apiEndpoint: schema.apiEndpoint ?? endpoint,
    },
  };
}

function resolveApiTypeByEndpoint(
  apiList: ApiListItem[],
  endpoint: string,
): string | undefined {
  return apiList.find((item) => item.apiEndpoint === endpoint)?.apiType;
}

async function resolveSingleEndpointApiType(
  config: ManagementClientConfig,
  endpoint: string,
  schema: ManagementApiSchema,
  fetchApiListFn: (config: ManagementClientConfig) => Promise<ApiListItem[]>,
  warn: (message: string) => void,
): Promise<string | undefined> {
  if (schema.apiType) {
    return schema.apiType;
  }

  try {
    const apiList = await fetchApiListFn(config);
    return resolveApiTypeByEndpoint(apiList, endpoint);
  } catch (error) {
    warn(
      `[warn] Failed to resolve apiType for "${endpoint}" from /apis: ${toErrorMessage(error)}`,
    );
    return undefined;
  }
}

const defaultGenTypesCommandDeps: GenTypesCommandDeps = {
  resolveOutputFilePath,
  resolveConfig,
  resolveSingleEndpoint,
  fetchApiList,
  fetchApiSchema,
  renderDefinitionsFile,
  mkdirSync: fs.mkdirSync,
  writeFileSync: fs.writeFileSync,
  warn: console.warn,
  log: console.log,
  error: console.error,
  exit: process.exit,
};

async function runGenTypesCommand(
  endpointId: string | undefined,
  options: GenTypesOptions,
  deps: GenTypesCommandDeps,
): Promise<void> {
  try {
    const all = Boolean(options.all);
    if (all && endpointId) {
      deps.warn('[warn] endpointId is ignored because --all is specified.');
    }

    const outputFilePath = deps.resolveOutputFilePath(options.output);
    const config = deps.resolveConfig(options);
    deps.mkdirSync(path.dirname(outputFilePath), { recursive: true });

    const targets: GenerationTarget[] = [];
    if (all) {
      const apiList = getTargetEndpoints(await deps.fetchApiList(config));
      if (apiList.length === 0) {
        throw new Error('No endpoints found from Management API.');
      }

      for (const api of apiList) {
        const schema = await deps.fetchApiSchema(config, api.apiEndpoint);
        targets.push(createGenerationTarget(api.apiEndpoint, schema, api.apiType));
      }
    } else {
      const endpoint = deps.resolveSingleEndpoint(endpointId);
      const schema = await deps.fetchApiSchema(config, endpoint);
      const apiType = await resolveSingleEndpointApiType(
        config,
        endpoint,
        schema,
        deps.fetchApiList,
        deps.warn,
      );

      if (!apiType && !schema.apiType) {
        deps.warn(
          `[warn] apiType for "${endpoint}" could not be resolved. Falling back to LIST.`,
        );
      }

      targets.push(createGenerationTarget(endpoint, schema, apiType));
    }

    const source = deps.renderDefinitionsFile(targets);
    deps.writeFileSync(outputFilePath, source, 'utf-8');

    deps.log(`Generated ${targets.length} endpoint type(s): ${outputFilePath}`);
  } catch (error) {
    deps.error('Error:', toErrorMessage(error));
    deps.exit(1);
  }
}

export function createGenTypesCommand(
  overrides: Partial<GenTypesCommandDeps> = {},
): (
  endpointId: string | undefined,
  options: GenTypesOptions,
) => Promise<void> {
  const deps: GenTypesCommandDeps = {
    ...defaultGenTypesCommandDeps,
    ...overrides,
  };

  return async (endpointId: string | undefined, options: GenTypesOptions) => {
    await runGenTypesCommand(endpointId, options, deps);
  };
}

export async function genTypesCommand(
  endpointId: string | undefined,
  options: GenTypesOptions,
): Promise<void> {
  await runGenTypesCommand(endpointId, options, defaultGenTypesCommandDeps);
}
