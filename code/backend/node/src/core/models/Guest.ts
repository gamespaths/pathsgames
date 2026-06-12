export interface Guest {
  id: string;
  uuid: string;
  username: string;
  role: 'PLAYER' | 'ADMIN';
  createdAt: Date;
  updatedAt: Date;
}

export interface GuestLoginResponse {
  userUuid: string;
  username: string;
  accessToken: string;
  accessTokenExpiresAt: number;
  refreshTokenExpiresAt: number;
}

export interface RefreshTokenResponse extends GuestLoginResponse {
  role: string;
}

export interface GuestInfoResponse {
  userUuid: string;
  username: string;
  role: string;
  createdAt: string;
  expired: boolean;
}

export interface GuestStatsResponse {
  totalGuests: number;
  activeGuests: number;
  expiredGuests: number;
}
