import type { Story } from '../models/Story';

export interface StoryRepository {
  findById(id: string): Promise<Story | null>;
  findByUuid(uuid: string): Promise<Story | null>;
  listPublic(): Promise<Story[]>;
  listAll(): Promise<Story[]>;
  listCategories(): Promise<string[]>;
  listGroups(): Promise<string[]>;
  listByCategory(category: string): Promise<Story[]>;
  listByGroup(group: string): Promise<Story[]>;
  create(data: Partial<Story> & { uuid: string; title: string }): Promise<Story>;
  update(uuid: string, data: Partial<Story>): Promise<Story>;
  delete(uuid: string): Promise<void>;
}
