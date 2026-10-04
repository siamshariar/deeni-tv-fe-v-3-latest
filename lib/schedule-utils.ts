import { VideoProgram, CurrentVideoData, Channel } from '@/types/schedule'

// Bengali Channel - Updated API data
const BENGALI_VIDEOS: VideoProgram[] = [
  // Current Program
  {
    id: 'b1',
    videoId: 'wlTnG3PvBG8',
    title: 'জুমুআর খুতবাহ্‌ - আল্লাহ কোথায় ? ।। Dr. Imam Hossain',
    description: 'জুমুআর খুতবাহ্‌ - আল্লাহ কোথায় - Dr. Imam Hossain এর আলোচনা',
    duration: 3633,
    category: 'Lecture',
    language: 'Bengali',
    channelId: 'bangla-1',
    thumbnail: 'https://img.youtube.com/vi/wlTnG3PvBG8/maxresdefault.jpg'
  },
  // Previous Programs
  {
    id: 'b2',
    videoId: 'hABN2uy36v8',
    title: 'হিজরতের বিবেক জাগানিয়া শিক্ষা: ঈমান প্রশ্নে আপস নয়',
    description: 'হিজরতের বিবেক জাগানিয়া শিক্ষা সম্পর্কে আলোচনা',
    duration: 1800,
    category: 'Lecture',
    language: 'Bengali',
    channelId: 'bangla-1',
    thumbnail: 'https://img.youtube.com/vi/hABN2uy36v8/maxresdefault.jpg'
  },
  {
    id: 'b3',
    videoId: 'NTtDNHKr-zk',
    title: 'বর্তমান আলেম সমাজের অবস্থা আমাদের করণীয়- ড. খোন্দকার আব্দুল্লাহ জাহাঙ্গীর রাহিমাহুল্লাহ',
    description: 'বর্তমান আলেম সমাজের অবস্থা সম্পর্কে ড. খোন্দকার আব্দুল্লাহ জাহাঙ্গীর এর আলোচনা',
    duration: 1043,
    category: 'Lecture',
    language: 'Bengali',
    channelId: 'bangla-1',
    thumbnail: 'https://img.youtube.com/vi/NTtDNHKr-zk/maxresdefault.jpg'
  },
  {
    id: 'b4',
    videoId: 'mT5HfBlIbKM',
    title: '20.3 সূরা ত্ব-হা ২য় পর্ব (অংশ - ১/৩) ।। Dr. Imam Hossain',
    description: 'সূরা ত্ব-হা ২য় পর্ব - Dr. Imam Hossain এর তাফসীর',
    duration: 1233,
    category: 'Lecture',
    language: 'Bengali',
    channelId: 'bangla-1',
    thumbnail: 'https://img.youtube.com/vi/mT5HfBlIbKM/maxresdefault.jpg'
  },
  {
    id: 'b5',
    videoId: '2C8rGnSyeVA',
    title: 'জেনে নিন ড. খোন্দকার আব্দুল্লাহ জাহঙ্গীর রাহ. ইসলামিক টিভির প্রোগ্রাম দৈনন্দিন জীবনে ইসলাম',
    description: 'দৈনন্দিন জীবনে ইসলাম - ড. খোন্দকার আব্দুল্লাহ জাহাঙ্গীর এর প্রোগ্রাম',
    duration: 1911,
    category: 'Lecture',
    language: 'Bengali',
    channelId: 'bangla-1',
    thumbnail: 'https://img.youtube.com/vi/2C8rGnSyeVA/maxresdefault.jpg'
  },
  {
    id: 'b6',
    videoId: 'EBmlXo-lgcU',
    title: 'আপনার জিজ্ঞাসা ২০২৪ | Apnar Jiggasa | EP 3206 | NTV Islamic Show',
    description: 'আপনার জিজ্ঞাসা - এনটিভি ইসলামিক শো',
    duration: 1362,
    category: 'Q&A',
    language: 'Bengali',
    channelId: 'bangla-1',
    thumbnail: 'https://img.youtube.com/vi/EBmlXo-lgcU/maxresdefault.jpg'
  },
  // Upcoming Programs
  {
    id: 'b7',
    videoId: 't0Xici9CVZo',
    title: '১০. কিতাবুল আদাব। শাইখ শাহীদুল্লাহ খান মাদানী। পিস টিভি বাংলা',
    description: 'কিতাবুল আদাব - শাইখ শাহীদুল্লাহ খান মাদানী এর আলোচনা',
    duration: 1800,
    category: 'Lecture',
    language: 'Bengali',
    channelId: 'bangla-1',
    thumbnail: 'https://img.youtube.com/vi/t0Xici9CVZo/maxresdefault.jpg'
  },
  {
    id: 'b8',
    videoId: 'XTs0pbt0RBw',
    title: '৪.৪ জন্মনিয়ন্ত্রণ ও তার অশুভ পরিণাম। জ্ঞানগর্ভ আলোচনার মঞ্চ। গ্রুপ আলোচনা। পিস টিভি বাংলা',
    description: 'জন্মনিয়ন্ত্রণ ও তার পরিণাম সম্পর্কে জ্ঞানগর্ভ আলোচনা',
    duration: 1799,
    category: 'Lecture',
    language: 'Bengali',
    channelId: 'bangla-1',
    thumbnail: 'https://img.youtube.com/vi/XTs0pbt0RBw/maxresdefault.jpg'
  },
  {
    id: 'b9',
    videoId: 's3B-9ZHhNdM',
    title: 'করোনা পরিস্থিতিতে আকিদা বিশুদ্ধ রাখতে ৫টি বিষয় মাথায় রাখুন',
    description: 'করোনা পরিস্থিতিতে আকিদা বিশুদ্ধ রাখার উপায়',
    duration: 1019,
    category: 'Lecture',
    language: 'Bengali',
    channelId: 'bangla-1',
    thumbnail: 'https://img.youtube.com/vi/s3B-9ZHhNdM/maxresdefault.jpg'
  },
  {
    id: 'b10',
    videoId: 'x04S5VXWL9Q',
    title: 'নির্বাচিত প্রশ্নোত্তর \'শরয়ী সমাধান\'। পর্ব-২৮৫',
    description: 'শরয়ী সমাধান - নির্বাচিত প্রশ্নোত্তর',
    duration: 4022,
    category: 'Q&A',
    language: 'Bengali',
    channelId: 'bangla-1',
    thumbnail: 'https://img.youtube.com/vi/x04S5VXWL9Q/maxresdefault.jpg'
  },
  {
    id: 'b11',
    videoId: 'pOo8X-GQNV8',
    title: 'Live:Tafseerul Quran Surah # 17, AL-ISRA Part-3(Ayat:31-55)',
    description: 'তাফসীরুল কুরআন - সূরা আল-ইসরা (আয়াত ৩১-৫৫)',
    duration: 5923,
    category: 'Tafseer',
    language: 'Bengali',
    channelId: 'bangla-1',
    thumbnail: 'https://img.youtube.com/vi/pOo8X-GQNV8/maxresdefault.jpg'
  },
  {
    id: 'b12',
    videoId: 'alRKQczhJpM',
    title: 'লাইভ : সীরাতে রহমাতুল্লিল আলামিন - ধারাবাহিক আলোচনা - পর্ব -৩',
    description: 'সীরাতে রহমাতুল্লিল আলামিন - ধারাবাহিক আলোচনা',
    duration: 4144,
    category: 'Seerah',
    language: 'Bengali',
    channelId: 'bangla-1',
    thumbnail: 'https://img.youtube.com/vi/alRKQczhJpM/maxresdefault.jpg'
  },
  {
    id: 'b13',
    videoId: 'muYIj4KAIy8',
    title: 'রমাদান বিষয়ক প্রশ্নোত্তরের ধারাবাহিক অনুষ্ঠান (পর্ব-১০)',
    description: 'রমাদান বিষয়ক প্রশ্নোত্তর - পর্ব ১০',
    duration: 2191,
    category: 'Q&A',
    language: 'Bengali',
    channelId: 'bangla-1',
    thumbnail: 'https://img.youtube.com/vi/muYIj4KAIy8/maxresdefault.jpg'
  },
  {
    id: 'b14',
    videoId: 'OxoIOfeTB80',
    title: '।। Dr. Imam Hossain',
    description: 'Dr. Imam Hossain এর আলোচনা',
    duration: 4581,
    category: 'Lecture',
    language: 'Bengali',
    channelId: 'bangla-1',
    thumbnail: 'https://img.youtube.com/vi/OxoIOfeTB80/maxresdefault.jpg'
  },
  {
    id: 'b15',
    videoId: 'UCn1v4ME2tc',
    title: 'জুম\'আর খুতবাহ্ : জিল-হজ্জ মাসের প্রথম দশ দিনের করনীয় আমল সমূহ',
    description: 'জুমআর খুতবাহ - জিল-হজ্জ মাসের আমল সমূহ',
    duration: 3655,
    category: 'Lecture',
    language: 'Bengali',
    channelId: 'bangla-1',
    thumbnail: 'https://img.youtube.com/vi/UCn1v4ME2tc/maxresdefault.jpg'
  },
  {
    id: 'b16',
    videoId: 'FZ8Zy4IW6MA',
    title: 'আল কুরআনের আলো । পর্ব ৩০১। শাইখ মতিউর রহমান মাদানী । পিস টিভি বাংলা',
    description: 'আল কুরআনের আলো - শাইখ মতিউর রহমান মাদানী',
    duration: 1316,
    category: 'Quran',
    language: 'Bengali',
    channelId: 'bangla-1',
    thumbnail: 'https://img.youtube.com/vi/FZ8Zy4IW6MA/maxresdefault.jpg'
  }
]

