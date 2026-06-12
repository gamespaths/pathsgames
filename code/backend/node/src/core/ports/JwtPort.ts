export interface JwtPayload {
  uuid: string;
  username: string;
  role: string;
  type: 'access' | 'refresh';
}

export interface JwtPort {
  sign(payload: JwtPayload, expiresInMinutes: number): string;
  verify(token: string): JwtPayload | null;
  decode(token: string): JwtPayload | null;
}
