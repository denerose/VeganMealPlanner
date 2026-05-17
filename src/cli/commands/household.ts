import { client } from '../client';
import { required } from '../prompt';
import { formatJson, formatTable, formatRecord, formatDateTime } from '../format';
import type { ParsedFlags } from '../types';
import type { HouseholdSummaryDto, HouseholdMemberDto } from '../../domain/dtos/user';

export async function handleHousehold(parsed: ParsedFlags): Promise<void> {
  const { args, flags, json } = parsed;
  const subcommand = args[0];

  switch (subcommand) {
    case 'show':
      await showHousehold(json);
      break;
    case 'update':
      await updateHousehold(flags, json);
      break;
    case 'members':
      await listMembers(json);
      break;
    case 'invite':
      await inviteMember(flags, json);
      break;
    default:
      console.log(`Usage: vmp household <command>

Commands:
  show              Show current household
  update            Update household name
  members           List household members
  invite            Invite someone to the household

Flags:
  --name <name>             Household name (update)
  --email <email>           Invitee email (invite)
  --expires-in-hours <n>    Invite expiry in hours (invite, default 168)
  --json                    Raw JSON output`);
  }
}

async function showHousehold(json: boolean): Promise<void> {
  const household = await client.get<HouseholdSummaryDto>('/api/household');

  if (json) {
    console.log(formatJson(household));
    return;
  }

  console.log(
    formatRecord([
      ['ID', household.id],
      ['Name', household.name ?? '(unnamed)'],
      ['Created', formatDateTime(household.createdAt)],
      ['Updated', formatDateTime(household.updatedAt)],
    ])
  );
}

async function updateHousehold(flags: Record<string, string>, json: boolean): Promise<void> {
  const name = flags['--name'];
  if (!name) {
    throw new Error('Missing required flag: --name');
  }

  const household = await client.patch<HouseholdSummaryDto>('/api/household', {
    name,
  });

  if (json) {
    console.log(formatJson(household));
  } else {
    console.log(`Updated household: ${household.name ?? '(unnamed)'}`);
  }
}

async function listMembers(json: boolean): Promise<void> {
  const members = await client.get<HouseholdMemberDto[]>('/api/household/members');

  if (json) {
    console.log(formatJson(members));
    return;
  }

  if (members.length === 0) {
    console.log('No members found.');
    return;
  }

  console.log(
    formatTable(
      ['User ID', 'Display Name', 'Role'],
      members.map((m) => [m.userId.slice(0, 8), m.displayName ?? '(unnamed)', m.role])
    )
  );
}

interface InvitationCreatedDto {
  token: string;
  expiresAt: string;
  email: string;
  householdId: string;
}

async function inviteMember(flags: Record<string, string>, json: boolean): Promise<void> {
  const email = await required('Email', 'email', flags['--email']);

  const body: Record<string, unknown> = { email };
  if (flags['--expires-in-hours']) {
    body.expiresInHours = Number(flags['--expires-in-hours']);
  }

  const invitation = await client.post<InvitationCreatedDto>('/api/household/invitations', body);

  if (json) {
    console.log(formatJson(invitation));
  } else {
    console.log(`Invitation created for ${invitation.email}`);
    console.log(`Token: ${invitation.token}`);
    console.log(`Expires: ${formatDateTime(invitation.expiresAt)}`);
    console.log();
    console.log('Share this token with the invitee so they can register:');
    console.log(
      `  vmp auth register --email ${invitation.email} --password <password> --household-invite-token ${invitation.token}`
    );
  }
}
