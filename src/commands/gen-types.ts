import fs from 'node:fs';
import path from 'node:path';

const DEFAULT_OUTPUT_DIR = './types';
const DEFAULT_OUTPUT_FILE_NAME = 'microcms.d.ts';
const MANAGEMENT_API_BASE_DOMAIN = 'microcms-management.io';

export interface GenTypesOptions {
  output?: string;
  all?: boolean;
  serviceDomain?: string;
  apiKey?: string;
}

interface ManagementClientConfig {
  serviceDomain: string;
  apiKey: string;
}

interface ApiListItem {
  apiEndpoint: string;
  apiName?: string;
  apiType?: string;
}

interface ManagementApiField {
  fieldId: string;
  kind: string;
  required: boolean;
  multipleSelect: boolean;
  customFieldCreatedAt?: string;
  customFieldCreatedAtList?: string[];
}

interface ManagementCustomField {
  createdAt: string;
  fieldId: string;
  fields: ManagementApiField[];
}

interface ManagementApiSchema {
  apiFields: ManagementApiField[];
  customFields: ManagementCustomField[];
  apiType?: string;
  apiEndpoint?: string;
  apiName?: string;
}

interface GenerationTarget {
  endpoint: string;
  apiType?: string;
  schema: ManagementApiSchema;
}

interface GenerationContext {
  endpointBaseTypeName: string;
  customFieldByCreatedAt: Map<string, ManagementCustomField>;
  customTypeNameByCreatedAt: Map<string, string>;
  usedCustomTypeNames: Set<string>;
  emittedCustomTypeNames: Set<string>;
  processingCustomFieldIds: Set<string>;
  emittedCustomTypeBlocks: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toStringValue(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function toBooleanValue(value: unknown): boolean | undefined {
  return typeof value === 'boolean' ? value : undefined;
}

function toStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const values = value
    .map((item) => toStringValue(item))
    .filter((item): item is string => item !== undefined);

  return values.length > 0 ? values : undefined;
}

function parseApiField(rawField: unknown): ManagementApiField | null {
  if (!isRecord(rawField)) {
    return null;
  }

  const fieldId = toStringValue(rawField.fieldId);
  const kind = toStringValue(rawField.kind);

  if (!fieldId || !kind) {
    return null;
  }

  return {
    fieldId,
    kind,
    required: toBooleanValue(rawField.required) ?? false,
    multipleSelect: toBooleanValue(rawField.multipleSelect) ?? false,
    customFieldCreatedAt: toStringValue(rawField.customFieldCreatedAt),
    customFieldCreatedAtList: toStringArray(rawField.customFieldCreatedAtList),
  };
}

function parseCustomField(rawCustomField: unknown): ManagementCustomField | null {
  if (!isRecord(rawCustomField)) {
    return null;
  }

  const createdAt = toStringValue(rawCustomField.createdAt);
  const fieldId = toStringValue(rawCustomField.fieldId);
  const fields = Array.isArray(rawCustomField.fields)
    ? rawCustomField.fields
        .map((field) => parseApiField(field))
        .filter((field): field is ManagementApiField => field !== null)
    : [];

  if (!createdAt || !fieldId) {
    return null;
  }

  return {
    createdAt,
    fieldId,
    fields,
  };
}

function parseApiSchema(rawSchema: unknown): ManagementApiSchema {
  if (!isRecord(rawSchema)) {
    throw new Error('Management API schema response is invalid.');
  }

  const apiFields = Array.isArray(rawSchema.apiFields)
    ? rawSchema.apiFields
        .map((field) => parseApiField(field))
        .filter((field): field is ManagementApiField => field !== null)
    : [];

  const customFields = Array.isArray(rawSchema.customFields)
    ? rawSchema.customFields
        .map((field) => parseCustomField(field))
        .filter((field): field is ManagementCustomField => field !== null)
    : [];

  return {
    apiFields,
    customFields,
    apiType: toStringValue(rawSchema.apiType),
    apiEndpoint: toStringValue(rawSchema.apiEndpoint),
    apiName: toStringValue(rawSchema.apiName),
  };
}

function parseApiListItem(rawItem: unknown): ApiListItem | null {
  if (!isRecord(rawItem)) {
    return null;
  }

  const apiEndpoint =
    toStringValue(rawItem.apiEndpoint) ?? toStringValue(rawItem.endpoint);

  if (!apiEndpoint) {
    return null;
  }

  return {
    apiEndpoint,
    apiName: toStringValue(rawItem.apiName) ?? toStringValue(rawItem.name),
    apiType: toStringValue(rawItem.apiType) ?? toStringValue(rawItem.type),
  };
}

function parseApiList(rawResponse: unknown): ApiListItem[] {
  const candidateArrays: unknown[][] = [];

  if (Array.isArray(rawResponse)) {
    candidateArrays.push(rawResponse);
  } else if (isRecord(rawResponse)) {
    for (const key of ['apis', 'contents', 'items', 'data']) {
      const value = rawResponse[key];
      if (Array.isArray(value)) {
        candidateArrays.push(value);
      }
    }

    candidateArrays.push([rawResponse]);
  }

  for (const items of candidateArrays) {
    const parsedItems = items
      .map((item) => parseApiListItem(item))
      .filter((item): item is ApiListItem => item !== null);
    if (parsedItems.length > 0) {
      return parsedItems;
    }
  }

  throw new Error('Failed to parse API list from Management API response.');
}

function toPascalCase(value: string): string {
  const chunks = value.split(/[^A-Za-z0-9]+/).filter((chunk) => chunk.length > 0);
  if (chunks.length === 0) {
    return 'Generated';
  }

  return chunks
    .map((chunk) => `${chunk.charAt(0).toUpperCase()}${chunk.slice(1)}`)
    .join('');
}

function toTypePropertyName(value: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) ? value : JSON.stringify(value);
}

