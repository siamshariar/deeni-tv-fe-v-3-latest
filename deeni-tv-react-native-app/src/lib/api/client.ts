// Data access for the Deeni API, mirroring the web app's chain:
//   1. external API from the device (JWT in header `p`)
//   2. the deployed web app's /api/current-video route (optional tier 2)
//   3. embedded CHANNELS data (lib/schedule/schedule.ts)
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { config } from '@/lib/config';
import { findApiChannel } from '@/lib/schedule/channels';
import { noteServerDate, serverNow } from '@/lib/serverClock';
import type { ApiChannel, ScheduleResult } from '@/types';

import { createApiToken } from './jwt';
import { isUsableSchedule, normalizeScheduleResponse } from './normalize';

/** The request itself may run this long; channel start only waits 10 s for it (web values). */
export const EXTERNAL_API_TIMEOUT_MS = 120000;
export const WEB_ROUTE_TIMEOUT_MS = 10000;

const appVersion = Constants.expoConfig?.version ?? '1.0.0';
const clientName = Platform.isTV ? 'androidtv' : Platform.OS;
const userAgent = `DeeniTV/${appVersion} (${clientName})`;

let warnedNoSecret = false;

function authHeaders(): Record<string, string> {
  if (!config.jwtSecret) {
    if (!warnedNoSecret) {
      warnedNoSecret = true;
      console.warn('EXPO_PUBLIC_NP_AS_L is not set: calling the API without an auth token.');
    }
    return {};
  }
  // The servers' clock, so a device with a wrong clock still sends a current timestamp.
  return { p: createApiToken(config.jwtSecret, userAgent, serverNow()) };
}

/** Browser-like source headers: Cloudflare blocks API requests without a deeni.tv referer. */
function sourceHeaders(): Record<string, string> {
  if (!config.apiReferer) return {};
  const headers: Record<string, string> = { Referer: config.apiReferer };
  const origin = /^https?:\/\/[^/]+/.exec(config.apiReferer)?.[0];
  if (origin) headers.Origin = origin;
  return headers;
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const sentAt = Date.now();
    const res = await fetch(url, { ...init, signal: controller.signal });
    noteServerDate(res.headers.get('date'), sentAt, Date.now());
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function parseJson(res: Response): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** GET with the `p` JWT. An unsigned request that gets a 403 is retried once (web client-fetch). */
async function apiGet(url: string, timeoutMs: number): Promise<any> {
  const headers: Record<string, string> = { Accept: 'application/json', ...sourceHeaders(), ...authHeaders() };
  let res = await fetchWithTimeout(url, { headers }, timeoutMs);
  if (res.status === 403 && !headers.p) {
    res = await fetchWithTimeout(url, { headers: { Accept: 'application/json', ...sourceHeaders() } }, timeoutMs);
  }
  if (!res.ok) throw new Error(`API ${res.status} from ${refusedBy(res)} for ${url}`);
  return parseJson(res);
}

/** Who refused: Cloudflare's firewall page or the API itself (Express) — tells a blocked request from a bad token. */
function refusedBy(res: Response): string {
  if (res.headers.get('x-powered-by')) return 'api';
  return /cloudflare/i.test(res.headers.get('server') ?? '') ? 'cloudflare' : 'server';
}

function channelQuery(channelId: string): { lid: string; isQuran: boolean } {
  const channel = findApiChannel(channelId);
  return { lid: String(channel?.localizationId || '5'), isQuran: channel?.isQuran === true };
}

/** Tier 1: the live schedule straight from the external API. Null on any failure. */
export async function fetchExternalSchedule(channelId: string): Promise<ScheduleResult | null> {
  const { lid, isQuran } = channelQuery(channelId);
  let url = `${config.apiBase}/live?lid=${lid}`;
  if (isQuran) url += '&iq=true';
  try {
    const data = await apiGet(url, EXTERNAL_API_TIMEOUT_MS);
    const result = normalizeScheduleResponse(data, Date.now());
    return isUsableSchedule(result) ? result : null;
  } catch (error) {
    console.warn('External schedule API failed, using the fallback:', String(error));
    return null;
  }
}

/** Tier 2: the deployed web app's /api/current-video route. Null if disabled or failing. */
export async function fetchWebRouteSchedule(channelId: string): Promise<ScheduleResult | null> {
  if (!config.webBaseUrl) return null;
  const channel = findApiChannel(channelId);
  const params = new URLSearchParams({ channel: channelId });
  if (channel) {
    params.set('lid', String(channel.localizationId));
    params.set('iq', String(channel.isQuran === true));
  }
  try {
    const res = await fetchWithTimeout(
      `${config.webBaseUrl}/api/current-video?${params}`,
      { headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' } },
      WEB_ROUTE_TIMEOUT_MS,
    );
    if (!res.ok) return null;
    const data = await parseJson(res);
    if (!isUsableSchedule(data)) return null;
    return { ...data, _fetchedAt: Date.now() };
  } catch (error) {
    console.warn('Web schedule route failed:', String(error));
    return null;
  }
}

/** The channel list: external API, then the web route. Null when neither answers. */
export async function fetchChannelList(): Promise<ApiChannel[] | null> {
  try {
    const json = await apiGet(config.tvChannelsApi, WEB_ROUTE_TIMEOUT_MS);
    if (Array.isArray(json?.data) && json.data.length) return json.data as ApiChannel[];
  } catch {
    // fall through to the web route
  }
  if (!config.webBaseUrl) return null;
  try {
    const res = await fetchWithTimeout(`${config.webBaseUrl}/api/tv-channels`, {}, WEB_ROUTE_TIMEOUT_MS);
    const json = res.ok ? await parseJson(res) : null;
    if (Array.isArray(json?.data) && json.data.length) return json.data as ApiChannel[];
  } catch {
    // ignore
  }
  return null;
}
