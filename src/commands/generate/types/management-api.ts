import { MANAGEMENT_API_BASE_DOMAIN } from './constants.js';
import { isRecord, toBooleanValue, toStringArray, toStringValue } from './shared.js';
import type {
  ApiListItem,
  ManagementApiField,
  ManagementApiSchema,
  ManagementClientConfig,
  ManagementCustomField,
} from './types.js';

function buildManagementApiUrl(serviceDomain: string, resourcePath: string): string {
  return `https://${serviceDomain}.${MANAGEMENT_API_BASE_DOMAIN}/api/v1/${resourcePath}`;
}

async function fetchFromManagementApi(url: string, apiKey: string): Promise<unknown> {
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'X-MICROCMS-API-KEY': apiKey,
    },
  });

  if (!response.ok) {
    const responseBody = await response.text();
    if (response.status === 401) {
      throw new Error(
        `Management API authentication failed (401). Check MICROCMS_API_KEY. ${responseBody}`,
      );
    }
    if (response.status === 403) {
      throw new Error(
        `Management API authorization failed (403). Ensure "API情報の取得" is enabled for the key. ${responseBody}`,
      );
    }
    throw new Error(
      `Management API request failed (${response.status} ${response.statusText}): ${responseBody}`,
    );
  }

  return response.json();
}

function parseSelectItems(rawItems: unknown): string[] | undefined {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return undefined;
  }

  const values = rawItems
    .map((item) => {
      if (typeof item === 'string') {
        return item;
      }
      if (isRecord(item) && typeof item.value === 'string') {
        return item.value;
      }
      return undefined;
    })
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
    referencedApiEndpoint: toStringValue(rawField.referencedApiEndpoint),
    customFieldCreatedAt: toStringValue(rawField.customFieldCreatedAt),
    customFieldCreatedAtList: toStringArray(rawField.customFieldCreatedAtList),
    selectItems: parseSelectItems(rawField.selectItems),
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

  const apiEndpoint = toStringValue(rawItem.apiEndpoint) ?? toStringValue(rawItem.endpoint);
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

export async function fetchApiList(config: ManagementClientConfig): Promise<ApiListItem[]> {
  const url = buildManagementApiUrl(config.serviceDomain, 'apis');
  const rawResponse = await fetchFromManagementApi(url, config.apiKey);
  return parseApiList(rawResponse);
}

export async function fetchApiSchema(
  config: ManagementClientConfig,
  endpointId: string,
): Promise<ManagementApiSchema> {
  const url = buildManagementApiUrl(config.serviceDomain, `apis/${encodeURIComponent(endpointId)}`);
  const rawResponse = await fetchFromManagementApi(url, config.apiKey);
  return parseApiSchema(rawResponse);
}