function resolveOutputFilePath(outputOption: string): string {
  const resolvedPath = path.resolve(process.cwd(), outputOption);

  if (path.extname(resolvedPath) === '.d.ts') {
    return resolvedPath;
  }

  return path.join(resolvedPath, DEFAULT_OUTPUT_FILE_NAME);
}

function normalizeApiType(apiType?: string): 'LIST' | 'OBJECT' {
  return apiType?.toUpperCase() === 'OBJECT' ? 'OBJECT' : 'LIST';
}

function buildManagementApiUrl(serviceDomain: string, resourcePath: string): string {
  return `https://${serviceDomain}.${MANAGEMENT_API_BASE_DOMAIN}/api/v1/${resourcePath}`;
}

function resolveConfig(options: GenTypesOptions): ManagementClientConfig {
  const serviceDomain =
    toStringValue(options.serviceDomain) ??
    toStringValue(process.env.MICROCMS_SERVICE_DOMAIN);
  if (!serviceDomain) {
    throw new Error(
      'MICROCMS_SERVICE_DOMAIN is required. You can also pass --service-domain.',
    );
  }

  const apiKey =
    toStringValue(options.apiKey) ??
    toStringValue(process.env.MICROCMS_MANAGEMENT_API_KEY) ??
    toStringValue(process.env.MICROCMS_API_KEY);

  if (!apiKey) {
    throw new Error(
      'MICROCMS_MANAGEMENT_API_KEY or MICROCMS_API_KEY is required. You can also pass --api-key.',
    );
  }

  return { serviceDomain, apiKey };
}

async function fetchFromManagementApi(
  url: string,
  apiKey: string,
): Promise<unknown> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-MICROCMS-API-KEY': apiKey,
      'Content-Type': 'application/json',
      'User-Agent': 'microcms-cli',
    },
  });

  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(
      `Management API request failed (${response.status} ${response.statusText}): ${responseBody}`,
    );
  }

  return response.json();
}

async function fetchApiList(config: ManagementClientConfig): Promise<ApiListItem[]> {
  const url = buildManagementApiUrl(config.serviceDomain, 'apis');
  const rawResponse = await fetchFromManagementApi(url, config.apiKey);
  return parseApiList(rawResponse);
}

async function fetchApiSchema(
  config: ManagementClientConfig,
  endpointId: string,
): Promise<ManagementApiSchema> {
  const url = buildManagementApiUrl(
    config.serviceDomain,
    `apis/${encodeURIComponent(endpointId)}`,
  );
  const rawResponse = await fetchFromManagementApi(url, config.apiKey);
  return parseApiSchema(rawResponse);
}