// English Channel - offline fallback used only when the live API is unreachable.
// Durations are the real YouTube lengths: the broadcast math depends on them.
const ENGLISH_VIDEOS: VideoProgram[] = [
  {
    id: 'e1',
    videoId: 'TBjvoct0t5E',
    title: 'ALL of your Ramadan Questions Answered | Sh. Waleed Basyouni & Sh. Ammar Alshukry',
    description: 'Q&A on fasting, moon-sighting, health issues & rulings.',
    duration: 8507,
    category: 'Q&A',
    language: 'English',
    channelId: 'english-1',
    thumbnail: 'https://img.youtube.com/vi/TBjvoct0t5E/maxresdefault.jpg'
  },
  {
    id: 'e2',
    videoId: 'jNMXHNinAYE',
    title: "Special Ramadan 2026 Q&A: Work-Life Balance, Qur'an Completions & Fiqh of Fasting | Ust. Tim Humble",
    description: "Answers to common Ramadan questions (work-life balance, Qur'an, fasting).",
    duration: 3554,
    category: 'Q&A',
    language: 'English',
    channelId: 'english-1',
    thumbnail: 'https://img.youtube.com/vi/jNMXHNinAYE/maxresdefault.jpg'
  },
  {
    id: 'e3',
    videoId: 'nMnPiELXfDs',
    title: 'Special Ramadan Q&A | Ask Shaykh YQ #61',
    description: 'Knowledge-focused Q&A with scholar responses.',
    duration: 3302,
    category: 'Q&A',
    language: 'English',
    channelId: 'english-1',
    thumbnail: 'https://img.youtube.com/vi/nMnPiELXfDs/maxresdefault.jpg'
  },
  {
    id: 'e4',
    videoId: 'qyeV34J6riI',
    title: 'Q&A: Making up a Broken Qada Fast by Mufti Abdur Rahman ibn Yusuf',
    description: 'Scholarly discussion on making up missed fasts.',
    duration: 48,
    category: 'Q&A',
    language: 'English',
    channelId: 'english-1',
    thumbnail: 'https://img.youtube.com/vi/qyeV34J6riI/maxresdefault.jpg'
  },
  {
    id: 'e5',
    videoId: 'XOTlqHSCUp0',
    title: 'Can we Abstain from Fasting during Examinations? - Dr Zakir Naik',
    description: 'Scholar answers practical fasting questions for students.',
    duration: 131,
    category: 'Q&A',
    language: 'English',
    channelId: 'english-1',
    thumbnail: 'https://img.youtube.com/vi/XOTlqHSCUp0/maxresdefault.jpg'
  }
]

