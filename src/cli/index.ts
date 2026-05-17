#!/usr/bin/env bun
import { handleAuth } from './commands/auth';
import { handleIngredients } from './commands/ingredients';
import { handleMeals } from './commands/meals';
import { handleDayPlans } from './commands/day-plans';
import { handleHousehold } from './commands/household';
import { ApiClientError, client } from './client';
import type { ParsedFlags } from './types';

const HELP = `Usage: vmp <command> [subcommand] [flags]

Commands:
  auth          Authentication (login, register, logout, whoami, profile)
  ingredients   Manage ingredients
  meals         Manage meals
  day-plans     Manage day plans
  household     Manage household
  health        Check API health and database connectivity

Global flags:
  --api-url <url>   API base URL (default: http://localhost:3000 or VMP_API_URL)
  --json            Output raw JSON
  --help            Show this help message

Environment variables:
  VMP_API_URL       API base URL
  VMP_TOKEN         Access token (overrides ~/.vmp-token file)
  VMP_DEV_USER_ID   Development-mode user ID (sets X-Dev-User-Id header)

Run "vmp <command>" without a subcommand to see subcommand help.
`;

interface ParsedArgs {
  json: boolean;
  apiUrl?: string;
  command: string | undefined;
  args: string[];
  flags: Record<string, string>;
  help: boolean;
}

function parseArgs(argv: string[]): ParsedArgs {
  // argv[0] = bun, argv[1] = script, rest = user args
  const raw = argv.slice(2);

  let json = false;
  let apiUrl: string | undefined;
  const positional: string[] = [];
  const flags: Record<string, string> = {};

  let i = 0;
  while (i < raw.length) {
    const arg = raw[i]!;
    if (arg === '--help' || arg === '-h') {
      // Handled below after parsing
      i++;
      continue;
    }
    if (arg === '--json') {
      json = true;
      i++;
      continue;
    }
    if (arg === '--api-url') {
      const val = raw[i + 1];
      if (!val || val.startsWith('--')) {
        console.error(`Error: --api-url requires a value.`);
        process.exit(1);
      }
      apiUrl = val;
      i += 2;
      continue;
    }
    if (arg.startsWith('--')) {
      // --flag value or --flag (boolean)
      const next = raw[i + 1];
      if (next && !next.startsWith('--')) {
        flags[arg] = next;
        i += 2;
      } else {
        flags[arg] = 'true';
        i++;
      }
      continue;
    }
    positional.push(arg);
    i++;
  }

  return {
    json,
    apiUrl,
    command: positional[0],
    args: positional.slice(1),
    flags,
    help: raw.includes('--help') || raw.includes('-h'),
  };
}

async function main(): Promise<void> {
  const parsed = parseArgs(Bun.argv);

  if (!parsed.command) {
    console.log(HELP);
    process.exit(0);
  }

  // Apply --api-url override to env so config picks it up
  if (parsed.apiUrl) {
    process.env.VMP_API_URL = parsed.apiUrl;
  }

  const sub: ParsedFlags = { json: parsed.json, args: parsed.args, flags: parsed.flags };

  // If --help appears after a command, dispatch to the handler with no
  // subcommand so it prints its own help text.
  if (parsed.help) {
    sub.args = [];
    sub.flags = {};
  }

  try {
    switch (parsed.command) {
      case 'auth':
        await handleAuth(sub);
        break;
      case 'ingredients':
        await handleIngredients(sub);
        break;
      case 'meals':
        await handleMeals(sub);
        break;
      case 'day-plans':
        await handleDayPlans(sub);
        break;
      case 'household':
        await handleHousehold(sub);
        break;
      case 'health':
        await handleHealth(sub);
        break;
      default:
        console.error(`Unknown command: ${parsed.command}`);
        console.log(HELP);
        process.exit(1);
    }
  } catch (e) {
    if (e instanceof ApiClientError) {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    }
    if (e instanceof Error) {
      console.error(`Error: ${e.message}`);
      process.exit(1);
    }
    throw e;
  }
}

async function handleHealth(parsed: ParsedFlags): Promise<void> {
  const result = await client.get<{ status: string }>('/api/health');

  if (parsed.json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    if (result.status === 'ok') {
      console.log('API is healthy — database is reachable.');
    } else {
      console.error(`API unhealthy: ${result.status}`);
      process.exit(1);
    }
  }
}

main();