function getUniqueTypeName(baseName: string, context: GenerationContext): string {
  let candidate = baseName;
  let suffix = 2;

  while (context.usedCustomTypeNames.has(candidate)) {
    candidate = `${baseName}${suffix}`;
    suffix += 1;
  }

  context.usedCustomTypeNames.add(candidate);
  return candidate;
}

function resolveCustomFieldTypeName(
  createdAt: string,
  context: GenerationContext,
): string | undefined {
  const existing = context.customTypeNameByCreatedAt.get(createdAt);
  if (existing) {
    return existing;
  }

  const customField = context.customFieldByCreatedAt.get(createdAt);
  if (!customField) {
    return undefined;
  }

  const baseName = `${context.endpointBaseTypeName}${toPascalCase(customField.fieldId)}CustomField`;
  const uniqueName = getUniqueTypeName(baseName, context);
  context.customTypeNameByCreatedAt.set(createdAt, uniqueName);
  return uniqueName;
}

function emitCustomFieldType(
  createdAt: string,
  context: GenerationContext,
): string {
  const typeName = resolveCustomFieldTypeName(createdAt, context);
  if (!typeName) {
    return 'Record<string, unknown>';
  }

  if (context.emittedCustomTypeNames.has(typeName)) {
    return typeName;
  }

  if (context.processingCustomFieldIds.has(createdAt)) {
    return 'Record<string, unknown>';
  }

  const customField = context.customFieldByCreatedAt.get(createdAt);
  if (!customField) {
    return 'Record<string, unknown>';
  }

  context.processingCustomFieldIds.add(createdAt);

  const fieldLines = customField.fields.map((field) =>
    renderTypePropertyLine(field, context),
  );

  const typeBlock =
    fieldLines.length === 0
      ? `export type ${typeName} = Record<string, never>;`
      : [`export type ${typeName} = {`, ...fieldLines, '};'].join('\n');

  context.emittedCustomTypeBlocks.push(typeBlock);
  context.emittedCustomTypeNames.add(typeName);
  context.processingCustomFieldIds.delete(createdAt);

  return typeName;
}

function resolveFieldType(field: ManagementApiField, context: GenerationContext): string {
  switch (field.kind) {
    case 'text':
    case 'textArea':
    case 'richEditor':
    case 'richEditorV2':
    case 'date':
      return 'string';
    case 'number':
      return 'number';
    case 'boolean':
      return 'boolean';
    case 'media':
      return 'MicroCMSImage';
    case 'mediaList':
      return 'MicroCMSImage[]';
    case 'relation':
      return 'MicroCMSRelation';
    case 'relationList':
      return 'MicroCMSRelation[]';
    case 'select':
      return field.multipleSelect ? 'string[]' : 'string';
    case 'custom':
      if (!field.customFieldCreatedAt) {
        return 'Record<string, unknown>';
      }
      return emitCustomFieldType(field.customFieldCreatedAt, context);
    case 'repeater': {
      const customFieldCreatedAtList = field.customFieldCreatedAtList ?? [];
      if (customFieldCreatedAtList.length === 0) {
        return 'Array<Record<string, unknown>>';
      }

      const itemTypes = customFieldCreatedAtList.map((createdAt) => {
        const customField = context.customFieldByCreatedAt.get(createdAt);
        if (!customField) {
          return 'Record<string, unknown>';
        }
        const customTypeName = emitCustomFieldType(createdAt, context);
        return `({ fieldId: ${JSON.stringify(customField.fieldId)} } & ${customTypeName})`;
      });

      return `Array<${itemTypes.join(' | ')}>`;
    }
    default:
      return 'unknown';
  }
}

function renderTypePropertyLine(
  field: ManagementApiField,
  context: GenerationContext,
): string {
  const propertyName = toTypePropertyName(field.fieldId);
  const optionalMark = field.required ? '' : '?';
  const typeExpression = resolveFieldType(field, context);
  return `  ${propertyName}${optionalMark}: ${typeExpression};`;
}

