import type { Guest } from '../models/Guest';

export interface GuestRepository {
  create(username: string, testMarker?: string): Promise<Guest>;
  findById(id: string): Promise<Guest | null>;
  findByUuid(uuid: string): Promise<Guest | null>;
  findByUsername(username: string): Promise<Guest | null>;
  update(uuid: string, data: Partial<Guest>): Promise<Guest>;
  delete(uuid: string): Promise<boolean>;
  listAll(): Promise<Guest[]>;
  deleteExpired(): Promise<number>;
}
