export interface Difficulty {
  id: string;
  uuid: string;
  storyId: string;
  title: string;
  description?: string;
  level: number;
  idCard?: number;
  idTextName?: number;
  idTextDescription?: number;
  life: number;
  energy: number;
  sad: number;
  dexterity: number;
  intelligence: number;
  constitution: number;
  weight: number;
  createdAt: Date;
  updatedAt: Date;
}