function renderEndpointType(target: GenerationTarget): string {
  const endpoint = target.endpoint;
  const endpointBaseTypeName = toPascalCase(endpoint);
  const apiType = normalizeApiType(target.schema.apiType ?? target.apiType);

  const context: GenerationContext = {
    endpointBaseTypeName,
    customFieldByCreatedAt: new Map(
      target.schema.customFields.map((field) => [field.createdAt, field]),
    ),
    customTypeNameByCreatedAt: new Map(),
    usedCustomTypeNames: new Set(),
    emittedCustomTypeNames: new Set(),
    processingCustomFieldIds: new Set(),
    emittedCustomTypeBlocks: [],
  };

  const contentTypeName = `${endpointBaseTypeName}Content`;
  const baseTypeName =
    apiType === 'OBJECT' ? 'MicroCMSObjectContent' : 'MicroCMSListContent';

  const rootFieldLines = target.schema.apiFields.map((field) =>
    renderTypePropertyLine(field, context),
  );

  let responseTypeBlock = '';
  if (apiType === 'LIST') {
    responseTypeBlock = `\nexport type ${endpointBaseTypeName}ListResponse = MicroCMSListResponse<${contentTypeName}>;`;
  }

  const customTypesBlock =
    context.emittedCustomTypeBlocks.length > 0
      ? `${context.emittedCustomTypeBlocks.join('\n\n')}\n\n`
      : '';

  const contentTypeBlock =
    rootFieldLines.length === 0
      ? `export type ${contentTypeName} = ${baseTypeName};`
      : [`export type ${contentTypeName} = ${baseTypeName} & {`, ...rootFieldLines, '};'].join(
          '\n',
        );

  return [
    `// Endpoint: ${endpoint}`,
    '',
    customTypesBlock + contentTypeBlock + responseTypeBlock,
    '',
  ].join('\n');
}

function renderDefinitionsFile(targets: GenerationTarget[]): string {
  const commonTypesBlock = [
    '// Generated by microcms gen-types. DO NOT EDIT.',
    '',
    'export type MicroCMSDate = {',
    '  createdAt: string;',
    '  updatedAt: string;',
    '  publishedAt?: string;',
    '  revisedAt?: string;',
    '};',
    '',
    'export type MicroCMSListContent = {',
    '  id: string;',
    '} & MicroCMSDate;',
    '',
    'export type MicroCMSObjectContent = MicroCMSDate;',
    '',
    'export type MicroCMSListResponse<T> = {',
    '  contents: T[];',
    '  totalCount: number;',
    '  limit: number;',
    '  offset: number;',
    '};',
    '',
    'export type MicroCMSImage = {',
    '  url: string;',
    '  width?: number;',
    '  height?: number;',
    '  alt?: string;',
    '};',
    '',
    "export type MicroCMSRelation = { id: string } & Record<string, unknown>;",
    '',
  ].join('\n');

  const endpointBlocks = targets.map((target) => renderEndpointType(target)).join('\n');

  return [commonTypesBlock, endpointBlocks].join('\n');
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

function resolveSingleEndpoint(endpointId: string | undefined): string {
  const resolved = toStringValue(endpointId);
  if (!resolved) {
    throw new Error('endpointId is required unless --all is specified.');
  }
  return resolved;
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

export async function genTypesCommand(
  endpointId: string | undefined,
  options: GenTypesOptions,
): Promise<void> {
  try {
    const all = Boolean(options.all);
    const outputPath = options.output ?? DEFAULT_OUTPUT_DIR;
    const outputFilePath = resolveOutputFilePath(outputPath);
    const config = resolveConfig(options);

    fs.mkdirSync(path.dirname(outputFilePath), { recursive: true });

    const targets: GenerationTarget[] = [];
    if (all) {
      const apiList = await fetchApiList(config);
      const targetApis = getTargetEndpoints(apiList);
      for (const api of targetApis) {
        const schema = await fetchApiSchema(config, api.apiEndpoint);
        targets.push(createGenerationTarget(api.apiEndpoint, schema, api.apiType));
      }
    } else {
      const endpoint = resolveSingleEndpoint(endpointId);
      const schema = await fetchApiSchema(config, endpoint);
      targets.push(createGenerationTarget(endpoint, schema));
    }

    if (targets.length === 0) {
      throw new Error('No endpoints found from Management API.');
    }

    const source = renderDefinitionsFile(targets);
    fs.writeFileSync(outputFilePath, source, 'utf-8');

    console.log(
      `Generated ${targets.length} endpoint type(s) in ${outputFilePath}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error:', message);
    process.exit(1);
  }
}
