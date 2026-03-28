import type { HouseholdId, UserId } from '../types/ids';

/** Mirrors Prisma `HouseholdRole` enum strings in JSON. */
export type HouseholdRoleDto = 'OWNER' | 'MEMBER';

export interface UserPublicDto {
  id: UserId;
  email: string;
  displayName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface HouseholdSummaryDto {
  id: HouseholdId;
  name: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MeResponseDto {
  user: UserPublicDto;
  household: HouseholdSummaryDto;
  membershipRole: HouseholdRoleDto;
}

/** One row from `GET /api/household/members`. */
export interface HouseholdMemberDto {
  userId: UserId;
  displayName: string | null;
  role: HouseholdRoleDto;
}

export interface UserPatchDto {
  displayName?: string | null;
}

export interface HouseholdPatchDto {
  name?: string | null;
}