// Arabic Channel - offline fallback used only when the live API is unreachable.
const ARABIC_VIDEOS: VideoProgram[] = [
  {
    id: 'a1',
    videoId: 'uWA_K1gWws8',
    title: 'اسئلة واجوبة في الصوم والإفطار | الشيخ صالح الفوزان',
    description: 'شرح كبير بأسلوب الأسئلة والأجوبة حول أحكام الصيام',
    duration: 3823,
    category: 'Q&A',
    language: 'Arabic',
    channelId: 'arabic-1',
    thumbnail: 'https://img.youtube.com/vi/uWA_K1gWws8/maxresdefault.jpg'
  },
  {
    id: 'a2',
    videoId: 'Iu2af50jiow',
    title: 'أسئلة دينية عن شهر رمضان | 50 سؤال وجواب',
    description: 'أسئلة وأجوبة تعليمية على شكل اختبار باللغة العربية',
    duration: 1253,
    category: 'Q&A',
    language: 'Arabic',
    channelId: 'arabic-1',
    thumbnail: 'https://img.youtube.com/vi/Iu2af50jiow/maxresdefault.jpg'
  },
  {
    id: 'a3',
    videoId: 'QdmoSCQEH-o',
    title: '30 سؤال وجواب عن شهر رمضان',
    description: 'أسئلة تعليمية عن صيام رمضان',
    duration: 1041,
    category: 'Q&A',
    language: 'Arabic',
    channelId: 'arabic-1',
    thumbnail: 'https://img.youtube.com/vi/QdmoSCQEH-o/maxresdefault.jpg'
  },
  {
    id: 'a4',
    videoId: '5lFSrPoqkMw',
    title: 'اسئلة دينية صعبة واجوبتها عن شهر رمضان',
    description: 'أسئلة وأجوبة إسلامية عميقة عن رمضان',
    duration: 946,
    category: 'Q&A',
    language: 'Arabic',
    channelId: 'arabic-1',
    thumbnail: 'https://img.youtube.com/vi/5lFSrPoqkMw/maxresdefault.jpg'
  }
]

