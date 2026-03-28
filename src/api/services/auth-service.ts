import { createHash, timingSafeEqual } from 'node:crypto';
import { Prisma, type PrismaClient } from '@prisma/client';
import type { AuthTokenEnvelopeDto } from '../../domain/dtos/auth';
import { toUserId } from '../../domain/types/ids';
import { normalizeEmail } from '../../domain/lib/normalize-email';
import { ApiProblem } from '../api-problem';
import { hashPassword, verifyPassword } from '../password';
import { signAccessToken } from '../jwt-access';

export const MIN_PASSWORD_LENGTH = 10;

/** Minimum plaintext invite token length before hashing (matches ≥32-byte secrets when encoded). */
export const MIN_INVITE_TOKEN_CHARS = 32;

export type RegistrationCreateInput = {
  kind: 'create';
  email: string;
  password: string;
  displayName: string | null;
  householdName: string | null;
};

export type RegistrationJoinInput = {
  kind: 'join';
  email: string;
  password: string;
  displayName: string | null;
  inviteToken: string;
};

export type ParsedRegistrationInput = RegistrationCreateInput | RegistrationJoinInput;

function isPlausibleEmail(email: string): boolean {
  if (email.length > 320) return false;
  const at = email.indexOf('@');
  if (at <= 0 || at === email.length - 1) return false;
  return email.slice(at + 1).includes('.');
}

function timingSafeEqualUtf8(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function sha256HexUtf8(plaintext: string): string {
  return createHash('sha256').update(plaintext, 'utf8').digest('hex');
}

function requireObject(body: unknown): Record<string, unknown> {
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw new ApiProblem(422, 'invalid_body', 'Request body must be a JSON object');
  }
  return body as Record<string, unknown>;
}

/**
 * Validates register JSON and returns either create-household or join-via-invite input.
 * @throws ApiProblem for 422-class validation errors.
 */
export function parseRegistrationBody(body: unknown): ParsedRegistrationInput {
  const o = requireObject(body);
  const emailRaw = o.email;
  const passwordRaw = o.password;
  if (typeof emailRaw !== 'string' || typeof passwordRaw !== 'string') {
    throw new ApiProblem(422, 'validation_error', 'email and password are required');
  }
  const email = normalizeEmail(emailRaw);
  if (!email) {
    throw new ApiProblem(422, 'validation_error', 'email is required');
  }
  if (!isPlausibleEmail(email)) {
    throw new ApiProblem(422, 'validation_error', 'email must be a valid address');
  }
  if (passwordRaw.length < MIN_PASSWORD_LENGTH) {
    throw new ApiProblem(
      422,
      'validation_error',
      `password must be at least ${MIN_PASSWORD_LENGTH} characters`
    );
  }

  let displayName: string | null = null;
  if ('displayName' in o) {
    const d = o.displayName;
    if (d === null) displayName = null;
    else if (typeof d === 'string') displayName = d;
    else throw new ApiProblem(422, 'validation_error', 'displayName must be a string or null');
  }

  const hasHouseholdNameKey = 'householdName' in o;
  const inviteRaw = o.householdInviteToken;
  if ('householdInviteToken' in o && typeof inviteRaw !== 'string') {
    throw new ApiProblem(422, 'validation_error', 'householdInviteToken must be a string');
  }
  const inviteToken = typeof inviteRaw === 'string' ? inviteRaw.trim() : '';
  const hasNonEmptyInvite = inviteToken.length > 0;

  if (hasNonEmptyInvite && hasHouseholdNameKey) {
    throw new ApiProblem(
      422,
      'invalid_registration_body',
      'Cannot combine householdName with householdInviteToken'
    );
  }

  if (hasNonEmptyInvite) {
    if (inviteToken.length < MIN_INVITE_TOKEN_CHARS) {
      throw new ApiProblem(422, 'validation_error', 'householdInviteToken has invalid length');
    }
    return {
      kind: 'join',
      email,
      password: passwordRaw,
      displayName,
      inviteToken,
    };
  }

  let householdName: string | null = null;
  if (hasHouseholdNameKey) {
    const h = o.householdName;
    if (h === null) householdName = null;
    else if (typeof h === 'string') householdName = h;
    else throw new ApiProblem(422, 'validation_error', 'householdName must be a string or null');
  }

  return {
    kind: 'create',
    email,
    password: passwordRaw,
    displayName,
    householdName,
  };
}

