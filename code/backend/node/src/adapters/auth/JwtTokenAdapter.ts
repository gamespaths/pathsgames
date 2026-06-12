import jwt from 'jsonwebtoken';
import type { JwtPort, JwtPayload } from '../../core/ports/JwtPort';

export class JwtTokenAdapter implements JwtPort {
  constructor(private secret: string) {}

  sign(payload: JwtPayload, expiresInMinutes: number): string {
    return jwt.sign(payload, this.secret, {
      expiresIn: `${expiresInMinutes}m`,
    });
  }

  verify(token: string): JwtPayload | null {
    try {
      return jwt.verify(token, this.secret) as JwtPayload;
    } catch {
      return null;
    }
  }

  decode(token: string): JwtPayload | null {
    try {
      return jwt.decode(token) as JwtPayload | null;
    } catch {
      return null;
    }
  }
}
