export interface GenTypesOptions {
  output?: string;
  all?: boolean;
  serviceDomain?: string;
  apiKey?: string;
}

export interface ManagementClientConfig {
  serviceDomain: string;
  apiKey: string;
}

export interface ApiListItem {
  apiEndpoint: string;
  apiName?: string;
  apiType?: string;
}

export interface ManagementApiField {
  fieldId: string;
  kind: string;
  required: boolean;
  multipleSelect: boolean;
  referencedApiEndpoint?: string;
  customFieldCreatedAt?: string;
  customFieldCreatedAtList?: string[];
  selectItems?: string[];
}

export interface ManagementCustomField {
  createdAt: string;
  fieldId: string;
  fields: ManagementApiField[];
}

export interface ManagementApiSchema {
  apiFields: ManagementApiField[];
  customFields: ManagementCustomField[];
  apiType?: string;
  apiEndpoint?: string;
  apiName?: string;
}

export interface GenerationTarget {
  endpoint: string;
  apiType?: string;
  schema: ManagementApiSchema;
}
