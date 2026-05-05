// Mirrors future protobuf message AuthService; hand-written for now.
//
// Wire reference: Doc #22 §4 ClientMessage::Auth + ServerMessage. The HTTP-style
// login endpoints below are the *web boundary* — they wrap the eventual
// protobuf handshake in a JSON envelope for the dev mock layer.

import type { AccountId, AvatarId, Iso8601, SessionId } from './common';

export interface LoginRequest {
  readonly email: string;
  readonly password: string;
  /** Optional 2FA code; UI may collect after a 401 challenge. */
  readonly otp?: string;
}

export interface LoginResponse {
  readonly session: Session;
  readonly me: Me;
}

export interface Session {
  readonly id: SessionId;
  readonly accountId: AccountId;
  readonly token: string;
  readonly issuedAt: Iso8601;
  readonly expiresAt: Iso8601;
  /** Wire protocol version negotiated at handshake (Doc #22 §4.5). */
  readonly protocolVersion: number;
}

export interface Me {
  readonly accountId: AccountId;
  readonly handle: string;
  readonly email: string;
  readonly displayName: string;
  readonly createdAt: Iso8601;
  readonly avatarIds: readonly AvatarId[];
  readonly entitlements: readonly string[];
  readonly emailVerified: boolean;
}

export interface LogoutResponse {
  readonly ok: true;
  readonly endedAt: Iso8601;
}
