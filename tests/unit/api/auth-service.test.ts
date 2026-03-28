import { describe, expect, it } from 'bun:test';
import { ApiProblem } from '../../../src/api/api-problem';
import {
  MIN_INVITE_TOKEN_CHARS,
  MIN_PASSWORD_LENGTH,
  parseLoginBody,
  parseRegistrationBody,
} from '../../../src/api/services/auth-service';

function expectApiProblem(e: unknown, status: number, code: string) {
  expect(e).toBeInstanceOf(ApiProblem);
  const p = e as ApiProblem;
  expect(p.status).toBe(status);
  expect(p.code).toBe(code);
}

describe('parseRegistrationBody', () => {
  it('parses create path with defaults', () => {
    const p = parseRegistrationBody({
      email: '  A@B.COM ',
      password: 'a'.repeat(MIN_PASSWORD_LENGTH),
    });
    expect(p.kind).toBe('create');
    if (p.kind !== 'create') return;
    expect(p.email).toBe('a@b.com');
    expect(p.householdName).toBeNull();
    expect(p.displayName).toBeNull();
  });

  it('parses create path with householdName', () => {
    const p = parseRegistrationBody({
      email: 'u@example.org',
      password: 'b'.repeat(MIN_PASSWORD_LENGTH),
      householdName: 'Vegan HQ',
    });
    expect(p.kind).toBe('create');
    if (p.kind !== 'create') return;
    expect(p.householdName).toBe('Vegan HQ');
  });

  it('parses join path', () => {
    const token = 't'.repeat(MIN_INVITE_TOKEN_CHARS);
    const p = parseRegistrationBody({
      email: 'u@example.org',
      password: 'c'.repeat(MIN_PASSWORD_LENGTH),
      householdInviteToken: token,
    });
    expect(p.kind).toBe('join');
    if (p.kind !== 'join') return;
    expect(p.inviteToken).toBe(token);
  });

  it('rejects ambiguous body (householdName + invite token)', () => {
    try {
      parseRegistrationBody({
        email: 'u@example.org',
        password: 'd'.repeat(MIN_PASSWORD_LENGTH),
        householdName: 'Home',
        householdInviteToken: 'x'.repeat(MIN_INVITE_TOKEN_CHARS),
      });
      expect.unreachable();
    } catch (e) {
      expectApiProblem(e, 422, 'invalid_registration_body');
    }
  });

  it('rejects join when householdName key is present', () => {
    try {
      parseRegistrationBody({
        email: 'u@example.org',
        password: 'e'.repeat(MIN_PASSWORD_LENGTH),
        householdName: null,
        householdInviteToken: 'y'.repeat(MIN_INVITE_TOKEN_CHARS),
      });
      expect.unreachable();
    } catch (e) {
      expectApiProblem(e, 422, 'invalid_registration_body');
    }
  });

  it('rejects short invite token before hash', () => {
    try {
      parseRegistrationBody({
        email: 'u@example.org',
        password: 'f'.repeat(MIN_PASSWORD_LENGTH),
        householdInviteToken: 'short',
      });
      expect.unreachable();
    } catch (e) {
      expectApiProblem(e, 422, 'validation_error');
    }
  });

  it('rejects weak password', () => {
    try {
      parseRegistrationBody({
        email: 'u@example.org',
        password: 'short',
      });
      expect.unreachable();
    } catch (e) {
      expectApiProblem(e, 422, 'validation_error');
    }
  });

  it('rejects bad email shape', () => {
    try {
      parseRegistrationBody({
        email: 'not-an-email',
        password: 'g'.repeat(MIN_PASSWORD_LENGTH),
      });
      expect.unreachable();
    } catch (e) {
      expectApiProblem(e, 422, 'validation_error');
    }
  });

  it('allows create with empty invite token string (treated as create)', () => {
    const p = parseRegistrationBody({
      email: 'u@example.org',
      password: 'h'.repeat(MIN_PASSWORD_LENGTH),
      householdInviteToken: '',
    });
    expect(p.kind).toBe('create');
  });
});

describe('parseLoginBody', () => {
  it('normalizes email', () => {
    const p = parseLoginBody({
      email: '  X@Y.Z  ',
      password: 'secret-password-10',
    });
    expect(p.email).toBe('x@y.z');
  });

  it('rejects invalid email for login', () => {
    try {
      parseLoginBody({ email: 'nope', password: 'secret-password-10' });
      expect.unreachable();
    } catch (e) {
      expectApiProblem(e, 422, 'validation_error');
    }
  });
});
