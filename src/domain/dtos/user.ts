import type { HouseholdId, UserId } from '../types/ids';

export interface UserPublicDto {
  id: UserId;
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
}

export interface UserPatchDto {
  displayName?: string | null;
}

export interface HouseholdPatchDto {
  name?: string | null;
}
