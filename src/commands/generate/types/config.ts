import path from 'node:path';
import { DEFAULT_OUTPUT_FILE_NAME, DEFAULT_OUTPUT_PATH } from './constants.js';
import { toStringValue } from '../../../utils/index.js';
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

function resolveRequiredConfig(
  optionValue: string | undefined,
  envKey: string,
  cliFlag: string,
): string {
  const value = toStringValue(optionValue) ?? toStringValue(process.env[envKey]);
  if (value) return value;

  const envDir = process.env.__MICROCMS_CLI_ENV_DIR ?? process.cwd();
  throw new Error(
    `${envKey} is required. You can also pass ${cliFlag}.\n` +
      `(Searched for .env / .env.local in: ${envDir}. CWD: ${process.cwd()})`,
  );
}

export function resolveConfig(options: GenTypesOptions): ManagementClientConfig {
  return {
    serviceDomain: resolveRequiredConfig(
      options.serviceDomain,
      'MICROCMS_SERVICE_DOMAIN',
      '--service-domain',
    ),
    apiKey: resolveRequiredConfig(options.apiKey, 'MICROCMS_API_KEY', '--api-key'),
  };
}

export function resolveSingleEndpoint(endpointId: string | undefined): string {
  const resolved = toStringValue(endpointId);
  if (!resolved) {
    throw new Error('endpointId is required unless --all is specified.');
  }
  return resolved;
}
