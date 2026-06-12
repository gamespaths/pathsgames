export interface TokenData {
  id: string;
  guestId: string;
  type: string;
  token: string;
  expiresAt: Date;
  revokedAt?: Date | null;
}

export interface TokenRepository {
  create(guestId: string, token: string, expiresAt: Date, type: string): Promise<TokenData>;
  findByToken(token: string): Promise<TokenData | null>;
  revoke(token: string): Promise<boolean>;
  revokeAllByGuestId(guestId: string): Promise<number>;
  deleteExpired(): Promise<number>;
}
