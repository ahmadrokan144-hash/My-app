export type ChannelCategory =
  | "all"
  | "local"
  | "sports"
  | "news"
  | "general"
  | "kids"
  | "religious"
  | "culture";

export interface KurdishChannel {
  id: string;
  nameKu: string;
  nameEn: string;
  category: Exclude<ChannelCategory, "all">;
  isLocal?: boolean;
  categoryLabelKu: string;
  categoryLabelEn: string;
  cityKu: string;
  cityEn: string;
  quality: "1080p FHD" | "720p HD";
  logo: string;
  fallbackLogo: string;
  servers: {
    labelKu: string;
    labelEn: string;
    url: string;
    protected?: boolean;
  }[];
  protected?: boolean;
}

const STREAM_SHIELD_SECRET = "OwnPlus_StreamShield_2026_v9";

export function encodeStreamShieldToken(rawUrl: string): string {
  const bytes = new TextEncoder().encode(rawUrl);
  const keyBytes = new TextEncoder().encode(STREAM_SHIELD_SECRET);
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
  }
  let binary = "";
  for (let i = 0; i < out.length; i++) {
    binary += String.fromCharCode(out[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function computeShieldSignature(input: string): string {
  let h1 = 0xdeadbeef ^ input.length;
  let h2 = 0x41c6ce57 ^ input.length;
  const str = `${input}|${STREAM_SHIELD_SECRET}`;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return ((h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0")).slice(0, 12);
}

export function protectChannelServerUrl(url: string, channelId: string): string {
  const trimmed = url.trim();
  const liveDirectMatch = trimmed.match(/^\/live\/(newline1|newline2|kurdmaxshow|asosport|ldsport|zed|avasport1|natgeoad)\/index\.m3u8/i);
  if (liveDirectMatch) {
    return `/live/${liveDirectMatch[1].toLowerCase()}/index.m3u8?raw=1`;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    const s = encodeStreamShieldToken(trimmed);
    const k = computeShieldSignature(trimmed);
    return `/api/hls-proxy/live.m3u8?s=${s}&k=${k}&ch=${encodeURIComponent(channelId)}`;
  }
  if (trimmed.startsWith("/api/hls-proxy")) {
    const qIdx = trimmed.indexOf("?");
    if (qIdx !== -1) {
      const params = new URLSearchParams(trimmed.slice(qIdx + 1));
      const rawTarget = params.get("url");
      if (rawTarget) {
        const s = encodeStreamShieldToken(rawTarget);
        const k = computeShieldSignature(rawTarget);
        params.delete("url");
        params.set("s", s);
        params.set("k", k);
        params.set("ch", channelId);
        return `/api/hls-proxy/live.m3u8?${params.toString()}`;
      }
    }
  }
  if (trimmed.startsWith("/api/alwan-live") || trimmed.startsWith("/api/ownplus-ucl")) {
    const sep = trimmed.includes("?") ? "&" : "?";
    const k = computeShieldSignature(`${trimmed}|${channelId}`);
    return `${trimmed}${sep}k=${k}&ch=${encodeURIComponent(channelId)}`;
  }
  return trimmed;
}

const RAW_KURDISH_CHANNELS: KurdishChannel[] = [
  // ==========================================
  // ١. کەناڵە سەرەکی و ئاسمانییە کوردییەکان
  // ==========================================
  {
    id: "rudaw",
    nameKu: "ڕووداو",
    nameEn: "Rudaw HD",
    category: "news",
    categoryLabelKu: "هەواڵ",
    categoryLabelEn: "News",
    cityKu: "هەولێر",
    cityEn: "Erbil",
    quality: "1080p FHD",
    logo: "/logos/rudaw.png",
    fallbackLogo: "/logos/rudaw-tv.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "https://hlspackager.akamaized.net/live/DB/RUDAW/HLS/RUDAW.m3u8"
      }
    ]
  },
  {
    id: "k24",
    nameKu: "کوردستان ٢٤",
    nameEn: "Kurdistan 24 HD",
    category: "news",
    categoryLabelKu: "هەواڵ",
    categoryLabelEn: "News",
    cityKu: "هەولێر",
    cityEn: "Erbil",
    quality: "1080p FHD",
    logo: "/logos/k24.png",
    fallbackLogo: "/logos/kurdistan24.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (خێرا FHD)",
        labelEn: "Server 1 (Fast FHD)",
        url: "https://hlspackager.akamaized.net/live/DB/K24/HLS/K24.m3u8"
      }
    ]
  },
  {
    id: "ava",
    nameKu: "ئاڤا میدیا",
    nameEn: "AVA Media",
    category: "general",
    isLocal: true,
    categoryLabelKu: "گشتی و خێزانی",
    categoryLabelEn: "Entertainment",
    cityKu: "هەولێر",
    cityEn: "Erbil",
    quality: "1080p FHD",
    logo: "/logos/ava.png",
    fallbackLogo: "/logos/ava-media.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "https://hlspackager.akamaized.net/live/DB/AVA_TV/HLS/AVA_TV.m3u8"
      }
    ]
  },
  {
    id: "channel8",
    nameKu: "کەناڵ ٨",
    nameEn: "Channel 8 HD",
    category: "news",
    categoryLabelKu: "هەواڵ",
    categoryLabelEn: "News",
    cityKu: "سلێمانی",
    cityEn: "Sulaymaniyah",
    quality: "1080p FHD",
    logo: "/logos/channel8.png",
    fallbackLogo: "/logos/channel-8.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "https://hlspackager.akamaized.net/live/DB/CHANNEL_8/HLS/CHANNEL_8.m3u8"
      }
    ]
  },
  {
    id: "nrt",
    nameKu: "ئێن ئاڕ تی",
    nameEn: "NRT HD",
    category: "news",
    categoryLabelKu: "هەواڵ",
    categoryLabelEn: "News",
    cityKu: "سلێمانی",
    cityEn: "Sulaymaniyah",
    quality: "1080p FHD",
    logo: "/logos/nrt.png?v=2",
    fallbackLogo: "/logos/nrt-tv.png?v=2",
    servers: [
      {
        labelKu: "سێرڤەری ١ (خێرا FHD)",
        labelEn: "Server 1 (Fast FHD)",
        url: "https://hlspackager.akamaized.net/live/DB/NRT_HD/HLS/NRT_HD.m3u8"
      }
    ]
  },
  {
    id: "kurdmax",
    nameKu: "کوردماکس",
    nameEn: "Kurdmax",
    category: "general",
    isLocal: true,
    categoryLabelKu: "گشتی و خێزانی",
    categoryLabelEn: "General & Drama",
    cityKu: "هەولێر",
    cityEn: "Erbil",
    quality: "1080p FHD",
    logo: "/logos/kurdmax.png",
    fallbackLogo: "/logos/kurdmax.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/hls-proxy?url=https%3A%2F%2Fstream.kurdmax.tv%2Fapp%2Fkurdmax-sorani1%2Fts%3Aplaylist.m3u8&referer=https%3A%2F%2Fwww.kurdmax.tv%2Flive-stream"
      }
    ]
  },
  {
    id: "kurdmaxshow",
    nameKu: "کوردماکس شۆۆ",
    nameEn: "Kurdmax Show",
    category: "general",
    isLocal: true,
    categoryLabelKu: "گشتی و خێزانی",
    categoryLabelEn: "General & Entertainment",
    cityKu: "هەولێر",
    cityEn: "Erbil",
    quality: "1080p FHD",
    logo: "/logos/kurdmax-show.png?v=3",
    fallbackLogo: "/logos/kurdmax-show.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/live/kurdmaxshow/index.m3u8"
      }
    ]
  },
  {
    id: "newline1",
    nameKu: "نیو لاین ١",
    nameEn: "Newline 1",
    category: "general",
    isLocal: true,
    categoryLabelKu: "گشتی و خێزانی",
    categoryLabelEn: "General & Family",
    cityKu: "هەولێر",
    cityEn: "Erbil",
    quality: "1080p FHD",
    logo: "/logos/newline-1.png?v=4",
    fallbackLogo: "/logos/newline-1.png?v=4",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/live/newline1/index.m3u8"
      }
    ]
  },
  {
    id: "newline2",
    nameKu: "نیو لاین ٢",
    nameEn: "Newline 2",
    category: "general",
    isLocal: true,
    categoryLabelKu: "گشتی و خێزانی",
    categoryLabelEn: "General & Family",
    cityKu: "هەولێر",
    cityEn: "Erbil",
    quality: "1080p FHD",
    logo: "/logos/newline-2.png?v=4",
    fallbackLogo: "/logos/newline-2.png?v=4",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/live/newline2/index.m3u8"
      }
    ]
  },
  {
    id: "zed",
    nameKu: "زێد",
    nameEn: "Zed HD",
    category: "general",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · گشتی",
    categoryLabelEn: "Local · General",
    cityKu: "هەولێر",
    cityEn: "Erbil",
    quality: "1080p FHD",
    logo: "/logos/zed.png?v=1",
    fallbackLogo: "/logos/zed.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/live/zed/index.m3u8"
      }
    ]
  },
  {
    id: "kurdsat",
    nameKu: "کوردسات",
    nameEn: "Kurdsat HD",
    category: "general",
    categoryLabelKu: "گشتی و خێزانی",
    categoryLabelEn: "General",
    cityKu: "سلێمانی",
    cityEn: "Sulaymaniyah",
    quality: "1080p FHD",
    logo: "/logos/kurdsat.png",
    fallbackLogo: "/logos/kurdsat-tv.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (خێرا FHD)",
        labelEn: "Server 1 (Fast FHD)",
        url: "https://hlspackager.akamaized.net/live/DB/KURDSAT_HD/HLS/KURDSAT_HD.m3u8"
      }
    ]
  },
  {
    id: "kurdsatnews",
    nameKu: "کوردسات نیوز",
    nameEn: "Kurdsat News",
    category: "news",
    categoryLabelKu: "هەواڵ",
    categoryLabelEn: "News",
    cityKu: "سلێمانی",
    cityEn: "Sulaymaniyah",
    quality: "1080p FHD",
    logo: "/logos/kurdsat-news.png",
    fallbackLogo: "/logos/kurdsatnews.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (خێرا FHD)",
        labelEn: "Server 1 (Fast FHD)",
        url: "https://hlspackager.akamaized.net/live/DB/KURDSAT_NEWS/HLS/KURDSAT_NEWS.m3u8"
      }
    ]
  },
  {
    id: "galikurdistan",
    nameKu: "گەلی کوردستان",
    nameEn: "Gali Kurdistan",
    category: "news",
    categoryLabelKu: "هەواڵ و گشتی",
    categoryLabelEn: "News & General",
    cityKu: "سلێمانی",
    cityEn: "Sulaymaniyah",
    quality: "1080p FHD",
    logo: "/logos/galikurdistan.png",
    fallbackLogo: "/logos/gali-kurdistan-tv.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (خێرا FHD)",
        labelEn: "Server 1 (Fast FHD)",
        url: "https://live.host247.net/gk/gksat/playlist.m3u8"
      }
    ]
  },
  {
    id: "galikurdistanplus",
    nameKu: "گەلی کورد +",
    nameEn: "GK Plus",
    category: "local",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · هەواڵ و گشتی",
    categoryLabelEn: "Local · General",
    cityKu: "سلێمانی (Mix Media)",
    cityEn: "Sulaymaniyah (Local)",
    quality: "1080p FHD",
    logo: "/logos/gali-kurdistan-plus.png",
    fallbackLogo: "/logos/galikurdistan.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (خێرا FHD)",
        labelEn: "Server 1 (Fast FHD)",
        url: "/api/hls-proxy/live.m3u8?url=https%3A%2F%2Flive.host247.net%2Fgk%2Fgkplus%2Fplaylist.m3u8&transcode=1"
      }
    ]
  },
  {
    id: "kirkuktv",
    nameKu: "کەرکووک تیڤی",
    nameEn: "Kirkuk TV HD",
    category: "news",
    isLocal: true,
    categoryLabelKu: "هەواڵ و گشتی",
    categoryLabelEn: "News & General",
    cityKu: "کەرکووک",
    cityEn: "Kirkuk",
    quality: "1080p FHD",
    logo: "/logos/kirkuk-tv.png",
    fallbackLogo: "/logos/kirkuktv.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (خێرا FHD)",
        labelEn: "Server 1 (Fast FHD)",
        url: "https://live.kirkuklive.live/hls/stream/index.m3u8"
      }
    ]
  },
  {
    id: "kurdistantv",
    nameKu: "کوردستان تیڤی",
    nameEn: "Kurdistan TV HD",
    category: "general",
    categoryLabelKu: "گشتی و خێزانی",
    categoryLabelEn: "General",
    cityKu: "هەولێر",
    cityEn: "Erbil",
    quality: "720p HD",
    logo: "/logos/kurdistantv.png",
    fallbackLogo: "/logos/kurdistan-tv.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (خێرا HD)",
        labelEn: "Server 1 (Fast HD)",
        url: "https://5a3ed7a72ed4b.streamlock.net/live/SMIL:myStream.smil/playlist.m3u8"
      }
    ]
  },
  {
    id: "waartv",
    nameKu: "وار تیڤی",
    nameEn: "Waar TV HD",
    category: "general",
    categoryLabelKu: "گشتی و خێزانی",
    categoryLabelEn: "General",
    cityKu: "دهۆک",
    cityEn: "Duhok",
    quality: "1080p FHD",
    logo: "/logos/waar-tv.png",
    fallbackLogo: "/logos/waartv.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "https://hlspackager.akamaized.net/live/DB/WAAR_HD/HLS/WAAR_HD.m3u8"
      }
    ]
  },
  {
    id: "natgeoabudhabi",
    nameKu: "نات جیۆ",
    nameEn: "Nat Geo AD",
    category: "general",
    categoryLabelKu: "دۆکیومێنتاری · گشتی",
    categoryLabelEn: "Documentary · General",
    cityKu: "ئەبوزەبی / عەرەبی",
    cityEn: "Abu Dhabi (Arabic)",
    quality: "1080p FHD",
    logo: "/logos/nat-geo-abudhabi.svg?v=1",
    fallbackLogo: "/logos/nat-geo-abudhabi.svg?v=1",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/live/natgeoad/index.m3u8"
      }
    ]
  },
  {
    id: "natgeowild",
    nameKu: "نات جیۆ ویڵد",
    nameEn: "Nat Geo Wild",
    category: "general",
    categoryLabelKu: "دۆکیومێنتاری · گشتی",
    categoryLabelEn: "Documentary · General",
    cityKu: "جیهانی (NAT GEO WILD)",
    cityEn: "Global (NAT GEO WILD)",
    quality: "720p HD",
    logo: "/logos/nat-geo-wild.svg?v=1",
    fallbackLogo: "/logos/nat-geo-wild.svg?v=1",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (HD)",
        labelEn: "Official Server (HD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F1618767.m3u8"
      }
    ]
  },
  {
    id: "acemovie",
    nameKu: "ئایس مۆڤی",
    nameEn: "ACE Movie HD",
    category: "general",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · فیلم و سینەما",
    categoryLabelEn: "Local · Movies",
    cityKu: "کوردستان (ACE TV)",
    cityEn: "Kurdistan (ACE TV)",
    quality: "720p HD",
    logo: "/logos/ace-movie.png?v=3",
    fallbackLogo: "/logos/ace-movie.png?v=3",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (HD)",
        labelEn: "Official Server (HD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F1035271.m3u8"
      }
    ]
  },
  {
    id: "osnyahala",
    nameKu: "OSN یاهلا",
    nameEn: "OSN YaHala",
    category: "general",
    categoryLabelKu: "دراما و خێزانی (OSN)",
    categoryLabelEn: "Drama & Entertainment (OSN)",
    cityKu: "ئیمارات / جیهانی (OSN)",
    cityEn: "UAE / MENA (OSN)",
    quality: "1080p FHD",
    logo: "/logos/osn-yahala.png?v=3",
    fallbackLogo: "/logos/osn-yahala.png?v=3",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F1573593.m3u8"
      }
    ]
  },
  {
    id: "osnmoviesaction",
    nameKu: "OSN ئەکشن",
    nameEn: "OSN Action",
    category: "general",
    categoryLabelKu: "فیلم و ئەکشن (OSN)",
    categoryLabelEn: "Movies & Action (OSN)",
    cityKu: "ئیمارات / جیهانی (OSN)",
    cityEn: "UAE / MENA (OSN)",
    quality: "1080p FHD",
    logo: "/logos/osn-movies-action.png?v=3",
    fallbackLogo: "/logos/osn-movies-action.png?v=3",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F1573295.m3u8"
      }
    ]
  },
  {
    id: "zagros",
    nameKu: "زاگرۆس تیڤی",
    nameEn: "Zagros TV HD",
    category: "news",
    categoryLabelKu: "هەواڵ",
    categoryLabelEn: "News",
    cityKu: "هەولێر",
    cityEn: "Erbil",
    quality: "1080p FHD",
    logo: "/logos/zagros.png",
    fallbackLogo: "/logos/zagros-tv.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "https://hlspackager.akamaized.net/live/DB/ZAGROS_TV/HLS/ZAGROS_TV.m3u8"
      }
    ]
  },
  {
    id: "payam",
    nameKu: "پەیام تیڤی",
    nameEn: "Payam TV",
    category: "news",
    categoryLabelKu: "هەواڵ",
    categoryLabelEn: "News",
    cityKu: "سلێمانی",
    cityEn: "Sulaymaniyah",
    quality: "1080p FHD",
    logo: "/logos/payam-tv.png",
    fallbackLogo: "/logos/payam.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "https://hlspackager.akamaized.net/live/DB/PAYAM_TV/HLS/PAYAM_TV.m3u8"
      }
    ]
  },
  {
    id: "cnn",
    nameKu: "سی ئێن ئێن",
    nameEn: "CNN HD",
    category: "news",
    categoryLabelKu: "هەواڵ · جیهانی",
    categoryLabelEn: "News · International",
    cityKu: "ئەتلانتا / جیهانی",
    cityEn: "Atlanta / Global",
    quality: "1080p FHD",
    logo: "/logos/cnn.png?v=2",
    fallbackLogo: "/logos/cnn.png?v=2",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/hls-proxy/live.m3u8?url=https%3A%2F%2Fd3bp6dwmpbdajl.cloudfront.net%2Fv1%2Fmaster%2F3722c60a815c199d9c0ef36c5b73da68a62b09d1%2Fcc-ury0meh5m4nzm%2Findex.m3u8"
      }
    ]
  },
  {
    id: "skynewsarabia",
    nameKu: "سکای نیوز",
    nameEn: "Sky News Arabia",
    category: "news",
    categoryLabelKu: "هەواڵ · جیهانی",
    categoryLabelEn: "News · International",
    cityKu: "ئەبوزەبی",
    cityEn: "Abu Dhabi",
    quality: "1080p FHD",
    logo: "/logos/sky-news-arabia.png",
    fallbackLogo: "/logos/sky-news-arabia.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/hls-proxy/live.m3u8?url=https%3A%2F%2Fstream.skynewsarabia.com%2Fhls%2Fsna_720.m3u8"
      }
    ]
  },

  // ==============================================================
  // ٢. کەناڵە کوردییە ناوخۆییەکان (HD Box / Mix Media / iStar)
  // ==============================================================
  {
    id: "fifaplus",
    nameKu: "فیفا پڵەس",
    nameEn: "FIFA+ Live",
    category: "sports",
    categoryLabelKu: "وەرزشی · جیهانی",
    categoryLabelEn: "Sports · FIFA Official",
    cityKu: "زیوریخ / جیهانی",
    cityEn: "Zurich / Global",
    quality: "1080p FHD",
    logo: "/logos/fifa-plus.png?v=4",
    fallbackLogo: "/logos/fifa-plus.png?v=4",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "https://d2w9q46ikgrcwx.cloudfront.net/v1/master/3722c60a815c199d9c0ef36c5b73da68a62b09d1/cc-of5cbk3sav3w5/v1/sysdata_s_p_a_fifa_7/samsungheadend_us/latest/main/hls/playlist.m3u8"
      }
    ]
  },
  {
    id: "alwansport1",
    nameKu: "ئەلوان ١",
    nameEn: "Alwan Sport 1",
    category: "sports",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · وەرزشی (فەرمی)",
    categoryLabelEn: "Local · Sports (Official)",
    cityKu: "کوردستان (ALWAN LIVE)",
    cityEn: "Kurdistan (ALWAN LIVE)",
    quality: "1080p FHD",
    logo: "/logos/alwan-sport-1.png?v=3",
    fallbackLogo: "/logos/alwan-sport-1.png?v=3",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/alwan-live/1/live.m3u8?q=sd"
      }
    ]
  },
  {
    id: "alwansport2",
    nameKu: "ئەلوان ٢",
    nameEn: "Alwan Sport 2",
    category: "sports",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · وەرزشی (فەرمی)",
    categoryLabelEn: "Local · Sports (Official)",
    cityKu: "کوردستان (ALWAN LIVE)",
    cityEn: "Kurdistan (ALWAN LIVE)",
    quality: "1080p FHD",
    logo: "/logos/alwan-sport-2.png?v=3",
    fallbackLogo: "/logos/alwan-sport-2.png?v=3",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/alwan-live/2/live.m3u8?q=sd"
      }
    ]
  },
  {
    id: "beintod1",
    nameKu: "بین سپۆرت ١",
    nameEn: "beIN Sports 1",
    category: "sports",
    categoryLabelKu: "وەرزشی · فەرمی",
    categoryLabelEn: "Sports · Official",
    cityKu: "قەتەر / جیهانی",
    cityEn: "Global (beIN)",
    quality: "1080p FHD",
    logo: "/logos/bein-sports-1.png?v=2",
    fallbackLogo: "/logos/bein-sports-1.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F1536465.m3u8"
      }
    ]
  },
  {
    id: "beintod2",
    nameKu: "بین سپۆرت ٢",
    nameEn: "beIN Sports 2",
    category: "sports",
    categoryLabelKu: "وەرزشی · فەرمی",
    categoryLabelEn: "Sports · Official",
    cityKu: "قەتەر / جیهانی",
    cityEn: "Global (beIN)",
    quality: "1080p FHD",
    logo: "/logos/bein-sports-2.png?v=2",
    fallbackLogo: "/logos/bein-sports-2.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F1536466.m3u8"
      }
    ]
  },
  {
    id: "beintod3",
    nameKu: "بین سپۆرت ٣",
    nameEn: "beIN Sports 3",
    category: "sports",
    categoryLabelKu: "وەرزشی · فەرمی",
    categoryLabelEn: "Sports · Official",
    cityKu: "قەتەر / جیهانی",
    cityEn: "Global (beIN)",
    quality: "1080p FHD",
    logo: "/logos/bein-sports-3.png?v=2",
    fallbackLogo: "/logos/bein-sports-3.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F1536467.m3u8"
      }
    ]
  },
  {
    id: "beintod4",
    nameKu: "بین سپۆرت ٤",
    nameEn: "beIN Sports 4",
    category: "sports",
    categoryLabelKu: "وەرزشی · فەرمی",
    categoryLabelEn: "Sports · Official",
    cityKu: "قەتەر / جیهانی",
    cityEn: "Global (beIN)",
    quality: "1080p FHD",
    logo: "/logos/bein-sports-4.png?v=2",
    fallbackLogo: "/logos/bein-sports-4.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F1536472.m3u8"
      }
    ]
  },
  {
    id: "starzplay1",
    nameKu: "ستارزپلەی ١",
    nameEn: "Starzplay 1",
    category: "sports",
    categoryLabelKu: "وەرزشی · ستارزپلەی · UFC",
    categoryLabelEn: "Sports · STARZPLAY · UFC",
    cityKu: "قەتەر / ئیمارات (STARZPLAY)",
    cityEn: "Qatar / MENA (STARZPLAY)",
    quality: "1080p FHD",
    logo: "/assets/aistudio/7FB91019-1048-4ED2-B277-8FC9790D0C27_38ef966f.jpeg",
    fallbackLogo: "/logos/starzplay-sports.png?v=1",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F2098186.m3u8"
      }
    ]
  },
  {
    id: "starzplay2",
    nameKu: "ستارزپلەی ٢",
    nameEn: "Starzplay 2",
    category: "sports",
    categoryLabelKu: "وەرزشی · ستارزپلەی · UFC",
    categoryLabelEn: "Sports · STARZPLAY · UFC",
    cityKu: "قەتەر / ئیمارات (STARZPLAY)",
    cityEn: "Qatar / MENA (STARZPLAY)",
    quality: "1080p FHD",
    logo: "/assets/aistudio/19102D49-36D2-4D41-A8B5-45FEBB30AFDB_7aa82bfd.jpeg",
    fallbackLogo: "/logos/starzplay-sports.png?v=1",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F2098187.m3u8"
      }
    ]
  },
  {
    id: "thmanyah1",
    nameKu: "ثمانیە ١",
    nameEn: "Thmanyah 1",
    category: "sports",
    categoryLabelKu: "وەرزشی · ثمانیە فەرمی",
    categoryLabelEn: "Sports · Thmanyah Official",
    cityKu: "سعودیە (THMANYAH)",
    cityEn: "KSA (THMANYAH SPORTS)",
    quality: "720p HD",
    logo: "/logos/thmanyah-sport-1.png?v=3",
    fallbackLogo: "/logos/thmanyah-sport-1.png?v=3",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (HD)",
        labelEn: "Official Server (HD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F2097488.m3u8"
      }
    ]
  },
  {
    id: "thmanyah2",
    nameKu: "ثمانیە ٢",
    nameEn: "Thmanyah 2",
    category: "sports",
    categoryLabelKu: "وەرزشی · ثمانیە فەرمی",
    categoryLabelEn: "Sports · Thmanyah Official",
    cityKu: "سعودیە (THMANYAH)",
    cityEn: "KSA (THMANYAH SPORTS)",
    quality: "720p HD",
    logo: "/logos/thmanyah-sport-2.png?v=3",
    fallbackLogo: "/logos/thmanyah-sport-2.png?v=3",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (HD)",
        labelEn: "Official Server (HD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F2097491.m3u8"
      }
    ]
  },

  {
    id: "ownplus",
    nameKu: "Own +",
    nameEn: "Own +",
    category: "sports",
    isLocal: true,
    categoryLabelKu: "تایبەت · یارییە دووبارەکان",
    categoryLabelEn: "Exclusive · Football Replays",
    cityKu: "تۆپی پێ · یارییە دووبارەکان",
    cityEn: "Football Replays",
    quality: "720p HD",
    logo: "/assets/aistudio/key-logo-3d.png",
    fallbackLogo: "/assets/aistudio/key-logo-header.png",
    servers: [
      {
        labelKu: "سێرڤەری تۆپی پێ (یارییە دووبارەکان)",
        labelEn: "Football Replays (HD)",
        url: "/api/hls-proxy/live.m3u8?url=https%3A%2F%2F4397879b.wurl.com%2Fmaster%2Ff36d25e7e52f1ba8d7e56eb859c636563214f541%2FUmFrdXRlblRWLWRlX0ZJRkFQbHVzR2VybWFuX0hMUw%2Fplaylist.m3u8&transcode=1&brand=ownplus"
      }
    ]
  },
  {
    id: "alwansport3",
    nameKu: "ئەلوان ٣",
    nameEn: "Alwan Sport 3",
    category: "sports",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · وەرزشی (فەرمی)",
    categoryLabelEn: "Local · Sports (Official)",
    cityKu: "کوردستان (ALWAN LIVE)",
    cityEn: "Kurdistan (ALWAN LIVE)",
    quality: "1080p FHD",
    logo: "/logos/alwan-sport-3.png?v=3",
    fallbackLogo: "/logos/alwan-sport-3.png?v=3",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/alwan-live/3/live.m3u8?q=sd"
      }
    ]
  },
  {
    id: "nrtsport",
    nameKu: "NRT سپۆرت",
    nameEn: "NRT Sport",
    category: "sports",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · وەرزشی",
    categoryLabelEn: "Local · Sports",
    cityKu: "سلێمانی",
    cityEn: "Sulaymaniyah",
    quality: "1080p FHD",
    logo: "/logos/nrt-sport.png?v=2",
    fallbackLogo: "/logos/nrt-sport.png?v=2",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F931930.m3u8&transcode=1"
      }
    ]
  },
  {
    id: "ldsport",
    nameKu: "ئاسۆ سپۆرت",
    nameEn: "Aso Sport",
    category: "sports",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · وەرزشی",
    categoryLabelEn: "Local · Sports",
    cityKu: "هەولێر",
    cityEn: "Erbil",
    quality: "1080p FHD",
    logo: "/logos/aso-sport.png?v=2",
    fallbackLogo: "/logos/aso-sport.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/live/asosport/index.m3u8"
      }
    ]
  },
  {
    id: "avasport1",
    nameKu: "ئاڤا سپۆرت ١",
    nameEn: "AVA Sport 1",
    category: "sports",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · وەرزشی",
    categoryLabelEn: "Local · Sports",
    cityKu: "هەولێر",
    cityEn: "Erbil",
    quality: "1080p FHD",
    logo: "/logos/ava-sport-1.png?v=1",
    fallbackLogo: "/logos/ava-sport.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/live/avasport1/index.m3u8"
      }
    ]
  },
  {
    id: "beinsportsxtra",
    nameKu: "بین ئێکسترا",
    nameEn: "beIN XTRA",
    category: "sports",
    categoryLabelKu: "وەرزشی · جیهانی",
    categoryLabelEn: "Sports · International",
    cityKu: "قەتەر / جیهانی",
    cityEn: "Global",
    quality: "1080p FHD",
    logo: "/logos/bein-sports-xtra.png",
    fallbackLogo: "/logos/bein-sports-xtra.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/hls-proxy/live.m3u8?url=https%3A%2F%2Fbein-xtra-bein.amagi.tv%2Fplaylist.m3u8"
      }
    ]
  },
  {
    id: "elevensports1",
    nameKu: "ئیلێڤن ١",
    nameEn: "Eleven 1",
    category: "sports",
    categoryLabelKu: "وەرزشی · جیهانی",
    categoryLabelEn: "Sports · International",
    cityKu: "ئەوروپا / جیهانی",
    cityEn: "Europe / Global",
    quality: "1080p FHD",
    logo: "/logos/eleven-sports-1.png?v=1",
    fallbackLogo: "/logos/eleven-sports-1.png?v=1",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F11509.m3u8"
      }
    ]
  },
  {
    id: "mutv",
    nameKu: "مانچێستەر تیڤی",
    nameEn: "MUTV",
    category: "sports",
    categoryLabelKu: "وەرزشی · تۆپی پێ",
    categoryLabelEn: "Sports · Football",
    cityKu: "مانچێستەر / بەریتانیا",
    cityEn: "Manchester / UK",
    quality: "1080p FHD",
    logo: "/logos/mutv.png?v=1",
    fallbackLogo: "/logos/mutv.png?v=1",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F717526.m3u8"
      }
    ]
  },
  {
    id: "beinsportsnews",
    nameKu: "بین هەواڵ",
    nameEn: "beIN News",
    category: "sports",
    categoryLabelKu: "وەرزشی · هەواڵی وەرزشی",
    categoryLabelEn: "Sports · Sports News",
    cityKu: "قەتەر / جیهانی",
    cityEn: "Doha / Global",
    quality: "1080p FHD",
    logo: "/logos/bein-sports-news.png?v=1",
    fallbackLogo: "/logos/bein-sports-news.png?v=1",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F1513550.m3u8"
      }
    ]
  },
  {
    id: "canalplussport1",
    nameKu: "کەناڵ+ ١",
    nameEn: "Canal+ 1",
    category: "sports",
    categoryLabelKu: "وەرزشی · ئەوروپی",
    categoryLabelEn: "Sports · European",
    cityKu: "ئەوروپا / جیهانی",
    cityEn: "Europe / Global",
    quality: "1080p FHD",
    logo: "/logos/canal-plus-sport-1.png?v=1",
    fallbackLogo: "/logos/canal-plus-sport-1.png?v=1",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F18013.m3u8&transcode=1"
      }
    ]
  },
  {
    id: "canalplussport2",
    nameKu: "کەناڵ+ ٢",
    nameEn: "Canal+ 2",
    category: "sports",
    categoryLabelKu: "وەرزشی · ئەوروپی",
    categoryLabelEn: "Sports · European",
    cityKu: "ئەوروپا / جیهانی",
    cityEn: "Europe / Global",
    quality: "1080p FHD",
    logo: "/logos/canal-plus-sport-2.png?v=1",
    fallbackLogo: "/logos/canal-plus-sport-2.png?v=1",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F18014.m3u8&transcode=1"
      }
    ]
  },
  {
    id: "canalplussport3",
    nameKu: "کەناڵ+ ٣",
    nameEn: "Canal+ 3",
    category: "sports",
    categoryLabelKu: "وەرزشی · ئەوروپی",
    categoryLabelEn: "Sports · European",
    cityKu: "ئەوروپا / جیهانی",
    cityEn: "Europe / Global",
    quality: "1080p FHD",
    logo: "/logos/canal-plus-sport-3.png?v=1",
    fallbackLogo: "/logos/canal-plus-sport-3.png?v=1",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F42359.m3u8"
      }
    ]
  },
  {
    id: "canalplussport4",
    nameKu: "کەناڵ+ ٤",
    nameEn: "Canal+ 4",
    category: "sports",
    categoryLabelKu: "وەرزشی · ئەوروپی",
    categoryLabelEn: "Sports · European",
    cityKu: "ئەوروپا / جیهانی",
    cityEn: "Europe / Global",
    quality: "1080p FHD",
    logo: "/logos/canal-plus-sport-4.png?v=1",
    fallbackLogo: "/logos/canal-plus-sport-4.png?v=1",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F42360.m3u8"
      }
    ]
  },
  {
    id: "cbssportshq",
    nameKu: "CBS سپۆرت",
    nameEn: "CBS Sports",
    category: "sports",
    categoryLabelKu: "وەرزشی · جیهانی",
    categoryLabelEn: "Sports · US & Global",
    cityKu: "نیویۆرک / جیهانی",
    cityEn: "New York / Global",
    quality: "1080p FHD",
    logo: "/logos/cbs-sports-hq.png?v=1",
    fallbackLogo: "/logos/cbs-sports-hq.png?v=1",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F8245.m3u8"
      }
    ]
  },
  {
    id: "realmadridtv",
    nameKu: "ڕیاڵ مەدرید",
    nameEn: "Real Madrid TV",
    category: "sports",
    categoryLabelKu: "وەرزشی · جیهانی",
    categoryLabelEn: "Sports · Football",
    cityKu: "مەدرید / ئیسپانیا",
    cityEn: "Madrid / Spain",
    quality: "1080p FHD",
    logo: "/logos/real-madrid-tv.png",
    fallbackLogo: "/logos/real-madrid-tv.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "https://rmtv.akamaized.net/hls/live/2043153/rmtv-es-web/master.m3u8"
      }
    ]
  },
  {
    id: "redbulltv",
    nameKu: "ڕێد بوڵ",
    nameEn: "Red Bull TV",
    category: "sports",
    categoryLabelKu: "وەرزشی · جیهانی",
    categoryLabelEn: "Sports · Action & Racing",
    cityKu: "نەمسا / جیهانی",
    cityEn: "Austria / Global",
    quality: "1080p FHD",
    logo: "/logos/redbull-tv.png",
    fallbackLogo: "/logos/redbull-tv.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "https://rbmn-live.akamaized.net/hls/live/590964/BoRB-AT/master.m3u8"
      }
    ]
  },
  {
    id: "omansports",
    nameKu: "عومان سپۆرت",
    nameEn: "Oman Sports",
    category: "sports",
    categoryLabelKu: "وەرزشی · جیهانی",
    categoryLabelEn: "Sports · International",
    cityKu: "مەسقەت",
    cityEn: "Muscat",
    quality: "1080p FHD",
    logo: "/logos/oman-sports.png",
    fallbackLogo: "/logos/oman-sports.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "https://partneta.cdn.mgmlcdn.com/omsport/smil:omsport.stream.smil/chunklist.m3u8"
      }
    ]
  },
  {
    id: "iraqiasports",
    nameKu: "عیراقیە سپۆرت",
    nameEn: "Iraqia Sport",
    category: "sports",
    categoryLabelKu: "وەرزشی · هەرێمی و جیهانی",
    categoryLabelEn: "Sports · Regional",
    cityKu: "بەغدا",
    cityEn: "Baghdad",
    quality: "720p HD",
    logo: "/logos/iraqia-sports.png",
    fallbackLogo: "/logos/iraqia-sports.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (HD)",
        labelEn: "Official Server (HD)",
        url: "https://imn-live.esite-lab.com/hls/iraqia-sports-1.m3u8"
      }
    ]
  },
  {
    id: "aspor",
    nameKu: "ئەی سپۆر",
    nameEn: "A Spor HD",
    category: "sports",
    categoryLabelKu: "وەرزشی · ئەوروپی",
    categoryLabelEn: "Sports · European",
    cityKu: "ئیستانبوڵ",
    cityEn: "Istanbul",
    quality: "1080p FHD",
    logo: "/logos/a-spor.png",
    fallbackLogo: "/logos/a-spor.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "https://rnttwmjcin.turknet.ercdn.net/lcpmvefbyo/aspor/aspor.m3u8"
      }
    ]
  },
  {
    id: "khaktv",
    nameKu: "خاک تیڤی",
    nameEn: "Khak TV",
    category: "local",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · کلتوری و خێزانی",
    categoryLabelEn: "Local · Culture & Family",
    cityKu: "سلێمانی (Mix Media)",
    cityEn: "Sulaymaniyah (Local)",
    quality: "1080p FHD",
    logo: "/logos/khak-tv.png",
    fallbackLogo: "/logos/khak-tv.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (ناوخۆیی FHD)",
        labelEn: "Server 1 (Local FHD)",
        url: "/api/hls-proxy?url=http%3A%2F%2Fbblserver.ddns.net%3A1935%2Fstream%2Fkhakhd%2Fplaylist.m3u8"
      }
    ]
  },
  {
    id: "qellattv",
    nameKu: "قەڵات تیڤی",
    nameEn: "Qellat TV",
    category: "local",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · گشتی و خێزانی",
    categoryLabelEn: "Local · General",
    cityKu: "هەولێر (HD Box / iStar)",
    cityEn: "Erbil (Local)",
    quality: "1080p FHD",
    logo: "/logos/qellat-tv.png",
    fallbackLogo: "/logos/qellat-tv.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (ناوخۆیی FHD)",
        labelEn: "Server 1 (Local FHD)",
        url: "/api/hls-proxy?url=http%3A%2F%2F213.32.255.86%3A1935%2Flive%2FQellat_tv%2Fhawezhd.m3u8"
      }
    ]
  },
  {
    id: "basktv",
    nameKu: "باسک تیڤی",
    nameEn: "Bask TV",
    category: "local",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · گشتی",
    categoryLabelEn: "Local · General",
    cityKu: "کوردستان (HD Box / Mix)",
    cityEn: "Kurdistan (Local)",
    quality: "1080p FHD",
    logo: "/logos/bask-tv.png?v=2",
    fallbackLogo: "/logos/bask-tv.png?v=2",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/hls-proxy?url=http%3A%2F%2Fbaskhd.ddns.net%3A40%2Flive%2Fbaskhd%2Fplaylist.m3u8"
      }
    ]
  },
  {
    id: "mixkurdy",
    nameKu: "میکس کوردی",
    nameEn: "Mix Kurdy",
    category: "local",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · گشتی و خێزانی",
    categoryLabelEn: "Local · Family",
    cityKu: "یونایتد میکس میدیا",
    cityEn: "United Mix Media",
    quality: "1080p FHD",
    logo: "/logos/mixkurdy.png",
    fallbackLogo: "/logos/mixkurdy.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (خێرا FHD)",
        labelEn: "Server 1 (Fast FHD)",
        url: "https://avr.host247.net/live/Mix-kurdy/playlist.m3u8"
      }
    ]
  },
  {
    id: "halabjatv",
    nameKu: "هەڵەبجە تیڤی",
    nameEn: "Halabja TV",
    category: "local",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · کلتوری و گشتی",
    categoryLabelEn: "Local · General",
    cityKu: "هەڵەبجە (Mix Media)",
    cityEn: "Halabja (Local)",
    quality: "1080p FHD",
    logo: "/logos/halabja-tv.png",
    fallbackLogo: "/logos/halabja-tv.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (ناوخۆیی FHD)",
        labelEn: "Server 1 (Local FHD)",
        url: "/api/hls-proxy?url=http%3A%2F%2Fhalabjatv.ddns.net%3A40%2Flive%2Fhalabjatv%2Fplaylist.m3u8"
      }
    ]
  },
  {
    id: "garyantv",
    nameKu: "گەریان تیڤی",
    nameEn: "Garyan TV",
    category: "local",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · گشتی",
    categoryLabelEn: "Local · General",
    cityKu: "هەڵەبجە (Mix Media)",
    cityEn: "Halabja (Local)",
    quality: "1080p FHD",
    logo: "/logos/garyan-tv.png",
    fallbackLogo: "/logos/garyan-tv.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (ناوخۆیی FHD)",
        labelEn: "Server 1 (Local FHD)",
        url: "https://live20.bozztv.com/giatv/giatv-halabja88garyan/halabja88garyan/chunks.m3u8"
      }
    ]
  },
  {
    id: "shartv",
    nameKu: "شار تیڤی",
    nameEn: "Shar TV",
    category: "local",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · گشتی و خێزانی",
    categoryLabelEn: "Local · Family",
    cityKu: "سلێمانی / هەولێر (HD Box)",
    cityEn: "Kurdistan (Local)",
    quality: "1080p FHD",
    logo: "/logos/shar-tv.png",
    fallbackLogo: "/logos/shar-tv.svg",
    servers: [
      {
        labelKu: "سێرڤەری ١ (ناوخۆیی FHD)",
        labelEn: "Server 1 (Local FHD)",
        url: "/api/hls-proxy?url=http%3A%2F%2Favrstream.com%3A1935%2Flive%2FSHARTV%2Fplaylist.m3u8"
      }
    ]
  },
  {
    id: "kurd7",
    nameKu: "کورد ٧",
    nameEn: "Kurd 7",
    category: "local",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · فیلم و زنجیرە",
    categoryLabelEn: "Local · Series & Movies",
    cityKu: "کوردستان (HD Box / iStar)",
    cityEn: "Kurdistan (Local)",
    quality: "1080p FHD",
    logo: "/logos/kurd-7.png",
    fallbackLogo: "/logos/kurd-7.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (ناوخۆیی FHD)",
        labelEn: "Server 1 (Local FHD)",
        url: "/api/hls-proxy?url=http%3A%2F%2Favrstream.com%3A1935%2Flive%2FKurd7HD%2Fplaylist.m3u8"
      }
    ]
  },
  {
    id: "imktv",
    nameKu: "ئای ئێم کەی",
    nameEn: "IMK TV",
    category: "local",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · گشتی و خێزانی",
    categoryLabelEn: "Local · Family",
    cityKu: "کوردستان (HD Box / Mix)",
    cityEn: "Kurdistan (Local)",
    quality: "1080p FHD",
    logo: "/logos/imk-tv.png",
    fallbackLogo: "/logos/imk-tv.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (ناوخۆیی FHD)",
        labelEn: "Server 1 (Local FHD)",
        url: "/api/hls-proxy?url=http%3A%2F%2Fimkhd.ddns.net%3A1935%2Flive%2Fimkhd%2Fplaylist.m3u8"
      }
    ]
  },
  {
    id: "befrintv",
    nameKu: "بەفرین تیڤی",
    nameEn: "Befrin TV",
    category: "local",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · خێزانی و هونەری",
    categoryLabelEn: "Local · Entertainment",
    cityKu: "کوردستان (HD Box / iStar)",
    cityEn: "Kurdistan (Local)",
    quality: "1080p FHD",
    logo: "/logos/befrin-tv.png",
    fallbackLogo: "/logos/befrin-tv.svg",
    servers: [
      {
        labelKu: "سێرڤەری ١ (خێرا FHD)",
        labelEn: "Server 1 (Fast FHD)",
        url: "https://cdn.karwan.tv/befrin-tv/index.m3u8"
      }
    ]
  },
  {
    id: "derintv",
    nameKu: "دێرین تیڤی",
    nameEn: "Derin TV",
    category: "local",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · خێزانی و دراما",
    categoryLabelEn: "Local · Drama & Family",
    cityKu: "کوردستان (HD Box / Mix)",
    cityEn: "Kurdistan (Local)",
    quality: "1080p FHD",
    logo: "/logos/derin-tv.png",
    fallbackLogo: "/logos/derin-tv.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (ناوخۆیی FHD)",
        labelEn: "Server 1 (Local FHD)",
        url: "/api/hls-proxy?url=http%3A%2F%2Fbaskhd.ddns.net%3A40%2Flive%2FDerin%2Fplaylist.m3u8"
      }
    ]
  },
  {
    id: "eurokurd",
    nameKu: "یۆرۆ کورد",
    nameEn: "Euro Kurd",
    category: "local",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · هونەری و گشتی",
    categoryLabelEn: "Local · Entertainment",
    cityKu: "کوردستان (HD Box / Mix)",
    cityEn: "Kurdistan (Local)",
    quality: "1080p FHD",
    logo: "/logos/euro-kurd.png",
    fallbackLogo: "/logos/euro-kurd.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/hls-proxy?url=http%3A%2F%2Fbaskhd.ddns.net%3A40%2Flive%2FEurokurd%2Findex.m3u8"
      }
    ]
  },
  {
    id: "sadatv",
    nameKu: "سەدا تیڤی",
    nameEn: "Sada TV",
    category: "local",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · گشتی",
    categoryLabelEn: "Local · General",
    cityKu: "کوردستان (HD Box / Mix)",
    cityEn: "Kurdistan (Local)",
    quality: "1080p FHD",
    logo: "/logos/sada-tv.png",
    fallbackLogo: "/logos/sada-tv.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/hls-proxy?url=http%3A%2F%2Fbaskhd.ddns.net%3A40%2Flive%2Fsadatv%2Fplaylist.m3u8"
      }
    ]
  },
  {
    id: "shnatv",
    nameKu: "شنە تیڤی",
    nameEn: "Shna TV",
    category: "local",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · خێزانی",
    categoryLabelEn: "Local · Family",
    cityKu: "کوردستان (Mix Media)",
    cityEn: "Kurdistan (Local)",
    quality: "1080p FHD",
    logo: "/logos/shna-tv.png",
    fallbackLogo: "/logos/shna-tv.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (ناوخۆیی FHD)",
        labelEn: "Server 1 (Local FHD)",
        url: "/api/hls-proxy?url=http%3A%2F%2Fshnatv.ddns.net%3A1935%2Flive%2Fshnatv%2Fplaylist.m3u8"
      }
    ]
  },
  {
    id: "walatv",
    nameKu: "وەلا تیڤی",
    nameEn: "Wala TV",
    category: "local",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · گشتی",
    categoryLabelEn: "Local · General",
    cityKu: "چەمچەماڵ (Mix Media)",
    cityEn: "Chamchamal (Local)",
    quality: "1080p FHD",
    logo: "/logos/wala-tv.png",
    fallbackLogo: "/logos/wala-tv.svg",
    servers: [
      {
        labelKu: "سێرڤەری ١ (خێرا FHD)",
        labelEn: "Server 1 (Fast FHD)",
        url: "https://live20.bozztv.com/giatv/giatv-wallatv88/wallatv88/chunks.m3u8"
      }
    ]
  },
  {
    id: "peshmergatv",
    nameKu: "پێشمەرگە تیڤی",
    nameEn: "Peshmerga TV",
    category: "local",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · نیشتمانی و گشتی",
    categoryLabelEn: "Local · National",
    cityKu: "کوردستان (HD Box / Mix)",
    cityEn: "Kurdistan (Local)",
    quality: "1080p FHD",
    logo: "/logos/peshmerga-tv.png",
    fallbackLogo: "/logos/peshmerga-tv.svg",
    servers: [
      {
        labelKu: "سێرڤەری ١ (خێرا FHD)",
        labelEn: "Server 1 (Fast FHD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F123tv.pro%2Flive%2FaSKpxnSj%2FhhewYcb%2F113304.m3u8&transcode=1"
      }
    ]
  },
  {
    id: "esratv",
    nameKu: "ئیسرا تیڤی",
    nameEn: "Esra TV",
    category: "local",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · ئایینی و پەروەردەیی",
    categoryLabelEn: "Local · Educational",
    cityKu: "هەولێر (HD Box / iStar)",
    cityEn: "Erbil (Local)",
    quality: "1080p FHD",
    logo: "/logos/esra-tv.png",
    fallbackLogo: "/logos/esra-tv.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (خێرا FHD)",
        labelEn: "Server 1 (Fast FHD)",
        url: "https://live20.bozztv.com/giatv/giatv-esra2hd_kamalblbas/esra2hd_kamalblbas/playlist.m3u8"
      }
    ]
  },
  {
    id: "peshangtv",
    nameKu: "پێشەنگ تیڤی",
    nameEn: "Peshang TV",
    category: "local",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · پەروەردەیی و گشتی",
    categoryLabelEn: "Local · General",
    cityKu: "کوردستان (HD Box / Mix)",
    cityEn: "Kurdistan (Local)",
    quality: "1080p FHD",
    logo: "/logos/peshang-tv.png",
    fallbackLogo: "/logos/peshang-tv.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (خێرا FHD)",
        labelEn: "Server 1 (Fast FHD)",
        url: "https://stream.forcaroo.com/stream/hls/desktop.m3u8"
      }
    ]
  },
  {
    id: "hormzyartv",
    nameKu: "هۆرمزیار تیڤی",
    nameEn: "Hormzyar TV",
    category: "local",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · ئایینی و گشتی",
    categoryLabelEn: "Local · Religious",
    cityKu: "کوردستان (HD Box / Mix)",
    cityEn: "Kurdistan (Local)",
    quality: "1080p FHD",
    logo: "/logos/hormzyar.png",
    fallbackLogo: "/logos/hormzyar.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (ناوخۆیی FHD)",
        labelEn: "Server 1 (Local FHD)",
        url: "/api/hls-proxy?url=http%3A%2F%2Favrstream.com%3A1935%2Flive%2FHormzyarHD%2Fplaylist.m3u8"
      }
    ]
  },
  {
    id: "komaltv",
    nameKu: "کۆمەڵ تیڤی",
    nameEn: "Komal TV",
    category: "local",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · گشتی",
    categoryLabelEn: "Local · General",
    cityKu: "سلێمانی / هەولێر (Mix)",
    cityEn: "Kurdistan (Local)",
    quality: "1080p FHD",
    logo: "/logos/komal-tv.png",
    fallbackLogo: "/logos/komal-tv.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (خێرا FHD)",
        labelEn: "Server 1 (Fast FHD)",
        url: "https://lbgo.bozztv.com/ssh101/ssh101/onetvkomall/chunks.m3u8"
      }
    ]
  },

  // ==============================================================
  // ٣. کەناڵە ئایینییە ناوخۆیی و ئاسمانییەکان (پشکنراو و کارا)
  // ==============================================================
  {
    id: "amozhgary",
    nameKu: "ئامۆژگاری",
    nameEn: "Amozhgary TV",
    category: "religious",
    isLocal: true,
    categoryLabelKu: "ئایینی",
    categoryLabelEn: "Religious",
    cityKu: "سلێمانی",
    cityEn: "Sulaymaniyah",
    quality: "1080p FHD",
    logo: "/logos/amozhgary.png",
    fallbackLogo: "/logos/amozhgary-tv.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (خێرا FHD)",
        labelEn: "Server 1 (Fast FHD)",
        url: "https://app-live.org/live/3268334b/index.m3u8"
      }
    ]
  },
  {
    id: "makkahquran",
    nameKu: "قورئانی مەککە",
    nameEn: "Makkah Quran",
    category: "religious",
    categoryLabelKu: "ئایینی · قورئانی پیرۆز",
    categoryLabelEn: "Religious · Holy Quran",
    cityKu: "مەککەی پیرۆز",
    cityEn: "Makkah Live",
    quality: "1080p FHD",
    logo: "/logos/makkah-quran-official.png?v=1",
    fallbackLogo: "https://aloula.faulio.com/storage/mediagallery/da/6c/fullhd_7eaf7e165c4cad5b3a45eff65d2011e18be5d670.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "https://cdn-globecast.akamaized.net/live/eds/saudi_quran/hls_roku/index.m3u8"
      }
    ]
  },
  {
    id: "madinahsunnah",
    nameKu: "سوننەتی مەدینە",
    nameEn: "Madinah Sunnah",
    category: "religious",
    categoryLabelKu: "ئایینی · حەدیس و سوننەت",
    categoryLabelEn: "Religious · Prophetic Sunnah",
    cityKu: "مەدینەی پیرۆز",
    cityEn: "Madinah Live",
    quality: "1080p FHD",
    logo: "/logos/madinah-sunnah-official.png?v=1",
    fallbackLogo: "https://aloula.faulio.com/storage/mediagallery/33/92/fullhd_879e557011826f507a045b4e0b4c3b57ba93edae.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "https://cdn-globecast.akamaized.net/live/eds/saudi_sunnah/hls_roku/index.m3u8"
      }
    ]
  },
  {
    id: "shnaquran",
    nameKu: "شنەی قورئان",
    nameEn: "Shna Quran",
    category: "religious",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · قورئانی پیرۆز",
    categoryLabelEn: "Local · Holy Quran",
    cityKu: "کوردستان (Mix Media)",
    cityEn: "Kurdistan (Local)",
    quality: "1080p FHD",
    logo: "/logos/shna-quran.png",
    fallbackLogo: "/logos/shna-quran.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (ناوخۆیی FHD)",
        labelEn: "Server 1 (Local FHD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2Frawshan.ddns.net%3A1935%2Flive%2Frawshantv%2Ftracks-v1a1%2Fmono.m3u8"
      }
    ]
  },
  {
    id: "tvsunnat",
    nameKu: "تیڤی سوننەت",
    nameEn: "TV Sunnat",
    category: "religious",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · ئایینی",
    categoryLabelEn: "Local · Religious",
    cityKu: "کوردستان (HD Box / Mix)",
    cityEn: "Kurdistan (Local)",
    quality: "1080p FHD",
    logo: "/logos/tv-sunnat.png",
    fallbackLogo: "/logos/tv-sunnat.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (خێرا FHD)",
        labelEn: "Server 1 (Fast FHD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F931890.m3u8&transcode=1"
      }
    ]
  },
  {
    id: "emantv",
    nameKu: "ئیمان تیڤی",
    nameEn: "Eman TV",
    category: "religious",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · ئایینی",
    categoryLabelEn: "Local · Religious",
    cityKu: "کوردستان (HD Box / Mix)",
    cityEn: "Kurdistan (Local)",
    quality: "1080p FHD",
    logo: "/logos/emantv.png",
    fallbackLogo: "/logos/emantv.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (خێرا FHD)",
        labelEn: "Server 1 (Fast FHD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F932119.m3u8&transcode=1"
      }
    ]
  },
  {
    id: "mihrabtv",
    nameKu: "میحراب تیڤی",
    nameEn: "Mihrab TV",
    category: "religious",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · قورئان و ئایینی",
    categoryLabelEn: "Local · Religious",
    cityKu: "کوردستان (HD Box / Mix)",
    cityEn: "Kurdistan (Local)",
    quality: "1080p FHD",
    logo: "/logos/mihrab.png",
    fallbackLogo: "/logos/mihrab.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (ناوخۆیی FHD)",
        labelEn: "Server 1 (Local FHD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2Fbaskhd.ddns.net%3A40%2Flive%2FMihrabTV%2Ftracks-v1a1%2Fmono.m3u8"
      }
    ]
  },

  // ==============================================================
  // ٤. کەناڵەکانی منداڵان (Kids Channels)
  // ==============================================================
  {
    id: "kurdmaxpepule",
    nameKu: "پەپولە",
    nameEn: "Kurdmax Pepule",
    category: "kids",
    isLocal: true,
    categoryLabelKu: "منداڵان · کوردی",
    categoryLabelEn: "Kids · Kurdish",
    cityKu: "هەولێر",
    cityEn: "Erbil",
    quality: "1080p FHD",
    logo: "/logos/kurdmax-pepule.png?v=1",
    fallbackLogo: "/logos/kurdmax-pepule.png?v=1",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F123tv.pro%2Flive%2FaSKpxnSj%2FhhewYcb%2F113245.m3u8&transcode=1"
      }
    ]
  },
  {
    id: "mbc3",
    nameKu: "ئێم بی سی ٣",
    nameEn: "MBC 3",
    category: "kids",
    categoryLabelKu: "منداڵان · جیهانی",
    categoryLabelEn: "Kids · International",
    cityKu: "دوبەی / ڕیاز",
    cityEn: "Dubai / Riyadh",
    quality: "1080p FHD",
    logo: "/logos/mbc-3.png?v=2",
    fallbackLogo: "/logos/mbc-3.png?v=2",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/hls-proxy/live.m3u8?url=https%3A%2F%2Fshd-gcp-live.edgenextcdn.net%2Flive%2Fbitmovin-mbc-3-usa%2F5d58265a862a476dc7f97694addb5ded%2Findex.m3u8"
      }
    ]
  },
  {
    id: "cnarabia",
    nameKu: "سی ئێن عەرەبی",
    nameEn: "CN Arabia",
    category: "kids",
    categoryLabelKu: "منداڵان · جیهانی",
    categoryLabelEn: "Kids · Animation",
    cityKu: "دوبەی / جیهانی",
    cityEn: "Dubai / MENA",
    quality: "1080p FHD",
    logo: "/logos/cn-arabia.png?v=2",
    fallbackLogo: "/logos/cn-arabia.png?v=2",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F1881673.m3u8"
      }
    ]
  },
  {
    id: "majd",
    nameKu: "ماجد",
    nameEn: "Majid Kids",
    category: "kids",
    categoryLabelKu: "منداڵان · عەرەبی",
    categoryLabelEn: "Kids · Arabic",
    cityKu: "ئەبوزەبی",
    cityEn: "Abu Dhabi",
    quality: "1080p FHD",
    logo: "/logos/majd.png?v=1",
    fallbackLogo: "/logos/majd.png?v=1",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F1508702.m3u8"
      }
    ]
  },
  {
    id: "boomerang",
    nameKu: "بۆمیڕانگ",
    nameEn: "Boomerang",
    category: "kids",
    categoryLabelKu: "منداڵان · جیهانی",
    categoryLabelEn: "Kids · International",
    cityKu: "لەندەن / جیهانی",
    cityEn: "London / Global",
    quality: "1080p FHD",
    logo: "/logos/boomerang.png?v=1",
    fallbackLogo: "/logos/boomerang.png?v=1",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F123tv.pro%2Flive%2FaSKpxnSj%2FhhewYcb%2F1027293.m3u8"
      }
    ]
  },
  {
    id: "onekids",
    nameKu: "وەن کیدس",
    nameEn: "ONE Kids",
    category: "kids",
    isLocal: true,
    categoryLabelKu: "ناوخۆیی · منداڵان",
    categoryLabelEn: "Local · Kids",
    cityKu: "کوردستان (HD Box / Mix)",
    cityEn: "Kurdistan (Local)",
    quality: "1080p FHD",
    logo: "/logos/one-kids.png",
    fallbackLogo: "/logos/one-kids.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (4K)",
        labelEn: "Official Server (4K)",
        url: "https://lbgo.bozztv.com/ssh101/ssh101/onekids4k/chunks.m3u8"
      }
    ]
  },
  {
    id: "afarintv",
    nameKu: "ئافەرین تیڤی",
    nameEn: "Afarin TV Kids",
    category: "kids",
    isLocal: true,
    categoryLabelKu: "منداڵان",
    categoryLabelEn: "Kids",
    cityKu: "سلێمانی",
    cityEn: "Sulaymaniyah",
    quality: "1080p FHD",
    logo: "/logos/afarintv.png",
    fallbackLogo: "/logos/afarin-tv.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (HD)",
        labelEn: "Official Server (HD)",
        url: "https://65f16f0fdfc51.streamlock.net/afarinTV/livestream/playlist.m3u8"
      }
    ]
  },
  {
    id: "afarinbaxcha",
    nameKu: "ئافەرین باخچە",
    nameEn: "Afarin Baxcha",
    category: "kids",
    isLocal: true,
    categoryLabelKu: "منداڵان",
    categoryLabelEn: "Kids",
    cityKu: "سلێمانی",
    cityEn: "Sulaymaniyah",
    quality: "1080p FHD",
    logo: "/logos/afarinbaxcha.png",
    fallbackLogo: "/logos/afarintv.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "https://5dcabf026b188.streamlock.net/afarinTV/livestream/playlist.m3u8"
      }
    ]
  },
  {
    id: "zaroktv",
    nameKu: "زارۆک سۆرانی",
    nameEn: "Zarok Sorani",
    category: "kids",
    categoryLabelKu: "منداڵان",
    categoryLabelEn: "Kids",
    cityKu: "سۆرانی / کورمانجی",
    cityEn: "Sorani & Kurmanci",
    quality: "720p HD",
    logo: "/logos/zaroktv.png",
    fallbackLogo: "/logos/zarok-tv-sorani.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (سۆرانی)",
        labelEn: "Official Server (Sorani)",
        url: "https://zindisorani.zaroktv.com.tr/hls/stream.m3u8"
      }
    ]
  },
  {
    id: "zaroktvkurmanci",
    nameKu: "زارۆک کورمانجی",
    nameEn: "Zarok Kurmanci",
    category: "kids",
    categoryLabelKu: "منداڵان",
    categoryLabelEn: "Kids",
    cityKu: "ئامەد",
    cityEn: "Diyarbakir",
    quality: "720p HD",
    logo: "/logos/zarok-tv-kurmanci.png",
    fallbackLogo: "/logos/zaroktv.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (کورمانجی HD)",
        labelEn: "Server 1 (Kurmanci HD)",
        url: "https://zindikurmanci.zaroktv.com.tr/hls/stream.m3u8"
      }
    ]
  },

  // ==============================================================
  // ٥. کەناڵەکانی تری بەشەکانی کوردستان و کلتوری و موزیک
  // ==============================================================
  {
    id: "welattv",
    nameKu: "وڵات تیڤی",
    nameEn: "Welat TV HD",
    category: "news",
    categoryLabelKu: "هەواڵ و گشتی",
    categoryLabelEn: "News & General",
    cityKu: "هەولێر / قامیشلۆ",
    cityEn: "Kurdistan",
    quality: "1080p FHD",
    logo: "/logos/welat-tv.png",
    fallbackLogo: "/logos/welat-tv.png",
    servers: [
      {
        labelKu: "سێرڤەری فەرمی (FHD)",
        labelEn: "Official Server (FHD)",
        url: "https://stream.badinan.xyz/welat/tv/playlist.m3u8"
      }
    ]
  },
  {
    id: "iraqiakurdish",
    nameKu: "عیراقیە کوردی",
    nameEn: "Iraqia Kurdish",
    category: "news",
    categoryLabelKu: "هەواڵ",
    categoryLabelEn: "News",
    cityKu: "بەغدا / کوردستان",
    cityEn: "Kurdistan / Iraq",
    quality: "720p HD",
    logo: "/logos/iraqiakurdish.png",
    fallbackLogo: "/logos/al-iraqia-kurdish.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (خێرا HD)",
        labelEn: "Server 1 (Fast HD)",
        url: "https://imn-live.esite-lab.com/hls/iraqia-kurdish.m3u8"
      }
    ]
  },
  {
    id: "rojhelattv",
    nameKu: "ڕۆژهەڵات تیڤی",
    nameEn: "Rojhelat TV HD",
    category: "news",
    categoryLabelKu: "هەواڵ و ڕۆشنبیری",
    categoryLabelEn: "News & Culture",
    cityKu: "ڕۆژهەڵاتی کوردستان",
    cityEn: "Rojhelat",
    quality: "720p HD",
    logo: "/logos/rojhelat-tv.png",
    fallbackLogo: "/logos/rojhelat-tv.svg",
    servers: [
      {
        labelKu: "سێرڤەری ١ (خێرا HD)",
        labelEn: "Server 1 (Fast HD)",
        url: "https://hlspackager.akamaized.net/live/DB/ROJHELAT/HLS/ROJHELAT.m3u8"
      }
    ]
  },
  {
    id: "kurdchannel",
    nameKu: "کورد کەناڵ",
    nameEn: "Kurd Channel",
    category: "culture",
    categoryLabelKu: "کلتوری و گشتی",
    categoryLabelEn: "Culture",
    cityKu: "کوردستان",
    cityEn: "Kurdistan",
    quality: "720p HD",
    logo: "/logos/kurd-channel.png",
    fallbackLogo: "/logos/kurdchannel.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (خێرا HD)",
        labelEn: "Server 1 (Fast HD)",
        url: "https://kurdchhls.wns.live/hls/stream.m3u8"
      }
    ]
  },
  {
    id: "komalatv",
    nameKu: "کۆمەڵە تیڤی",
    nameEn: "Komala TV",
    category: "culture",
    categoryLabelKu: "کلتوری و گشتی",
    categoryLabelEn: "Culture",
    cityKu: "ڕۆژهەڵات",
    cityEn: "Kurdistan",
    quality: "720p HD",
    logo: "/logos/komala-tv.png",
    fallbackLogo: "/logos/komalatv.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (خێرا HD)",
        labelEn: "Server 1 (Fast HD)",
        url: "https://komhls.wns.live/hls/stream.m3u8"
      }
    ]
  },
  {
    id: "medmuzik",
    nameKu: "مەد موزیک",
    nameEn: "Med Muzik HD",
    category: "culture",
    categoryLabelKu: "موزیک و هونەری",
    categoryLabelEn: "Music & Art",
    cityKu: "کوردستان",
    cityEn: "Kurdistan",
    quality: "1080p FHD",
    logo: "/logos/med-muzik.png",
    fallbackLogo: "/logos/med-muzik.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (خێرا FHD)",
        labelEn: "Server 1 (Fast FHD)",
        url: "https://hlspackager.akamaized.net/live/DB/MED_MUSIC/HLS/MED_MUSIC.m3u8"
      }
    ]
  },
  {
    id: "4kurd",
    nameKu: "فۆر کورد",
    nameEn: "4Kurd Music",
    category: "culture",
    categoryLabelKu: "موزیک و هونەری",
    categoryLabelEn: "Music",
    cityKu: "کوردستان",
    cityEn: "Kurdistan",
    quality: "720p HD",
    logo: "/logos/4kurd.svg",
    fallbackLogo: "/logos/4-kurd.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (خێرا HD)",
        labelEn: "Server 1 (Fast HD)",
        url: "https://4kuhls.persiana.live/hls/stream.m3u8"
      }
    ]
  },
  {
    id: "rojavatv",
    nameKu: "ڕۆژئاوا تیڤی",
    nameEn: "Rojava TV HD",
    category: "general",
    categoryLabelKu: "گشتی و خێزانی",
    categoryLabelEn: "General",
    cityKu: "قامیشلۆ",
    cityEn: "Qamishli",
    quality: "1080p FHD",
    logo: "/logos/rojava-tv.png",
    fallbackLogo: "/logos/rojavatv.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (خێرا FHD)",
        labelEn: "Server 1 (Fast FHD)",
        url: "https://hlspackager.akamaized.net/live/DB/ROJAVA_HD/HLS/ROJAVA_HD.m3u8"
      }
    ]
  },
  {
    id: "ronahitv",
    nameKu: "ڕۆناهی تیڤی",
    nameEn: "Ronahi TV HD",
    category: "news",
    categoryLabelKu: "هەواڵ",
    categoryLabelEn: "News",
    cityKu: "قامیشلۆ",
    cityEn: "Qamishli",
    quality: "1080p FHD",
    logo: "/logos/ronahi-tv.png",
    fallbackLogo: "/logos/ronahitv.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (خێرا FHD)",
        labelEn: "Server 1 (Fast FHD)",
        url: "https://hlspackager.akamaized.net/live/DB/RONAHI_TV/HLS/RONAHI_TV.m3u8"
      }
    ]
  },
  {
    id: "sterktv",
    nameKu: "ستێرک تیڤی",
    nameEn: "Sterk TV HD",
    category: "news",
    categoryLabelKu: "هەواڵ",
    categoryLabelEn: "News",
    cityKu: "کوردستان",
    cityEn: "Kurdistan",
    quality: "1080p FHD",
    logo: "/logos/sterk-tv.png",
    fallbackLogo: "/logos/sterktv.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (خێرا FHD)",
        labelEn: "Server 1 (Fast FHD)",
        url: "https://hlspackager.akamaized.net/live/DB/STERK_TV/HLS/STERK_TV.m3u8"
      }
    ]
  },
  {
    id: "trtkurdi",
    nameKu: "TRT کوردی",
    nameEn: "TRT Kurdî",
    category: "general",
    categoryLabelKu: "گشتی و خێزانی",
    categoryLabelEn: "General",
    cityKu: "ئامەد / ئەنقەرە",
    cityEn: "Diyarbakir",
    quality: "720p HD",
    logo: "/logos/trt-kurdi.png",
    fallbackLogo: "/logos/trtkurdi.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (فەرمی HD)",
        labelEn: "Server 1 (Official HD)",
        url: "https://tv-trtkurdi.medya.trt.com.tr/master.m3u8"
      }
    ]
  },
  {
    id: "ilketv",
    nameKu: "ئیلکە تیڤی",
    nameEn: "Ilke TV HD",
    category: "news",
    categoryLabelKu: "هەواڵ و کلتور",
    categoryLabelEn: "News & Culture",
    cityKu: "ئامەد",
    cityEn: "Diyarbakir",
    quality: "1080p FHD",
    logo: "/logos/ilke.png",
    fallbackLogo: "/logos/ilke.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (فەرمی FHD)",
        labelEn: "Server 1 (Official FHD)",
        url: "https://stream.ilketv.com.tr/hls/ilkecanli.m3u8"
      }
    ]
  },
  {
    id: "sercemtv",
    nameKu: "سەرچەم تیڤی",
    nameEn: "Sercem TV HD",
    category: "culture",
    categoryLabelKu: "کلتوری و ئایینی",
    categoryLabelEn: "Culture",
    cityKu: "کوردستان",
    cityEn: "Kurdistan",
    quality: "1080p FHD",
    logo: "/logos/sercem.png",
    fallbackLogo: "/logos/sercem.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (فەرمی FHD)",
        labelEn: "Server 1 (Official FHD)",
        url: "https://canli.sercemtv.com.tr/hls/0/stream.m3u8"
      }
    ]
  },
  {
    id: "ciratv",
    nameKu: "چرا تیڤی",
    nameEn: "Cira TV HD",
    category: "culture",
    categoryLabelKu: "کلتوری و گشتی",
    categoryLabelEn: "Culture",
    cityKu: "شنگال / کوردستان",
    cityEn: "Kurdistan",
    quality: "1080p FHD",
    logo: "/logos/cira-tv.png",
    fallbackLogo: "/logos/ciratv.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (خێرا FHD)",
        labelEn: "Server 1 (Fast FHD)",
        url: "https://hlspackager.akamaized.net/live/DB/CIRA_TV/HLS/CIRA_TV.m3u8"
      }
    ]
  },
  {
    id: "jintv",
    nameKu: "ژن تیڤی",
    nameEn: "Jin TV HD",
    category: "culture",
    categoryLabelKu: "کلتوری و گشتی",
    categoryLabelEn: "Culture",
    cityKu: "کوردستان",
    cityEn: "Kurdistan",
    quality: "720p HD",
    logo: "/logos/jin-tv.png",
    fallbackLogo: "/logos/jintv.png",
    servers: [
      {
        labelKu: "سێرڤەری ١ (فەرمی HD)",
        labelEn: "Server 1 (Official HD)",
        url: "https://live.jintv.org/medialive/jintv.m3u8"
      }
    ]
  }
];

export const KURDISH_CHANNELS: KurdishChannel[] = RAW_KURDISH_CHANNELS.map((channel) => ({
  ...channel,
  servers: channel.servers.slice(0, 1).map((srv) => ({
    labelKu: "سێرڤەری فەرمی (FHD)",
    labelEn: "Official Server (FHD)",
    protected: true,
    url: protectChannelServerUrl(srv.url, channel.id)
  }))
}));



