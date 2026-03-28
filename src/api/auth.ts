import { jsonError } from './errors';
import { isUuid } from './uuid';

export { isUuid } from './uuid';

function jwtPayloadJson(b64url: string): unknown {
  let b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const json = atob(b64);
  return JSON.parse(json) as unknown;
}

export function decodeJwtSub(token: string): string | null {
  const parts = token.split('.');
  const payloadPart = parts[1];
  if (parts.length < 2 || payloadPart === undefined) return null;
  try {
    const payload = jwtPayloadJson(payloadPart) as { sub?: unknown };
    const sub = payload.sub;
    return typeof sub === 'string' ? sub : null;
  } catch {
    return null;
  }
}

/** Resolve `User.id` from request headers, or return a JSON error `Response`. */
export function resolveAuthUserId(req: Request): string | Response {
  const mode = process.env.AUTH_MODE ?? 'production';
  const devHeader = req.headers.get('X-Dev-User-Id');

  if (mode === 'development') {
    if (!devHeader?.trim()) {
      return jsonError(401, 'unauthorized', 'X-Dev-User-Id is required when AUTH_MODE=development');
    }
    if (!isUuid(devHeader.trim())) {
      return jsonError(401, 'unauthorized', 'X-Dev-User-Id must be a valid UUID');
    }
    return devHeader.trim();
  }

  if (devHeader?.trim()) {
    return jsonError(
      403,
      'dev_header_in_prod',
      'X-Dev-User-Id is not allowed when AUTH_MODE is not development'
    );
  }

  const auth = req.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) {
    return jsonError(401, 'unauthorized', 'Missing Authorization bearer token');
  }
  const token = auth.slice('Bearer '.length).trim();
  if (!token) {
    return jsonError(401, 'unauthorized', 'Empty bearer token');
  }

  const sub = decodeJwtSub(token);
  if (!sub || !isUuid(sub)) {
    return jsonError(401, 'unauthorized', 'Invalid bearer token');
  }
  return sub;
}
