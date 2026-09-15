import { ApiProblem } from './api-problem';

/** JSON object shape shared by most POST/PATCH bodies. */
export type JsonBody = Record<string, unknown>;

function invalidBody(message: string): ApiProblem {
  return new ApiProblem(422, 'invalid_body', message);
}

/** Narrow `body` to a JSON object or throw 422 `invalid_body`. */
export function asObject(body: unknown): JsonBody {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw invalidBody('Request body must be a JSON object');
  }
  return body as JsonBody;
}

/** Narrow `body` to a JSON array or throw 422 `invalid_body`. */
export function asArray(body: unknown): unknown[] {
  if (!Array.isArray(body)) {
    throw invalidBody('Request body must be a JSON array');
  }
  return body;
}

/** Required, non-blank string field. */
export function requiredString(o: JsonBody, field: string): string {
  const v = o[field];
  if (typeof v !== 'string' || v.trim() === '') {
    throw invalidBody(`${field} is required`);
  }
  return v;
}

/** Optional string field; rejects null. Use `optionalNullableString` for `string | null`. */
export function optionalString(o: JsonBody, field: string): string | undefined {
  const v = o[field];
  if (v === undefined) return undefined;
  if (typeof v !== 'string') {
    throw invalidBody(`${field} must be a string`);
  }
  return v;
}

/** Optional `string | null` field. */
export function optionalNullableString(o: JsonBody, field: string): string | null | undefined {
  const v = o[field];
  if (v === undefined || v === null) return v;
  if (typeof v !== 'string') {
    throw invalidBody(`${field} must be a string or null`);
  }
  return v;
}

/** Optional boolean field. */
export function optionalBoolean(o: JsonBody, field: string): boolean | undefined {
  const v = o[field];
  if (v === undefined) return undefined;
  if (typeof v !== 'boolean') {
    throw invalidBody(`${field} must be a boolean`);
  }
  return v;
}

/** Required field constrained to `values`. */
export function requiredEnum<T extends string>(
  o: JsonBody,
  field: string,
  values: readonly T[]
): T {
  const v = o[field];
  if (v === undefined) {
    throw invalidBody(`${field} is required`);
  }
  if (typeof v !== 'string' || !values.includes(v as T)) {
    throw invalidBody(`${field} must be one of: ${values.join(', ')}`);
  }
  return v as T;
}

/** Optional field constrained to `values`. */
export function optionalEnum<T extends string>(
  o: JsonBody,
  field: string,
  values: readonly T[]
): T | undefined {
  const v = o[field];
  if (v === undefined) return undefined;
  if (typeof v !== 'string' || !values.includes(v as T)) {
    throw invalidBody(`${field} must be one of: ${values.join(', ')}`);
  }
  return v as T;
}

/** Optional `string[]` field. */
export function optionalStringArray(o: JsonBody, field: string): string[] | undefined {
  const v = o[field];
  if (v === undefined) return undefined;
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) {
    throw invalidBody(`${field} must be an array of strings`);
  }
  return v as string[];
}

/** Optional nested JSON object field (validated further by the caller). */
export function optionalObject(o: JsonBody, field: string): JsonBody | undefined {
  const v = o[field];
  if (v === undefined) return undefined;
  if (v === null || typeof v !== 'object' || Array.isArray(v)) {
    throw invalidBody(`${field} must be an object`);
  }
  return v as JsonBody;
}
