import { client } from '../client';
import { required } from '../prompt';
import { formatJson, formatTable, formatDate } from '../format';
import type { ParsedFlags } from '../types';
import type {
  IngredientResponseDto,
  IngredientCreateDto,
  IngredientUpdateDto,
} from '../../domain/dtos/ingredient';

export async function handleIngredients(parsed: ParsedFlags): Promise<void> {
  const { args, flags, json } = parsed;
  const subcommand = args[0];

  switch (subcommand) {
    case 'list':
      await listIngredients(flags, json);
      break;
    case 'get':
      await getIngredient(args[1], json);
      break;
    case 'create':
      await createIngredient(flags, json);
      break;
    case 'update':
      await updateIngredient(args[1], flags, json);
      break;
    case 'delete':
      await deleteIngredient(args[1], json);
      break;
    default:
      console.log(`Usage: vmp ingredients <command>

Commands:
  list              List ingredients
  get <id>          Get an ingredient
  create            Create an ingredient
  update <id>       Update an ingredient
  delete <id>       Delete an ingredient

Flags:
  --name <name>             Ingredient name
  --storage-type <type>     PANTRY | REFRIGERATED | FROZEN | FRESH
  --perishable              Mark as perishable
  --limit <n>               Page size (default 50)
  --offset <n>              Page offset (default 0)
  --json                    Raw JSON output`);
  }
}

async function listIngredients(flags: Record<string, string>, json: boolean): Promise<void> {
  const params = new URLSearchParams();
  if (flags['--limit']) params.set('limit', flags['--limit']);
  if (flags['--offset']) params.set('offset', flags['--offset']);

  const qs = params.toString();
  const ingredients = await client.get<IngredientResponseDto[]>(
    `/api/ingredients${qs ? `?${qs}` : ''}`
  );

  if (json) {
    console.log(formatJson(ingredients));
    return;
  }

  if (ingredients.length === 0) {
    console.log('No ingredients found.');
    return;
  }

  console.log(
    formatTable(
      ['ID', 'Name', 'Storage', 'Perishable', 'Updated'],
      ingredients.map((i) => [
        i.id.slice(0, 8),
        i.name,
        i.storageType,
        i.perishable ? 'Yes' : 'No',
        formatDate(i.updatedAt),
      ])
    )
  );
}

async function getIngredient(id: string | undefined, json: boolean): Promise<void> {
  if (!id) {
    throw new Error('Missing required argument: ingredient ID');
  }
  const ingredient = await client.get<IngredientResponseDto>(`/api/ingredients/${id}`);

  if (json) {
    console.log(formatJson(ingredient));
    return;
  }

  console.log(
    formatTable(
      ['Field', 'Value'],
      [
        ['ID', ingredient.id],
        ['Name', ingredient.name],
        ['Storage Type', ingredient.storageType],
        ['Perishable', ingredient.perishable ? 'Yes' : 'No'],
        ['Created', formatDate(ingredient.createdAt)],
        ['Updated', formatDate(ingredient.updatedAt)],
      ]
    )
  );
}

async function createIngredient(flags: Record<string, string>, json: boolean): Promise<void> {
  const name = await required('Name', 'name', flags['--name']);
  const storageType = await required(
    'Storage type (PANTRY/REFRIGERATED/FROZEN/FRESH)',
    'storage-type',
    flags['--storage-type']
  );

  const validTypes = ['PANTRY', 'REFRIGERATED', 'FROZEN', 'FRESH'];
  if (!validTypes.includes(storageType.toUpperCase())) {
    throw new Error(
      `Invalid storage type: ${storageType}. Must be one of: ${validTypes.join(', ')}`
    );
  }

  const body: IngredientCreateDto = {
    name,
    storageType: storageType.toUpperCase() as IngredientCreateDto['storageType'],
    perishable: '--perishable' in flags ? flags['--perishable'] !== 'false' : false,
  };

  const ingredient = await client.post<IngredientResponseDto>('/api/ingredients', body);

  if (json) {
    console.log(formatJson(ingredient));
  } else {
    console.log(`Created ingredient: ${ingredient.name} (${ingredient.id})`);
  }
}

async function updateIngredient(
  id: string | undefined,
  flags: Record<string, string>,
  json: boolean
): Promise<void> {
  if (!id) {
    throw new Error('Missing required argument: ingredient ID');
  }

  const body: IngredientUpdateDto = {};
  if (flags['--name']) body.name = flags['--name'];
  if (flags['--storage-type']) {
    const validTypes = ['PANTRY', 'REFRIGERATED', 'FROZEN', 'FRESH'];
    const st = flags['--storage-type'].toUpperCase();
    if (!validTypes.includes(st)) {
      throw new Error(`Invalid storage type: ${st}. Must be one of: ${validTypes.join(', ')}`);
    }
    body.storageType = st as IngredientCreateDto['storageType'];
  }
  if ('--perishable' in flags) {
    body.perishable = flags['--perishable'] !== 'false';
  }

  if (Object.keys(body).length === 0) {
    throw new Error('No fields to update. Use --name, --storage-type, or --perishable.');
  }

  const ingredient = await client.patch<IngredientResponseDto>(`/api/ingredients/${id}`, body);

  if (json) {
    console.log(formatJson(ingredient));
  } else {
    console.log(`Updated ingredient: ${ingredient.name} (${ingredient.id})`);
  }
}

async function deleteIngredient(id: string | undefined, json: boolean): Promise<void> {
  if (!id) {
    throw new Error('Missing required argument: ingredient ID');
  }
  await client.delete(`/api/ingredients/${id}`);

  if (json) {
    console.log(formatJson({ deleted: true, id }));
  } else {
    console.log(`Deleted ingredient ${id}`);
  }
}
