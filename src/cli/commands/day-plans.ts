import { client } from '../client';
import { required } from '../prompt';
import { formatJson, formatTable, formatDate } from '../format';
import { CliError, usageError } from '../errors';
import type { ParsedFlags } from '../types';
import { readFile } from 'node:fs/promises';
import type { DayPlanResponseDto } from '../../domain/dtos/day-plan';

export async function handleDayPlans(parsed: ParsedFlags): Promise<void> {
  const { args, flags, json } = parsed;
  const subcommand = args[0];

  switch (subcommand) {
    case 'list':
      await listDayPlans(flags, json);
      break;
    case 'get':
      await getDayPlan(args[1], json);
      break;
    case 'create':
      await createDayPlan(flags, json);
      break;
    case 'update':
      await updateDayPlan(args[1], flags, json);
      break;
    case 'delete':
      await deleteDayPlan(args[1], json);
      break;
    case 'bulk':
      await bulkDayPlans(flags, json);
      break;
    default:
      console.log(`Usage: vmp day-plans <command>

Commands:
  list              List day plans in a date range
  get <id>          Get a day plan
  create            Create a day plan
  update <id>       Update a day plan
  delete <id>       Delete a day plan
  bulk              Bulk upsert day plans from JSON

Flags:
  --from <YYYY-MM-DD>       Start date (list)
  --to <YYYY-MM-DD>         End date (list)
  --date <YYYY-MM-DD>       Plan date (create)
  --lunch-meal-id <id>      Lunch meal ID
  --dinner-meal-id <id>     Dinner meal ID
  --file <path>             JSON file path (bulk)
  --data <json>             Inline JSON string (bulk, mutually exclusive with --file)
  --json                    Raw JSON output`);
  }
}

async function listDayPlans(flags: Record<string, string>, json: boolean): Promise<void> {
  const from = await required('From date (YYYY-MM-DD)', 'from', flags['--from']);
  const to = await required('To date (YYYY-MM-DD)', 'to', flags['--to']);

  const params = new URLSearchParams({ from, to });
  const plans = await client.get<DayPlanResponseDto[]>(`/api/day-plans?${params}`);

  if (json) {
    // Day-plans list doesn't support limit/offset in the API (date-range only).
    // Wrap in the standard envelope without pagination metadata.
    console.log(formatJson({ data: plans }));
    return;
  }

  if (plans.length === 0) {
    console.log('No day plans found.');
    return;
  }

  console.log(
    formatTable(
      ['ID', 'Date', 'Lunch', 'Dinner', 'Updated'],
      plans.map((p) => [
        p.id,
        p.date,
        p.lunchMealId ?? '—',
        p.dinnerMealId ?? '—',
        formatDate(p.updatedAt),
      ])
    )
  );
}

async function getDayPlan(id: string | undefined, json: boolean): Promise<void> {
  if (!id) {
    throw usageError('Missing required argument: day plan ID');
  }
  const plan = await client.get<DayPlanResponseDto>(`/api/day-plans/${id}`);

  if (json) {
    console.log(formatJson(plan));
    return;
  }

  console.log(
    formatTable(
      ['Field', 'Value'],
      [
        ['ID', plan.id],
        ['Date', plan.date],
        ['Lunch Meal ID', plan.lunchMealId ?? '—'],
        ['Dinner Meal ID', plan.dinnerMealId ?? '—'],
        ['Created', formatDate(plan.createdAt)],
        ['Updated', formatDate(plan.updatedAt)],
      ]
    )
  );
}

async function createDayPlan(flags: Record<string, string>, json: boolean): Promise<void> {
  const date = await required('Date (YYYY-MM-DD)', 'date', flags['--date']);

  const body: Record<string, unknown> = {
    date,
    lunchMealId: flags['--lunch-meal-id'] || undefined,
    dinnerMealId: flags['--dinner-meal-id'] || undefined,
  };

  const plan = await client.post<DayPlanResponseDto>('/api/day-plans', body);

  if (json) {
    console.log(formatJson(plan));
  } else {
    console.log(`Created day plan for ${plan.date} (${plan.id})`);
  }
}

async function updateDayPlan(
  id: string | undefined,
  flags: Record<string, string>,
  json: boolean
): Promise<void> {
  if (!id) {
    throw usageError('Missing required argument: day plan ID');
  }

  const body: Record<string, unknown> = {};
  if ('--lunch-meal-id' in flags) body.lunchMealId = flags['--lunch-meal-id'] || null;
  if ('--dinner-meal-id' in flags) body.dinnerMealId = flags['--dinner-meal-id'] || null;

  if (Object.keys(body).length === 0) {
    throw usageError('No fields to update. Use --lunch-meal-id or --dinner-meal-id.');
  }

  const plan = await client.patch<DayPlanResponseDto>(`/api/day-plans/${id}`, body);

  if (json) {
    console.log(formatJson(plan));
  } else {
    console.log(`Updated day plan for ${plan.date} (${plan.id})`);
  }
}

async function deleteDayPlan(id: string | undefined, json: boolean): Promise<void> {
  if (!id) {
    throw usageError('Missing required argument: day plan ID');
  }
  await client.delete(`/api/day-plans/${id}`);

  if (json) {
    console.log(formatJson({ deleted: true, id }));
  } else {
    console.log(`Deleted day plan ${id}`);
  }
}

async function bulkDayPlans(flags: Record<string, string>, json: boolean): Promise<void> {
  const hasFile = '--file' in flags;
  const hasData = '--data' in flags;

  if (hasFile && hasData) {
    throw usageError('Cannot use both --file and --data. Choose one.');
  }

  let data: unknown;

  if (hasData) {
    const raw = flags['--data']!;
    try {
      data = JSON.parse(raw);
    } catch {
      throw new CliError(2, 'invalid_json', `Failed to parse --data as JSON: ${raw}`);
    }
  } else {
    const filePath = await required('JSON file path', 'file', flags['--file']);
    const raw = await readFile(filePath, 'utf-8');
    try {
      data = JSON.parse(raw);
    } catch {
      throw new CliError(2, 'invalid_json', `Failed to parse JSON file: ${filePath}`);
    }
  }

  if (!Array.isArray(data)) {
    throw usageError('Bulk input must contain a JSON array of day plan objects.');
  }

  const plans = await client.post<DayPlanResponseDto[]>('/api/day-plans/bulk', data);

  if (json) {
    console.log(formatJson(plans));
  } else {
    console.log(`Upserted ${plans.length} day plan(s):`);
    for (const p of plans) {
      console.log(`  ${p.date} — lunch: ${p.lunchMealId ?? '—'}, dinner: ${p.dinnerMealId ?? '—'}`);
    }
  }
}
