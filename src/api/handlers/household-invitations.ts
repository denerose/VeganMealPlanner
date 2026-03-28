import type { ApiContext } from './me-household';
import { readJsonBody } from '../parse';
import { createHouseholdInvitation } from '../services/invitations-service';

export async function handlePostHouseholdInvitation(
  req: Request,
  ctx: ApiContext
): Promise<Response> {
  const body = await readJsonBody<unknown>(req);
  const created = await createHouseholdInvitation(ctx.prisma, ctx, body);
  return Response.json(created, { status: 201 });
}
