import { client } from '../client';
import { saveToken, deleteTokenFile } from '../config';
import { required, requiredHidden, isInteractive } from '../prompt';
import { formatJson, formatRecord, formatDateTime } from '../format';
import type { ParsedFlags } from '../types';
import type { AuthTokenEnvelopeDto } from '../../domain/dtos/auth';
import type { MeResponseDto, UserPublicDto, UserPatchDto } from '../../domain/dtos/user';

export async function handleAuth(parsed: ParsedFlags): Promise<void> {
  const { args, flags, json } = parsed;
  const subcommand = args[0];

  switch (subcommand) {
    case 'login':
      await login(flags, json);
      break;
    case 'register':
      await register(flags, json);
      break;
    case 'logout':
      await logout(json);
      break;
    case 'whoami':
      await whoami(json);
      break;
    case 'profile':
      await profile(flags, json);
      break;
    default:
      console.log(`Usage: vmp auth <command>

Commands:
  login     Log in with email and password
  register  Register a new account
  logout    Log out and clear saved token
  whoami    Show current user and household
  profile   Update current user profile

Register flags:
  --email <email>                          Email
  --password <password>                    Password (min 10 chars)
  --display-name <name>                    Display name
  --household-name <name>                  Create household with this name
  --household-invite-token <token>         Join household with invite token

Profile flags:
  --display-name <name>                    Update display name`);
  }
}

async function login(flags: Record<string, string>, json: boolean): Promise<void> {
  const email = await required('Email', 'email', flags['--email']);
  const password = await requiredHidden('Password', 'password', flags['--password']);

  const res = await client.post<AuthTokenEnvelopeDto>('/api/auth/login', { email, password });
  await saveToken(res.accessToken);
  client.reset();

  if (json) {
    console.log(formatJson({ ...res, accessToken: '***saved***' }));
  } else {
    console.log(`Logged in as ${res.user.email}`);
    console.log(`Token saved to ~/.vmp-token`);
  }
}

async function register(flags: Record<string, string>, json: boolean): Promise<void> {
  const email = await required('Email', 'email', flags['--email']);
  let password = await requiredHidden('Password (min 10 chars)', 'password', flags['--password']);

  if (password.length < 10) {
    if (!isInteractive()) {
      throw new Error('Password must be at least 10 characters.');
    }
    while (password.length < 10) {
      console.error('Password must be at least 10 characters.');
      password = await requiredHidden('Password (min 10 chars)', 'password');
    }
  }

  const displayName = flags['--display-name']?.trim() || undefined;
  const householdName = flags['--household-name']?.trim() || undefined;
  const householdInviteToken = flags['--household-invite-token']?.trim() || undefined;

  const res = await client.post<AuthTokenEnvelopeDto>('/api/auth/register', {
    email,
    password,
    displayName: displayName ?? null,
    ...(householdName && { householdName }),
    ...(householdInviteToken && { householdInviteToken }),
  });

  await saveToken(res.accessToken);
  client.reset();

  if (json) {
    console.log(formatJson({ ...res, accessToken: '***saved***' }));
  } else {
    console.log(`Registered as ${res.user.email}`);
    console.log(`Token saved to ~/.vmp-token`);
  }
}

async function logout(json: boolean): Promise<void> {
  try {
    await client.post('/api/auth/logout', {});
  } catch {
    // logout endpoint is a no-op on the server; best-effort
  }
  await deleteTokenFile();

  if (json) {
    console.log(formatJson({ status: 'logged_out' }));
  } else {
    console.log('Logged out. Token file removed.');
  }
}

async function whoami(json: boolean): Promise<void> {
  const me = await client.get<MeResponseDto>('/api/me');

  if (json) {
    console.log(formatJson(me));
    return;
  }

  const { user, household, membershipRole } = me;
  console.log(
    formatRecord([
      ['User ID', user.id],
      ['Email', user.email],
      ['Display Name', user.displayName ?? '(not set)'],
      ['Created', formatDateTime(user.createdAt)],
      ['Household ID', household.id],
      ['Household Name', household.name ?? '(unnamed)'],
      ['Role', membershipRole],
    ])
  );
}

async function profile(flags: Record<string, string>, json: boolean): Promise<void> {
  const body: UserPatchDto = {};
  if ('--display-name' in flags) {
    body.displayName = flags['--display-name'] || null;
  }

  if (Object.keys(body).length === 0) {
    throw new Error('No fields to update. Use --display-name.');
  }

  const user = await client.patch<UserPublicDto>('/api/me', body);

  if (json) {
    console.log(formatJson(user));
  } else {
    console.log(`Updated profile: ${user.displayName ?? '(no display name)'} (${user.id})`);
  }
}
