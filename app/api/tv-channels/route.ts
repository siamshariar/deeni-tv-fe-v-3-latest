import { NextResponse } from 'next/server'
import { fetchWithAuth } from '@/lib/fetch'
import { DEFAULT_API_CHANNELS } from '@/lib/schedule-utils'

// Live server API — requires JWT 'p' header (same as schedule API)
const TV_CHANNELS_API =
  process.env.NEXT_PUBLIC_TV_CHANNELS_API || 'https://api.deeniinfotech.com/api/tv-channels'

// Fallback data: exact same format as the live API response.
// Used when the live API is unreachable (e.g. Cloudflare block on STG/local).
const FALLBACK_DATA = DEFAULT_API_CHANNELS

export async function GET() {
  try {
    // fetchWithAuth sends the JWT 'p' header — same pattern as Quran Tube
    const json = await fetchWithAuth(TV_CHANNELS_API)
    if (json?.data?.length) {
      return NextResponse.json({ ...json, _source: 'live' })
    }
  } catch {
    // Live API unavailable — use fallback
  }
  return NextResponse.json({ data: FALLBACK_DATA, _source: 'fallback' })
}