// Define channels - No flags, only channel names
// Channel IDs map to API lid (language/channel IDs)
export const CHANNELS: Channel[] = [
  {
    id: 'bangla-1',
    name: 'বাংলা',
    language: 'Bengali',
    icon: '📺',
    programs: BENGALI_VIDEOS,
  },
  {
    id: 'english-1',
    name: 'English',
    language: 'English',
    icon: '📺',
    programs: ENGLISH_VIDEOS,
  },
  {
    id: 'arabic-1',
    name: 'العربية',
    language: 'Arabic',
    icon: '📺',
    programs: ARABIC_VIDEOS,
  },
  {
    id: 'urdu-1',
    name: 'اردو',
    language: 'Urdu',
    icon: '📺',
    programs: [],
  },
  {
    id: 'chinese-1',
    name: '中文',
    language: 'Chinese',
    icon: '📺',
    programs: [],
  },
  {
    id: 'quran-bangla',
    name: 'কুরআন বাংলা',
    language: 'Bengali',
    icon: '📖',
    programs: [],
  },
  {
    id: 'quran-english',
    name: 'Quran English',
    language: 'English',
    icon: '📖',
    programs: [],
  },
  {
    id: 'quran-arabic',
    name: 'القرآن العربي',
    language: 'Arabic',
    icon: '📖',
    programs: [],
  },
  {
    id: 'quran-chinese',
    name: '古兰经中文',
    language: 'Chinese',
    icon: '📖',
    programs: [],
  },
]

// Map channel IDs to external API lid values
export const CHANNEL_LID_MAP: Record<string, number> = {
  'bangla-1': 5,
  'english-1': 6,
  'arabic-1': 7,
  'urdu-1': 8,
  'chinese-1': 9,
  'quran-bangla': 5,
  'quran-english': 6,
  'quran-arabic': 7,
  'quran-chinese': 9,
}

// Check if channel is a Quran channel
export function isQuranChannel(channelId: string): boolean {
  return channelId.startsWith('quran-')
}

// Get API lid for a channel
export function getChannelLid(channelId: string): number {
  return CHANNEL_LID_MAP[channelId] || 5
}

// Export SCHEDULE for backward compatibility
export const SCHEDULE: VideoProgram[] = BENGALI_VIDEOS

// Types for scheduled preloads
export interface ScheduledPreload {
  programId: string
  preloadTime: number
  videoId: string
}

export interface UpcomingProgramsResult {
  upcoming: VideoProgram[]
  nextStartTimes: number[]
  nextStartAbsolute: number[]
  programIndices: number[]
  scheduledPreloads: ScheduledPreload[]
}

// Master epoch start
export const MASTER_EPOCH_START = Date.UTC(2024, 0, 1, 0, 0, 0)
export const SCHEDULE_VERSION = '1.1.0'

// Local storage keys
export const STORAGE_KEY = 'deeni-tv-channel'
export const PREVIOUS_VIDEOS_KEY_PREFIX = 'deeni-tv-previous-'