export function parseLoginBody(body: unknown): { email: string; password: string } {
  const o = requireObject(body);
  const emailRaw = o.email;
  const passwordRaw = o.password;
  if (typeof emailRaw !== 'string' || typeof passwordRaw !== 'string') {
    throw new ApiProblem(422, 'validation_error', 'email and password are required');
  }
  const email = normalizeEmail(emailRaw);
  if (!email) {
    throw new ApiProblem(422, 'validation_error', 'email is required');
  }
  if (!isPlausibleEmail(email)) {
    throw new ApiProblem(422, 'validation_error', 'email must be a valid address');
  }
  return { email, password: passwordRaw };
}

async function buildTokenEnvelope(
  userId: string,
  email: string,
  displayName: string | null
): Promise<AuthTokenEnvelopeDto> {
  const { token, expiresIn } = await signAccessToken(userId);
  return {
    accessToken: token,
    tokenType: 'Bearer',
    expiresIn,
    user: {
      id: toUserId(userId),
      email,
      displayName,
    },
  };
}

/**
 * Register: create household (OWNER) or join via invitation (MEMBER).
 */
export async function register(prisma: PrismaClient, body: unknown): Promise<AuthTokenEnvelopeDto> {
  const parsed = parseRegistrationBody(body);
  const passwordHash = await hashPassword(parsed.password);

  if (parsed.kind === 'create') {
    const householdLabel = parsed.householdName?.trim() ? parsed.householdName.trim() : 'Home';
    try {
      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: parsed.email,
            passwordHash,
            displayName: parsed.displayName,
          },
        });
        const membershipCount = await tx.householdMembership.count({ where: { userId: user.id } });
        if (membershipCount > 0) {
          throw new ApiProblem(409, 'membership_exists', 'User already belongs to a household');
        }
        const household = await tx.household.create({
          data: { name: householdLabel },
        });
        await tx.householdMembership.create({
          data: {
            userId: user.id,
            householdId: household.id,
            role: 'OWNER',
          },
        });
        return user;
      });
      return await buildTokenEnvelope(result.id, result.email, result.displayName);
    } catch (e) {
      if (e instanceof ApiProblem) throw e;
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ApiProblem(409, 'email_taken', 'An account with this email already exists');
      }
      throw e;
    }
  }

  const tokenHash = sha256HexUtf8(parsed.inviteToken);
  try {
    const user = await prisma.$transaction(async (tx) => {
      const invite = await tx.householdInvitation.findUnique({
        where: { tokenHash },
      });
      const now = new Date();
      if (!invite || invite.usedAt !== null || invite.expiresAt <= now) {
        throw new ApiProblem(422, 'invite_invalid', 'Invitation is invalid or expired');
      }
      const inviteEmailNorm = normalizeEmail(invite.email);
      if (!timingSafeEqualUtf8(inviteEmailNorm, parsed.email)) {
        throw new ApiProblem(422, 'invite_email_mismatch', 'Invitation email does not match');
      }
      const created = await tx.user.create({
        data: {
          email: parsed.email,
          passwordHash,
          displayName: parsed.displayName,
        },
      });
      const membershipCount = await tx.householdMembership.count({ where: { userId: created.id } });
      if (membershipCount > 0) {
        throw new ApiProblem(409, 'membership_exists', 'User already belongs to a household');
      }
      await tx.householdMembership.create({
        data: {
          userId: created.id,
          householdId: invite.householdId,
          role: 'MEMBER',
        },
      });
      await tx.householdInvitation.update({
        where: { id: invite.id },
        data: {
          usedAt: new Date(),
          usedByUserId: created.id,
        },
      });
      return created;
    });
    return await buildTokenEnvelope(user.id, user.email, user.displayName);
  } catch (e) {
    if (e instanceof ApiProblem) throw e;
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      throw new ApiProblem(409, 'email_taken', 'An account with this email already exists');
    }
    throw e;
  }
}

const INVALID_LOGIN_MESSAGE = 'Invalid email or password';

/**
 * Login with normalized email + password. Unknown email, wrong password, and OAuth-only users share one message.
 */
export async function login(prisma: PrismaClient, body: unknown): Promise<AuthTokenEnvelopeDto> {
  const { email, password } = parseLoginBody(body);
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user?.passwordHash) {
    throw new ApiProblem(401, 'invalid_credentials', INVALID_LOGIN_MESSAGE);
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    throw new ApiProblem(401, 'invalid_credentials', INVALID_LOGIN_MESSAGE);
  }
  return await buildTokenEnvelope(user.id, user.email, user.displayName);
}
