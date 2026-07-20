import { NextResponse } from 'next/server'
import { getCurrentProgram, getUpcomingPrograms, getChannelPrograms, CHANNELS, CHANNEL_LID_MAP, isQuranChannel } from '@/lib/schedule-utils'
import { appendFileSync } from 'fs'

const EXTERNAL_API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'https://api.deeniinfotech.com/api/tv-schedules'
const JWT_SECRET = process.env.NP_AS_L || process.env.NEXT_PUBLIC_NP_AS_L || ''

function logSyncCall(channelId: string, source: string) {
  try {
    const ts = new Date().toISOString()
    appendFileSync('/tmp/deeni-sync-calls.log', `[${ts}] /api/current-video called — channel=${channelId} source=${source}\n`)
  } catch {} // non-critical
}

// ── Server-side JWT generation (Node.js crypto, same algorithm as client-fetch.ts) ──
async function generateServerToken(): Promise<string> {
  if (!JWT_SECRET) throw new Error('JWT secret not configured')
  const { createHmac } = await import('crypto')
  const b64url = (s: string) => Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  const header  = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({ userAgent: 'DeeniTV/1.0', timestamp: Date.now(), random: Math.floor(Math.random() * 1e9) }))
  const sig = createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${header}.${payload}.${sig}`
}

// ── Try to fetch from the external API server-side ──
// Note: Cloudflare may block requests from certain server IPs.
// If blocked, this returns null and the caller falls back to local schedule.
async function fetchFromExternalAPI(channelId: string): Promise<any | null> {
  try {
    const lid = CHANNEL_LID_MAP[channelId] || 5
    let url = `${EXTERNAL_API_BASE}/live?lid=${lid}`
    if (isQuranChannel(channelId)) url += '&IS=true'

    const token = await generateServerToken()
    const res = await fetch(url, {
      headers: { 'p': token, 'Accept': 'application/json' },
      signal: AbortSignal.timeout(5000), // 5s timeout
    })

    if (!res.ok) return null // Cloudflare 403, 503, etc.
    const data = await res.json()

    const curr = data?.currentProgram || data?.current || data?.data?.currentProgram
    if (!curr) return null

    const serverTime = data?.serverTime || Date.now()
    const mapProg = (p: any) => ({
      ytVideoId: p.ytVideoId || p.videoId || p.yt_video_id,
      title: p.title || p.name,
      startTime: p.startTime || p.start_time,
      endTime: p.endTime || p.end_time,
      duration: p.duration,
    })
    const prevList = data?.previousPrograms || data?.previous || data?.data?.previousPrograms || []
    const upList   = data?.upcomingPrograms || data?.upcoming  || data?.data?.upcomingPrograms  || []

    return {
      serverTime,
      currentProgram: {
        ytVideoId: curr.ytVideoId || curr.videoId || curr.yt_video_id,
        title:     curr.title || curr.name,
        startTime: curr.startTime || curr.start_time || serverTime,
        endTime:   curr.endTime   || curr.end_time   || serverTime + (curr.duration || 3600) * 1000,
        duration:  curr.duration || 3600,
        seekTo:    curr.seekTo   || curr.seek_to || 0,
      },
      previousPrograms: (Array.isArray(prevList) ? prevList : []).map(mapProg),
      upcomingPrograms: (Array.isArray(upList)   ? upList   : []).map(mapProg),
      _source: 'external-api',
    }
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const channelId = searchParams.get('channel') || CHANNELS[0].id

    const responseHeaders = {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
      'Surrogate-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    }

    // ── 1. Try external API first ──
    const external = await fetchFromExternalAPI(channelId)
    if (external) {
      console.log('✅ External API OK (server-side) — channel:', channelId, 'video:', external.currentProgram.ytVideoId)
      logSyncCall(channelId, 'external-api')
      return NextResponse.json(external, { headers: responseHeaders })
    }

    // ── 2. Fall back to local schedule (Cloudflare blocked or API unavailable) ──
    console.log('📋 Falling back to local schedule for channel:', channelId)
    logSyncCall(channelId, 'local-schedule')

    const serverTime = Date.now()
    const data = getCurrentProgram(channelId)
    const upcomingResult = getUpcomingPrograms(channelId, 10)
    const programs = getChannelPrograms(channelId)

    const programStartTime = serverTime - (data.currentTime * 1000)
    const programEndTime   = programStartTime + (data.program.duration * 1000)

    const currentProgram = {
      ytVideoId: data.program.videoId,
      title:     data.program.title,
      startTime: programStartTime,
      endTime:   programEndTime,
      duration:  data.program.duration,
      seekTo:    data.currentTime,
    }

    const previousPrograms: Array<{ ytVideoId: string; title: string; startTime: number; endTime: number; duration: number }> = []
    let prevEndTime = programStartTime
    for (let i = data.programIndex - 1; i >= 0 && previousPrograms.length < 5; i--) {
      const prog = programs[i]
      const endTime   = prevEndTime
      const startTime = endTime - prog.duration * 1000
      previousPrograms.unshift({ ytVideoId: prog.videoId, title: prog.title, startTime, endTime, duration: prog.duration })
      prevEndTime = startTime
    }
    if (previousPrograms.length < 5 && data.programIndex < 5) {
      const needed = 5 - previousPrograms.length
      for (let i = programs.length - 1; i >= programs.length - needed && i >= 0; i--) {
        const prog = programs[i]
        const endTime   = prevEndTime
        const startTime = endTime - prog.duration * 1000
        previousPrograms.unshift({ ytVideoId: prog.videoId, title: prog.title, startTime, endTime, duration: prog.duration })
        prevEndTime = startTime
      }
    }

    let nextStartTime = programEndTime
    const upcomingPrograms = upcomingResult.upcoming.map(prog => {
      const startTime = nextStartTime
      const endTime   = startTime + prog.duration * 1000
      nextStartTime = endTime
      return { ytVideoId: prog.videoId, title: prog.title, startTime, endTime, duration: prog.duration }
    })

    return NextResponse.json({
      serverTime,
      currentProgram,
      previousPrograms,
      upcomingPrograms,
      _source: 'local-schedule',
    }, { headers: responseHeaders })

  } catch (error) {
    console.error('Error in /api/current-video:', error)
    return NextResponse.json(
      { error: 'Failed to fetch current video' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    )
  }
}

export const dynamic = 'force-dynamic'
export const revalidate = 0