// Get saved channel from localStorage
export function getSavedChannel(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch (error) {
    console.error('Error reading from localStorage:', error)
    return null
  }
}

// Save channel to localStorage
export function saveChannel(channelId: string): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, channelId)
  } catch (error) {
    console.error('Error saving to localStorage:', error)
  }
}

// Get previous videos from localStorage for specific channel
export function getPreviousVideos(channelId: string): VideoProgram[] {
  if (typeof window === 'undefined') return []
  try {
    const key = `${PREVIOUS_VIDEOS_KEY_PREFIX}${channelId}`
    const saved = localStorage.getItem(key)
    return saved ? JSON.parse(saved) : []
  } catch (error) {
    console.error('Error reading previous videos:', error)
    return []
  }
}

// Save previous videos to localStorage for specific channel
export function savePreviousVideos(channelId: string, videos: VideoProgram[]): void {
  if (typeof window === 'undefined') return
  try {
    const key = `${PREVIOUS_VIDEOS_KEY_PREFIX}${channelId}`
    // Keep only last 30 videos
    const recentVideos = videos.slice(0, 30)
    localStorage.setItem(key, JSON.stringify(recentVideos))
  } catch (error) {
    console.error('Error saving previous videos:', error)
  }
}

// Add video to previous list for specific channel
export function addToPreviousVideos(channelId: string, video: VideoProgram): VideoProgram[] {
  const previous = getPreviousVideos(channelId)
  
  // Add watched timestamp
  const watchedVideo = {
    ...video,
    watchedAt: Date.now()
  }
  
  // Remove if already exists
  const filtered = previous.filter(v => v.id !== video.id)
  
  // Add to beginning
  const updated = [watchedVideo, ...filtered].slice(0, 30)
  
  // Save to localStorage
  savePreviousVideos(channelId, updated)
  
  return updated
}

// Clear previous videos for a channel (for testing)
export function clearPreviousVideos(channelId: string): void {
  if (typeof window === 'undefined') return
  try {
    const key = `${PREVIOUS_VIDEOS_KEY_PREFIX}${channelId}`
    localStorage.removeItem(key)
  } catch (error) {
    console.error('Error clearing previous videos:', error)
  }
}

// True only when this channel has its own embedded programs (Bangla, English, Arabic).
// Callers use this to detect when getChannelPrograms() is about to substitute
// a different channel's content, so they can surface that instead of staying silent.
export function channelHasEmbeddedPrograms(channelId: string): boolean {
  const channel = CHANNELS.find(c => c.id === resolveLocalChannelId(channelId))
  return !!(channel?.programs && channel.programs.length > 0)
}

// Get channel programs. Accepts either a local id ('english-1') or an API
// channel id ('3'). A channel without embedded programs gets another channel
// of the same language (e.g. Quran - English → English), and only then Bangla.
// This fallback exists so callers never divide by a zero-length schedule —
// it is NOT a substitute for real per-channel content. Check
// channelHasEmbeddedPrograms() first if the caller needs to know whether the
// returned programs actually belong to the requested channel.
export function getChannelPrograms(channelId: string): VideoProgram[] {
  const localId = resolveLocalChannelId(channelId)
  const programs = CHANNELS.find(c => c.id === localId)?.programs
  if (programs && programs.length > 0) return programs

  const lid = CHANNEL_LID_MAP[localId]
  const sameLanguage = CHANNELS.find(c => c.programs.length > 0 && CHANNEL_LID_MAP[c.id] === lid)
  return sameLanguage ? sameLanguage.programs : CHANNELS[0].programs
}

// Get total duration for a channel
export function getTotalScheduleDuration(channelId: string): number {
  const programs = getChannelPrograms(channelId)
  return programs.reduce((sum, prog) => sum + prog.duration, 0)
}

