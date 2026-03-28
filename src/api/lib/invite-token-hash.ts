import { createHash } from 'node:crypto';

/** SHA-256 hex of UTF-8 plaintext; must match registration consume path (`auth-service`). */
export function hashInviteTokenPlaintext(plaintext: string): string {
  return createHash('sha256').update(plaintext, 'utf8').digest('hex');
}
