import { client } from '../client';
import { required } from '../prompt';
import { formatJson, formatTable, formatDate } from '../format';
import type { ParsedFlags } from '../types';
import type { MealResponseDto, MealCreateDto, MealUpdateDto } from '../../domain/dtos/meal';

export async function handleMeals(parsed: ParsedFlags): Promise<void> {
  const { args, flags, json } = parsed;
  const subcommand = args[0];

  switch (subcommand) {
    case 'list':
      await listMeals(flags, json);
      break;
    case 'get':
      await getMeal(args[1], json);
      break;
    case 'create':
      await createMeal(flags, json);
      break;
    case 'update':
      await updateMeal(args[1], flags, json);
      break;
    case 'delete':
      await deleteMeal(args[1], json);
      break;
    case 'random':
      await randomMeal(flags, json);
      break;
    default:
      console.log(`Usage: vmp meals <command>

Commands:
  list              List meals
  get <id>          Get a meal
  create            Create a meal
  update <id>       Update a meal
  delete <id>       Delete a meal
  random            Get a random meal for a date

Flags:
  --name <name>             Meal name
  --description <desc>      Description
  --recipe-url <url>        Recipe URL
  --date <YYYY-MM-DD>       Date (for random)
  --limit <n>               Page size (default 50)
  --offset <n>              Page offset (default 0)
  --json                    Raw JSON output`);
  }
}

async function listMeals(flags: Record<string, string>, json: boolean): Promise<void> {
  const params = new URLSearchParams();
  if (flags['--limit']) params.set('limit', flags['--limit']);
  if (flags['--offset']) params.set('offset', flags['--offset']);

  const qs = params.toString();
  const meals = await client.get<MealResponseDto[]>(`/api/meals${qs ? `?${qs}` : ''}`);

  if (json) {
    console.log(formatJson(meals));
    return;
  }

  if (meals.length === 0) {
    console.log('No meals found.');
    return;
  }

  console.log(
    formatTable(
      ['ID', 'Name', 'Leftovers', 'Description', 'Updated'],
      meals.map((m) => [
        m.id.slice(0, 8),
        m.name,
        m.qualities.makesLeftovers ? 'Yes' : 'No',
        m.description
          ? m.description.length > 40
            ? m.description.slice(0, 37) + '...'
            : m.description
          : '—',
        formatDate(m.updatedAt),
      ])
    )
  );
}

async function getMeal(id: string | undefined, json: boolean): Promise<void> {
  if (!id) {
    throw new Error('Missing required argument: meal ID');
  }
  const meal = await client.get<MealResponseDto>(`/api/meals/${id}`);

  if (json) {
    console.log(formatJson(meal));
    return;
  }

  const rows: string[][] = [
    ['ID', meal.id],
    ['Name', meal.name],
    ['Description', meal.description || '—'],
    ['Recipe URL', meal.recipeUrl ?? '—'],
    ['Makes Leftovers', meal.qualities.makesLeftovers ? 'Yes' : 'No'],
    ['Greasy', meal.qualities.isGreasy ? 'Yes' : 'No'],
    ['Creamy', meal.qualities.isCreamy ? 'Yes' : 'No'],
    ['Acidic', meal.qualities.isAcidic ? 'Yes' : 'No'],
    ['Hero Ingredients', meal.heroIngredients.map((h) => h.name).join(', ') || '—'],
    ['Created', formatDate(meal.createdAt)],
    ['Updated', formatDate(meal.updatedAt)],
  ];
  console.log(formatTable(['Field', 'Value'], rows));
}

async function createMeal(flags: Record<string, string>, json: boolean): Promise<void> {
  const name = await required('Name', 'name', flags['--name']);

  const body: MealCreateDto = {
    name,
    description: flags['--description']?.trim() || undefined,
    recipeUrl: flags['--recipe-url']?.trim() || undefined,
  };

  const meal = await client.post<MealResponseDto>('/api/meals', body);

  if (json) {
    console.log(formatJson(meal));
  } else {
    console.log(`Created meal: ${meal.name} (${meal.id})`);
  }
}

async function updateMeal(
  id: string | undefined,
  flags: Record<string, string>,
  json: boolean
): Promise<void> {
  if (!id) {
    throw new Error('Missing required argument: meal ID');
  }

  const body: MealUpdateDto = {};
  if (flags['--name']) body.name = flags['--name'];
  if (flags['--description'] !== undefined) body.description = flags['--description'];
  if ('--recipe-url' in flags) body.recipeUrl = flags['--recipe-url'] || null;

  if (Object.keys(body).length === 0) {
    throw new Error('No fields to update. Use --name, --description, or --recipe-url.');
  }

  const meal = await client.patch<MealResponseDto>(`/api/meals/${id}`, body);

  if (json) {
    console.log(formatJson(meal));
  } else {
    console.log(`Updated meal: ${meal.name} (${meal.id})`);
  }
}

async function deleteMeal(id: string | undefined, json: boolean): Promise<void> {
  if (!id) {
    throw new Error('Missing required argument: meal ID');
  }
  await client.delete(`/api/meals/${id}`);

  if (json) {
    console.log(formatJson({ deleted: true, id }));
  } else {
    console.log(`Deleted meal ${id}`);
  }
}

async function randomMeal(flags: Record<string, string>, json: boolean): Promise<void> {
  const date = await required('Date (YYYY-MM-DD)', 'date', flags['--date']);

  const params = new URLSearchParams({ date });
  const meal = await client.get<MealResponseDto>(`/api/meals/random?${params}`);

  if (json) {
    console.log(formatJson(meal));
    return;
  }

  console.log(`Random meal for ${date}:`);
  console.log(`  ${meal.name}`);
  if (meal.description) console.log(`  ${meal.description}`);
  if (meal.recipeUrl) console.log(`  Recipe: ${meal.recipeUrl}`);
}