// Core "what's on right now" math, parameterized over an explicit programs
// list so it can be reused for both the embedded CHANNELS data and an
// arbitrary fetched schedule (e.g. public/api/fallback-schedule.json).
function computeCurrentProgramFromList(channelId: string, programs: VideoProgram[]) {
  const now = Date.now()
  const totalDuration = programs.reduce((sum, prog) => sum + prog.duration, 0)

  const elapsedSinceEpoch = Math.floor((now - MASTER_EPOCH_START) / 1000)
  const cyclePosition = elapsedSinceEpoch % totalDuration

  let accumulatedTime = 0
  let currentProgram = programs[0]
  let currentTime = 0
  let programIndex = 0

  for (let i = 0; i < programs.length; i++) {
    const program = programs[i]
    if (cyclePosition >= accumulatedTime && cyclePosition < accumulatedTime + program.duration) {
      currentProgram = program
      currentTime = cyclePosition - accumulatedTime
      programIndex = i
      break
    }
    accumulatedTime += program.duration
  }

  const nextProgram = programs[(programIndex + 1) % programs.length]

  const currentCycleStart = MASTER_EPOCH_START +
    Math.floor((now - MASTER_EPOCH_START) / totalDuration / 1000) * totalDuration * 1000

  const nextProgramStartTime = currentCycleStart +
    (accumulatedTime + currentProgram.duration) * 1000

  const timeRemaining = currentProgram.duration - currentTime

  return {
    program: currentProgram,
    currentTime,
    timeRemaining,
    nextProgram,
    serverTime: now,
    programIndex,
    epochStart: MASTER_EPOCH_START,
    nextProgramStartTime,
    scheduleVersion: SCHEDULE_VERSION,
    totalPrograms: programs.length,
    channelId
  }
}

/**
 * Calculate current program for a specific channel
 */
export function getCurrentProgram(channelId: string): CurrentVideoData & {
  nextProgramStartTime: number
  scheduleVersion: string
  totalPrograms: number
  channelId: string
  // True when this channel has no embedded programs of its own and the
  // returned program is substituted Bangla content instead.
  channelUnavailable: boolean
} {
  const programs = getChannelPrograms(channelId)
  return {
    ...computeCurrentProgramFromList(channelId, programs),
    channelUnavailable: !channelHasEmbeddedPrograms(channelId)
  }
}

/**
 * Get upcoming programs for a channel
 */
export function getUpcomingPrograms(channelId: string, count: number = 15): UpcomingProgramsResult {
  const current = getCurrentProgram(channelId)
  const programs = getChannelPrograms(channelId)
  const currentIndex = current.programIndex
  
  const upcoming: VideoProgram[] = []
  const nextStartTimes: number[] = []
  const nextStartAbsolute: number[] = []
  const programIndices: number[] = []
  const scheduledPreloads: ScheduledPreload[] = []

  let offset = current.timeRemaining
  let absoluteTime = current.nextProgramStartTime

  for (let i = 1; i <= count; i++) {
    const index = (currentIndex + i) % programs.length
    const prog = programs[index]
    
    upcoming.push(prog)
    programIndices.push(index)

    nextStartTimes.push(offset)
    nextStartAbsolute.push(absoluteTime)

    offset += prog.duration
    absoluteTime += prog.duration * 1000
  }

  return {
    upcoming,
    nextStartTimes,
    nextStartAbsolute,
    programIndices,
    scheduledPreloads
  }
}

/**
 * Check scheduled preloads (for preload service)
 */
export function checkScheduledPreloads(channelId: string = getSavedChannel() || 'bangla-1'): ScheduledPreload[] {
  return getUpcomingPrograms(channelId, 20).scheduledPreloads
}

/**
 * Get previous programs from localStorage for a channel
 */
export function getPreviousPrograms(channelId: string, count: number = 15): VideoProgram[] {
  const previous = getPreviousVideos(channelId)
  return previous.slice(0, count)
}

/**
 * Format time in seconds to MM:SS or HH:MM:SS
 */
export function formatTime(seconds: number): string {
  if (seconds < 0) seconds = 0
  
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)
  
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  return `0:${secs.toString().padStart(2, '0')}`
}

/**
 * Calculate an adjusted live seek time for resuming after app backgrounding.
 *
 * @param serverSeekTo  seconds into the current program reported by API
 * @param programDuration  duration of the current program in seconds
 * @param backgroundMs  milliseconds elapsed while app was hidden
 * @param networkMs  milliseconds it took to fetch the API response
 * @param clamp  when true, caps at programDuration; when false, allows overflow
 */
export function getAdjustedLiveSeekTime(
  serverSeekTo: number,
  programDuration: number,
  backgroundMs: number = 0,
  networkMs: number = 0,
  clamp: boolean = true,
): number {
  const offsetSeconds = (backgroundMs + networkMs) / 1000
  const adjusted = serverSeekTo + offsetSeconds
  if (adjusted < 0) return 0
  if (clamp && adjusted > programDuration) return programDuration
  return adjusted
}

