import path from 'node:path';
import { DEFAULT_OUTPUT_FILE_NAME, DEFAULT_OUTPUT_PATH } from './constants.js';
import { toStringValue } from './shared.js';
import type { GenTypesOptions, ManagementClientConfig } from './types.js';

function isDeclarationFilePath(filePath: string): boolean {
  return filePath.toLowerCase().endsWith('.d.ts');
}

export function resolveOutputFilePath(outputOption?: string): string {
  const outputPath = outputOption ?? DEFAULT_OUTPUT_PATH;
  const resolvedPath = path.resolve(process.cwd(), outputPath);

  if (isDeclarationFilePath(resolvedPath)) {
    return resolvedPath;
  }

  return path.join(resolvedPath, DEFAULT_OUTPUT_FILE_NAME);
}

export function resolveConfig(options: GenTypesOptions): ManagementClientConfig {
  const serviceDomain =
    toStringValue(options.serviceDomain) ??
    toStringValue(process.env.MICROCMS_SERVICE_DOMAIN);
  if (!serviceDomain) {
    const envDir = process.env.__MICROCMS_CLI_ENV_DIR ?? process.cwd();
    throw new Error(
      'MICROCMS_SERVICE_DOMAIN is required. You can also pass --service-domain.\n' +
        `(Searched for .env / .env.local in: ${envDir}. CWD: ${process.cwd()})`,
    );
  }

  const apiKey =
    toStringValue(options.apiKey) ??
    toStringValue(process.env.MICROCMS_MANAGEMENT_API_KEY);
  if (!apiKey) {
    const envDir = process.env.__MICROCMS_CLI_ENV_DIR ?? process.cwd();
    throw new Error(
      'MICROCMS_MANAGEMENT_API_KEY is required. You can also pass --api-key.\n' +
        `(Searched for .env / .env.local in: ${envDir}. CWD: ${process.cwd()})`,
    );
  }

  return { serviceDomain, apiKey };
}

export function resolveSingleEndpoint(endpointId: string | undefined): string {
  const resolved = toStringValue(endpointId);
  if (!resolved) {
    throw new Error('endpointId is required unless --all is specified.');
  }
  return resolved;
}
