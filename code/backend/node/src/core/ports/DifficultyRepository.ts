import { Difficulty } from '../models/Difficulty';

export interface DifficultyRepository {
  findByStoryUuid(storyUuid: string): Promise<Difficulty[]>;
  findByUuid(uuid: string): Promise<Difficulty | null>;
  create(data: Partial<Difficulty>): Promise<Difficulty>;
  update(uuid: string, data: Partial<Difficulty>): Promise<Difficulty>;
  delete(uuid: string): Promise<void>;
}

export const DifficultyRepositorySymbol = Symbol('DifficultyRepository');