/**
 * Format duration in seconds to human readable format
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} secs`
  
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  
  if (hours > 0) {
    if (mins > 0) {
      return `${hours}h ${mins}m`
    }
    return `${hours}h`
  }
  
  if (mins === 1) return `${mins} min`
  return `${mins} mins`
}

// ── API Channel ──
// Exact shape returned by https://api.deeniinfotech.com/api/tv-channels

export interface ApiChannel {
  id: number
  title: string
  localizationId: string
  isQuran: boolean | null
}

export const API_CHANNELS_STORAGE_KEY = 'deeni-tv-channels'

/** Read stored channel list from localStorage (as-is from API) */
export function getStoredApiChannels(): ApiChannel[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(API_CHANNELS_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch {
    return []
  }
}

// Same ids and order as the live tv-channels API, used whenever it is unreachable.
// Keep it in step with the API: channel ids are saved in localStorage and in
// the URLs the player calls, so a different numbering selects the wrong channel.
export const DEFAULT_API_CHANNELS: ApiChannel[] = [
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

/** The API channel for an id — from the stored API list, else the defaults. */
export function findApiChannel(channelId: string): ApiChannel | undefined {
  const byId = (c: ApiChannel) => String(c.id) === channelId
  return getStoredApiChannels().find(byId) ?? DEFAULT_API_CHANNELS.find(byId)
}

/**
 * Map a channel id to its entry in CHANNELS. The player uses API channel ids
 * ('3'), the embedded data uses local ids ('english-1'); the two are matched
 * by language (localizationId) and the Quran flag. Pass `hint` when the
 * caller already knows them (e.g. a server route given ?lid=&iq=).
 */
export function resolveLocalChannelId(
  channelId: string,
  hint?: { lid?: string | number | null; isQuran?: boolean | null }
): string {
  if (CHANNELS.some(c => c.id === channelId)) return channelId
  const apiChannel = hint?.lid != null && hint.lid !== ''
    ? { localizationId: String(hint.lid), isQuran: hint.isQuran ?? null }
    : findApiChannel(channelId)
  if (!apiChannel) return channelId
  const match = CHANNELS.find(c =>
    String(getChannelLid(c.id)) === String(apiChannel.localizationId) &&
    isQuranChannel(c.id) === (apiChannel.isQuran === true)
  )
  return match?.id ?? channelId
}

/** The language (API localizationId, '5' = Bangla) of a channel, or null if unknown. */
export function getChannelLocalizationId(channelId?: string | null): string | null {
  if (!channelId) return null
  const apiChannel = findApiChannel(channelId)
  if (apiChannel) return String(apiChannel.localizationId)
  return CHANNEL_LID_MAP[channelId] ? String(CHANNEL_LID_MAP[channelId]) : null
}

/** Persist channel list to localStorage exactly as received from the API */
export function saveApiChannels(channels: ApiChannel[]): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(API_CHANNELS_STORAGE_KEY, JSON.stringify(channels))
  } catch (error) {
    console.error('Error saving API channels:', error)
  }
}

function buildLocalProgramRange(programs: VideoProgram[], startTime: number, count: number) {
  const items: Array<{ ytVideoId: string; title: string; duration: number; startTime: number; endTime: number }> = []
  let currentStart = startTime

  for (let i = 0; i < count; i++) {
    const program = programs[i % programs.length]
    const endTime = currentStart + (program.duration * 1000)
    items.push({
      ytVideoId: program.videoId,
      title: program.title,
      duration: program.duration,
      startTime: currentStart,
      endTime,
    })
    currentStart = endTime
  }

  return items
}

/**
 * Build an API-compatible current video response from the embedded CHANNELS data.
 * Used by Android-only client fallback when network fetches fail.
 */
