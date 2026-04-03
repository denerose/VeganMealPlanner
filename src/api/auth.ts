import { jsonError } from './errors';
import { isJwtAccessVerifyFailure, verifyAccessToken } from './jwt-access';
import { isUuid } from './uuid';

export { isUuid } from './uuid';

/** Resolve `User.id` from request headers, or return a JSON error `Response`. */
export async function resolveAuthUserId(req: Request): Promise<string | Response> {
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

  try {
    const { sub } = await verifyAccessToken(token);
    if (!isUuid(sub)) {
      return jsonError(401, 'invalid_token', 'Access token subject must be a valid UUID');
    }
    return sub;
  } catch (e) {
    if (isJwtAccessVerifyFailure(e)) {
      return jsonError(401, 'invalid_token', 'Invalid or expired access token');
    }
    throw e;
  }
}
