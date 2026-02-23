import { toPascalCase, toTypePropertyName } from './shared.js';
import type { GenerationTarget, ManagementApiField, ManagementCustomField } from './types.js';

interface GenerationContext {
  endpointBaseTypeName: string;
  customFieldByCreatedAt: Map<string, ManagementCustomField>;
  customTypeNameByCreatedAt: Map<string, string>;
  usedCustomTypeNames: Set<string>;
  emittedCustomTypeNames: Set<string>;
  processingCustomFieldIds: Set<string>;
  emittedCustomTypeBlocks: string[];
}

export function normalizeApiType(apiType?: string): 'LIST' | 'OBJECT' {
  return apiType?.toUpperCase() === 'OBJECT' ? 'OBJECT' : 'LIST';
}

function getUniqueName(baseName: string, usedNames: Set<string>): string {
  let candidate = baseName;
  let suffix = 2;

  while (usedNames.has(candidate)) {
    candidate = `${baseName}${suffix}`;
    suffix += 1;
  }

  usedNames.add(candidate);
  return candidate;
}

function getUniqueTypeName(baseName: string, context: GenerationContext): string {
  return getUniqueName(baseName, context.usedCustomTypeNames);
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

function emitCustomFieldType(createdAt: string, context: GenerationContext): string {
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

  const fieldLines = customField.fields.map((field) => renderTypePropertyLine(field, context));

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
    case 'richEditorOld':
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
    case 'file':
      return 'MicroCMSFile';
    case 'relation': {
      const refType = field.referencedApiEndpoint
        ? `${toPascalCase(field.referencedApiEndpoint)}Content`
        : 'MicroCMSContentId';
      return `${refType} | null`;
    }
    case 'relationList':
      return field.referencedApiEndpoint
        ? `${toPascalCase(field.referencedApiEndpoint)}Content[]`
        : 'MicroCMSContentId[]';
    case 'select': {
      if (field.selectItems && field.selectItems.length > 0) {
        const union = field.selectItems.map((item) => JSON.stringify(item)).join(' | ');
        return `(${union})[]`;
      }
      return 'string[]';
    }
    case 'iframe':
    case 'extension':
      return 'Record<string, unknown>';
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

function renderTypePropertyLine(field: ManagementApiField, context: GenerationContext): string {
  const propertyName = toTypePropertyName(field.fieldId);
  const optionalMark = field.required ? '' : '?';
  const typeExpression = resolveFieldType(field, context);
  return `  ${propertyName}${optionalMark}: ${typeExpression};`;
}

function renderEndpointType(target: GenerationTarget, endpointBaseTypeName: string): string {
  const endpoint = target.endpoint;
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

  const schemaTypeName = `${endpointBaseTypeName}Schema`;
  const contentTypeName = `${endpointBaseTypeName}Content`;

  const rootFieldLines = target.schema.apiFields.map((field) =>
    renderTypePropertyLine(field, context),
  );

  const responseTypeBlock =
    apiType === 'LIST'
      ? `\nexport type ${endpointBaseTypeName}ListResponse = MicroCMSListResponse<${schemaTypeName}>;`
      : '';

  const customTypesBlock =
    context.emittedCustomTypeBlocks.length > 0
      ? `${context.emittedCustomTypeBlocks.join('\n\n')}\n\n`
      : '';

  const schemaTypeBlock =
    rootFieldLines.length === 0
      ? `export type ${schemaTypeName} = Record<string, never>;`
      : [`export type ${schemaTypeName} = {`, ...rootFieldLines, '};'].join('\n');

  const contentTypeBlock =
    apiType === 'OBJECT'
      ? `export type ${contentTypeName} = ${schemaTypeName} & MicroCMSObjectContent;`
      : `export type ${contentTypeName} = ${schemaTypeName} & MicroCMSListContent;`;

  return [
    `// Endpoint schema from Management API: ${endpoint} (${apiType})`,
    '',
    customTypesBlock + schemaTypeBlock,
    '',
    contentTypeBlock + responseTypeBlock,
    '',
  ].join('\n');
}

export function renderDefinitionsFile(targets: GenerationTarget[]): string {
  const sortedTargets = [...targets].sort((a, b) => a.endpoint.localeCompare(b.endpoint));
  const usedEndpointBaseTypeNames = new Set<string>();

  const commonTypesBlock = [
    '// Generated by microcms generate:types.',
    '// Source: microCMS Management API (/api/v1/apis, /api/v1/apis/{endpoint}).',
    '// Note: This command does not fetch content from microCMS Content API.',
    '// DO NOT EDIT.',
    '',
    'export interface MicroCMSContentId {',
    '  id: string;',
    '}',
    '',
    'export interface MicroCMSDate {',
    '  createdAt: string;',
    '  updatedAt: string;',
    '  publishedAt?: string;',
    '  revisedAt?: string;',
    '}',
    '',
    'export interface MicroCMSImage {',
    '  url: string;',
    '  width?: number;',
    '  height?: number;',
    '  alt?: string;',
    '}',
    '',
    'export interface MicroCMSFile {',
    '  url: string;',
    '  fileSize?: number;',
    '}',
    '',
    'export interface MicroCMSListResponse<T> {',
    '  contents: (T & MicroCMSListContent)[];',
    '  totalCount: number;',
    '  limit: number;',
    '  offset: number;',
    '}',
    '',
    'export type MicroCMSListContent = MicroCMSContentId & MicroCMSDate;',
    'export type MicroCMSObjectContent = MicroCMSDate;',
    '',
  ].join('\n');

  const endpointBlocks = sortedTargets
    .map((target) => {
      const endpointBaseTypeName = getUniqueName(
        toPascalCase(target.endpoint),
        usedEndpointBaseTypeNames,
      );
      return renderEndpointType(target, endpointBaseTypeName);
    })
    .join('\n');
  return [commonTypesBlock, endpointBlocks].join('\n');
}