export function buildLocalCurrentVideoResponse(channelId: string, count: number = 15) {
  const current = getCurrentProgram(channelId)
  const programs = getChannelPrograms(channelId)
  const currentStartTime = current.serverTime - (current.currentTime * 1000)
  const currentEndTime = currentStartTime + (current.program.duration * 1000)

  const upcomingPrograms = getUpcomingPrograms(channelId, count).upcoming
  const previousPrograms = getPreviousPrograms(channelId, count)

  return {
    serverTime: current.serverTime,
    currentProgram: {
      ytVideoId: current.program.videoId,
      title: current.program.title,
      duration: current.program.duration,
      seekTo: current.currentTime,
      startTime: currentStartTime,
      endTime: currentEndTime,
    },
    previousPrograms: buildLocalProgramRange(previousPrograms.reverse(), currentStartTime - previousPrograms.reduce((sum, program) => sum + program.duration * 1000, 0), Math.min(previousPrograms.length, count)),
    upcomingPrograms: buildLocalProgramRange(upcomingPrograms, currentEndTime, Math.min(upcomingPrograms.length, count)),
    _source: 'local-schedule',
    // True when this channel has no embedded data of its own and the
    // content above is substituted Bangla programming instead.
    channelUnavailable: current.channelUnavailable,
  }
}

/**
 * Same as buildLocalCurrentVideoResponse, but computed from an explicit
 * programs list (e.g. fetched from public/api/fallback-schedule.json)
 * instead of the hardcoded embedded CHANNELS data. Falls back to
 * buildLocalCurrentVideoResponse if the given list is empty.
 */
export function buildLocalCurrentVideoResponseFromPrograms(
  channelId: string,
  programs: VideoProgram[],
  count: number = 15
) {
  if (!programs || programs.length === 0) {
    return buildLocalCurrentVideoResponse(channelId, count)
  }

  const current = computeCurrentProgramFromList(channelId, programs)
  const currentStartTime = current.serverTime - (current.currentTime * 1000)
  const currentEndTime = currentStartTime + (current.program.duration * 1000)

  const upcomingItems: VideoProgram[] = []
  for (let i = 1; i <= count; i++) {
    upcomingItems.push(programs[(current.programIndex + i) % programs.length])
  }

  return {
    serverTime: current.serverTime,
    currentProgram: {
      ytVideoId: current.program.videoId,
      title: current.program.title,
      duration: current.program.duration,
      seekTo: current.currentTime,
      startTime: currentStartTime,
      endTime: currentEndTime,
    },
    // No localStorage-backed watch history for an arbitrary fetched list.
    previousPrograms: [],
    upcomingPrograms: buildLocalProgramRange(upcomingItems, currentEndTime, Math.min(upcomingItems.length, count)),
    _source: 'local-schedule-json',
    channelUnavailable: false,
  }
}

/**
 * Build a channel-list fallback that matches the external API shape.
 * Used by Android-only client fallback when the remote channel API is unavailable.
 */
export function getFallbackApiChannels(): ApiChannel[] {
  return DEFAULT_API_CHANNELS.map(channel => ({ ...channel }))
}

/**
 * Load local schedule data from public assets.
 * Used by Android APK to run fully offline without remote API dependency.
 * 
 * @returns Local schedule data with embedded programs for all channels
 */
export async function loadLocalScheduleData(): Promise<any> {
  if (typeof window === 'undefined') return null
  
  try {
    const response = await fetch('/api/fallback-schedule.json', {
      cache: 'force-cache'
    })
    
    if (!response.ok) {
      console.warn('Failed to load local schedule:', response.status)
      return null
    }
    
    return await response.json()
  } catch (error) {
    console.warn('Error loading local schedule data:', error)
    return null
  }
}

/**
 * Fetch schedule data from local assets on Android.
 * Falls back to embedded CHANNELS if local file not available.
 * 
 * @param channelId - The channel ID to fetch
 * @returns Local schedule response compatible with API format
 */
export async function fetchLocalScheduleData(channelId: string) {
  try {
    // Try to load from local asset first
    const localData = await loadLocalScheduleData()
    if (localData?.channels) {
      // Successfully loaded from local asset
      const localId = resolveLocalChannelId(channelId)
      const channel = localData.channels.find((ch: any) => ch.id === localId)
      if (channel && channel.programs && channel.programs.length > 0) {
        // Use the schedule actually fetched from the JSON asset, not the
        // hardcoded embedded CHANNELS data — this is what makes the JSON
        // file editable (see ANDROID-OFFLINE-GUIDE.md "Update Embedded
        // Schedule") without needing an app rebuild.
        return buildLocalCurrentVideoResponseFromPrograms(channelId, channel.programs, 15)
      }
    }
  } catch (error) {
    console.warn('Error with local asset, falling back to embedded data:', error)
  }

  // Fallback to embedded schedule
  return buildLocalCurrentVideoResponse(channelId, 15)
}