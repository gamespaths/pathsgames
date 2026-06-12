export interface Match {
  id: string;
  uuid: string;
  guestId: string;
  storyId: string;
  difficultyUuid?: string | null;
  status: string;
  progress: number;
  createdAt: Date;
  updatedAt: Date;
  endedAt?: Date | null;
}

export interface MatchSummaryResponse {
  uuid: string;
  name?: string;
  storyUuid: string;
  difficultyUuid?: string | null;
  storyTitle?: string;
  status: string;
  creatorUuid: string;
  createdAt: string;
  updatedAt: string;
}

export interface MatchInfoResponse extends MatchSummaryResponse {
  difficultyUuid?: string;
  registry?: any[];
  locations?: any[];
}

export interface MatchCreateRequest {
  storyUuid: string;
  difficultyUuid: string;
  name?: string;
  characterTemplateUuid?: string;
  classUuid?: string;
  traitUuids?: string[];
  singlePlayer?: boolean;
  turnstileToken?: string;
}
