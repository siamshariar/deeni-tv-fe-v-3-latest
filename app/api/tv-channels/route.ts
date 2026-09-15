import { NextResponse } from 'next/server'
import { fetchWithAuth } from '@/lib/fetch'

// Live server API — requires JWT 'p' header (same as schedule API)
const TV_CHANNELS_API =
  process.env.NEXT_PUBLIC_TV_CHANNELS_API || 'https://api.deeniinfotech.com/api/tv-channels'

// Fallback data: exact same format as the live API response.
// Used when the live API is unreachable (e.g. Cloudflare block on STG/local).
const FALLBACK_DATA = [
  { id: 1, title: 'Bangla', localizationId: '5', isQuran: null },
  { id: 2, title: 'Quran - Bangla', localizationId: '5', isQuran: true },
  { id: 3, title: 'English', localizationId: '6', isQuran: null },
  { id: 4, title: 'Quran - English', localizationId: '6', isQuran: true },
  { id: 5, title: 'Arabic', localizationId: '7', isQuran: null },
  { id: 6, title: 'Quran - Arabic', localizationId: '7', isQuran: true },
  { id: 7, title: 'Urdu', localizationId: '8', isQuran: null },
  { id: 8, title: 'Chinese', localizationId: '9', isQuran: null },
  { id: 9, title: 'Quran - Chinese', localizationId: '9', isQuran: true },
]

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
