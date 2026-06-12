export interface Story {
  id: string;
  uuid: string;
  // Resolved from list_texts (id_text_title / id_text_description) by the repository
  title: string;
  description?: string;
  author?: string;
  category?: string;
  group?: string;
  visibility: string;
  priority?: number;
  peghi?: number;
  // Integer header references (list_stories columns)
  idStory?: number;
  idTextTitle?: number | null;
  idTextDescription?: number | null;
  idCard?: number | null;
  idImage?: number | null;
  idLocationStart?: number | null;
  idCreator?: number | null;
  idLocationAllPlayerComa?: number | null;
  idEventAllPlayerComa?: number | null;
  idEventEndGame?: number | null;
  idTextCopyright?: number | null;
  idTextClockSingular?: number | null;
  idTextClockPlural?: number | null;
  linkCopyright?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface StorySummaryResponse {
  uuid: string;
  title: string;
  description?: string;
  author?: string;
  category?: string;
  group?: string;
  visibility: string;
  priority: number;
  peghi?: number;
}

export interface StoryDetailResponse extends StorySummaryResponse {
  difficulties?: any[];
  classes?: any[];
  traits?: any[];
  characterTemplates?: any[];
}

export interface CardInfoResponse {
  uuid: string;
  cardType?: string;
  urlImage?: string;
  title: string;
  description?: string;
  creator?: any;
}

export interface TextInfoResponse {
  idText: number;
  lang: string;
  value: string;
}

export interface CreatorInfoResponse {
  uuid: string;
  name: string;
  description?: string;
}
