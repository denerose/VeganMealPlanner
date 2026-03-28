import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import { normalizeEmail } from '../../domain/lib/normalize-email';
import type { ApiContext } from '../handlers/me-household';
import { ApiProblem } from '../api-problem';
import { hashInviteTokenPlaintext } from '../lib/invite-token-hash';

export const DEFAULT_INVITE_EXPIRES_HOURS = 168;
export const MAX_INVITE_EXPIRES_HOURS = 168;
const TOKEN_BYTES = 32;

function isPlausibleEmail(email: string): boolean {
  if (email.length > 320) return false;
  const at = email.indexOf('@');
  if (at <= 0 || at === email.length - 1) return false;
  return email.slice(at + 1).includes('.');
}

function requireObject(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiProblem(422, 'invalid_body', 'Request body must be a JSON object');
  }
  return body as Record<string, unknown>;
}

export function parseCreateInvitationBody(body: unknown): {
  email: string;
  expiresInHours: number;
} {
  const o = requireObject(body);
  const emailRaw = o.email;
  if (typeof emailRaw !== 'string') {
    throw new ApiProblem(422, 'validation_error', 'email is required');
  }
  const email = normalizeEmail(emailRaw);
  if (!email) {
    throw new ApiProblem(422, 'validation_error', 'email is required');
  }
  if (!isPlausibleEmail(email)) {
    throw new ApiProblem(422, 'validation_error', 'email must be a valid address');
  }

  let expiresInHours = DEFAULT_INVITE_EXPIRES_HOURS;
  if ('expiresInHours' in o) {
    const v = o.expiresInHours;
    if (v === undefined) {
      expiresInHours = DEFAULT_INVITE_EXPIRES_HOURS;
    } else if (
      typeof v !== 'number' ||
      !Number.isInteger(v) ||
      v < 1 ||
      v > MAX_INVITE_EXPIRES_HOURS
    ) {
      throw new ApiProblem(
        422,
        'validation_error',
        `expiresInHours must be an integer from 1 to ${MAX_INVITE_EXPIRES_HOURS}`
      );
    } else {
      expiresInHours = v;
    }
  }

  return { email, expiresInHours };
}

export interface HouseholdInvitationCreatedDto {
  token: string;
  expiresAt: string;
  email: string;
  householdId: string;
}

export async function createHouseholdInvitation(
  prisma: PrismaClient,
  ctx: ApiContext,
  body: unknown
): Promise<HouseholdInvitationCreatedDto> {
  const parsed = parseCreateInvitationBody(body);
  const plaintext = randomBytes(TOKEN_BYTES).toString('base64url');
  const tokenHash = hashInviteTokenPlaintext(plaintext);
  const expiresAt = new Date(Date.now() + parsed.expiresInHours * 3600 * 1000);

  await prisma.householdInvitation.create({
    data: {
      householdId: ctx.householdId,
      email: parsed.email,
      tokenHash,
      createdByUserId: ctx.userId,
      expiresAt,
    },
  });

  return {
    token: plaintext,
    expiresAt: expiresAt.toISOString(),
    email: parsed.email,
    householdId: ctx.householdId,
  };
}
