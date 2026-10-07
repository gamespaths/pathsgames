/**
 * Authentication helpers: guest access token and admin JWT
 * (minted locally with the dev secret, mirrors robot/resources/JwtHelper.py).
 */
import http from 'k6/http';
import { check } from 'k6';
import crypto from 'k6/crypto';
import encoding from 'k6/encoding';
import { config, JSON_HEADERS } from './config.js';

export function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function b64url(obj) {
  return encoding.b64encode(JSON.stringify(obj), 'rawurl');
}

// HS256 JWT with the same claims JwtTokenProvider.generateAccessToken emits
export function mintAdminToken(secret, minutes) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload = {
    jti: uuidv4(),
    sub: uuidv4(),
    username: 'stress_admin',
    role: 'ADMIN',
    type: 'access',
    iat: now,
    exp: now + (minutes || 30) * 60,
  };
  const signingInput = `${b64url(header)}.${b64url(payload)}`;
  const signature = crypto.hmac('sha256', secret, signingInput, 'base64rawurl');
  return `${signingInput}.${signature}`;
}

export function adminToken() {
  return config.adminToken || mintAdminToken(config.jwtSecret);
}

// POST /api/auth/guest -> accessToken; X-Test-Marker makes the guest removable by /api/dev/cleanup
export function guestToken() {
  const res = http.post(`${config.baseUrl}/api/auth/guest`, null, {
    headers: Object.assign({ 'X-Test-Marker': config.testMarker }, JSON_HEADERS),
    tags: { step: 'auth' },
  });
  const ok = check(res, {
    'guest 201': (r) => r.status === 201,
    'guest has accessToken': (r) => !!safeJson(r).accessToken,
  });
  if (!ok) return null;
  const body = safeJson(res);
  // v0.37.7 — Step 41: POST /api/matches wants the csrfToken back as X-CSRF-TOKEN
  if (body.csrfToken) csrfTokens[body.accessToken] = body.csrfToken;
  return body.accessToken;
}

// csrfToken per access token, remembered at login (see createMatch)
export const csrfTokens = {};

export function safeJson(res) {
  try {
    return res.json() || {};
  } catch (e) {
    return {};
  }
}
