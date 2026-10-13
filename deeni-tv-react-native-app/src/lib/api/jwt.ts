// JWT for api.deeniinfotech.com, sent in the `p` header. Same algorithm and
// payload as the web app (lib/client-fetch.ts, app/api/current-video/route.ts):
// HS256, payload { userAgent, timestamp, random }, base64url without padding.
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { utf8ToBytes } from '@noble/hashes/utils.js';

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function base64url(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = bytes[i] << 16;
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63];
  } else if (rest === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63];
  }
  return out.replace(/\+/g, '-').replace(/\//g, '_');
}

export function signJwt(payload: Record<string, unknown>, secret: string): string {
  const header = base64url(utf8ToBytes(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const body = base64url(utf8ToBytes(JSON.stringify(payload)));
  const signingInput = `${header}.${body}`;
  const signature = hmac(sha256, utf8ToBytes(secret), utf8ToBytes(signingInput));
  return `${signingInput}.${base64url(signature)}`;
}

/** A fresh token per request, as the web client does. */
export function createApiToken(secret: string, userAgent: string, now: number = Date.now()): string {
  return signJwt(
    { userAgent, timestamp: now, random: Math.floor(Math.random() * 1000000000) },
    secret,
  );
}
