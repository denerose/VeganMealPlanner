import type { UserId } from '../types/ids';

/** User slice returned on register/login (no secrets). */
export interface AuthUserDto {
  id: UserId;
  email: string;
  displayName: string | null;
}

/** Shared JSON envelope for successful register (201) and login (200). */
export interface AuthTokenEnvelopeDto {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  user: AuthUserDto;
}
