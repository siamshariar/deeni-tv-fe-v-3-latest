// Ported verbatim from the Deeni web app: lib/schedule-utils.ts (lines 3–373)
// at fixes_to_launch a080ec2. Keep in step with the web: the broadcast maths
// depends on these programmes and their real YouTube durations.
import type { Channel, VideoProgram } from '@/types';

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
