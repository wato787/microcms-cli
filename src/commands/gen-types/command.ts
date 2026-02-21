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
): Promise<string | undefined> {
  if (schema.apiType) {
    return schema.apiType;
  }

  try {
    const apiList = await fetchApiList(config);
    return resolveApiTypeByEndpoint(apiList, endpoint);
  } catch (error) {
    console.warn(
      `[warn] Failed to resolve apiType for "${endpoint}" from /apis: ${toErrorMessage(error)}`,
    );
    return undefined;
  }
}

export async function genTypesCommand(
  endpointId: string | undefined,
  options: GenTypesOptions,
): Promise<void> {
  try {
    const all = Boolean(options.all);
    if (all && endpointId) {
      console.warn('[warn] endpointId is ignored because --all is specified.');
    }

    const outputFilePath = resolveOutputFilePath(options.output);
    const config = resolveConfig(options);
    fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });

    const targets: GenerationTarget[] = [];
    if (all) {
      const apiList = getTargetEndpoints(await fetchApiList(config));
      if (apiList.length === 0) {
        throw new Error('No endpoints found from Management API.');
      }

      for (const api of apiList) {
        const schema = await fetchApiSchema(config, api.apiEndpoint);
        targets.push(createGenerationTarget(api.apiEndpoint, schema, api.apiType));
      }
    } else {
      const endpoint = resolveSingleEndpoint(endpointId);
      const schema = await fetchApiSchema(config, endpoint);
      const apiType = await resolveSingleEndpointApiType(config, endpoint, schema);

      if (!apiType && !schema.apiType) {
        console.warn(
          `[warn] apiType for "${endpoint}" could not be resolved. Falling back to LIST.`,
        );
      }

      targets.push(createGenerationTarget(endpoint, schema, apiType));
    }

    const source = renderDefinitionsFile(targets);
    fs.writeFileSync(outputFilePath, source, 'utf-8');

    console.log(`Generated ${targets.length} endpoint type(s): ${outputFilePath}`);
  } catch (error) {
    console.error('Error:', toErrorMessage(error));
    process.exit(1);
  }
}
