import { PrismaClient } from '@prisma/client';
import type { GuestRepository } from '../../../core/ports/GuestRepository';
import type { Guest } from '../../../core/models/Guest';
import { toInt, toDate } from './textResolver';

// Guests are stored in the `users` table with state = 6 (guest).
const GUEST_STATE = 6;

export class PrismaGuestRepository implements GuestRepository {
  constructor(private prisma: PrismaClient) {}

  private _map(row: any): Guest {
    return {
      id: String(row.id),
      uuid: row.uuid,
      username: row.username,
      role: row.role === 'ADMIN' ? 'ADMIN' : 'PLAYER',
      createdAt: toDate(row.tsInsert || row.tsRegistration),
      updatedAt: toDate(row.tsUpdate),
    };
  }

  async create(username: string, _testMarker?: string): Promise<Guest> {
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const row = await this.prisma.user.create({
      data: { username, role: 'PLAYER', state: GUEST_STATE, guestExpiresAt: expires },
    });
    return this._map(row);
  }

  async findByUuid(uuid: string): Promise<Guest | null> {
    const row = await this.prisma.user.findUnique({ where: { uuid } });
    return row ? this._map(row) : null;
  }

  async findById(id: string): Promise<Guest | null> {
    const row = await this.prisma.user.findUnique({ where: { id: toInt(id) } });
    return row ? this._map(row) : null;
  }

  async findByUsername(username: string): Promise<Guest | null> {
    const row = await this.prisma.user.findUnique({ where: { username } });
    return row ? this._map(row) : null;
  }

  async update(uuid: string, data: Partial<Guest>): Promise<Guest> {
    const row = await this.prisma.user.update({
      where: { uuid },
      data: { username: data.username, role: data.role },
    });
    return this._map(row);
  }

  async delete(uuid: string): Promise<boolean> {
    try {
      await this.prisma.user.delete({ where: { uuid } });
      return true;
    } catch {
      return false;
    }
  }

  async listAll(): Promise<Guest[]> {
    const rows = await this.prisma.user.findMany({ where: { state: GUEST_STATE } });
    return rows.map((r) => this._map(r));
  }

  async deleteExpired(): Promise<number> {
    const nowIso = new Date().toISOString();
    const result = await this.prisma.user.deleteMany({
      where: { state: GUEST_STATE, guestExpiresAt: { lt: nowIso } },
    });
    return result.count;
  }
}
