/**
 * Token taxonomy (single-token model):
 *  - access:  issued after OTP verify, carries only the user id. Used for every
 *             route. The active workspace is supplied per-request via the
 *             `x-workspace-slug` header, not baked into the token.
 *  - refresh: long-lived companion, exchanged for a fresh access token without
 *             a new OTP. Rejected for authenticating requests.
 */
export type TokenType = 'access' | 'refresh';

export interface BaseJwtPayload {
  sub: string; // userId
  type: TokenType;
}

export interface AccessJwtPayload extends BaseJwtPayload {
  type: 'access';
}

export interface RefreshJwtPayload extends BaseJwtPayload {
  type: 'refresh';
}

export type AnyJwtPayload = AccessJwtPayload | RefreshJwtPayload;

/** Shape attached to `request.user` after the JwtAuthGuard runs. */
export type AuthenticatedUser = AccessJwtPayload;
