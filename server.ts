import express from "express";
import http from "http";
import path from "path";
import dotenv from "dotenv";
import fs from "fs";
import crypto from "crypto";
import { spawn, execFile, ChildProcess } from "child_process";
import { Readable } from "stream";
import { createRequire } from "module";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// Enable JSON bodies
app.use(express.json());


// 🔄 30-Minute Server Auto-Refresh Engine
let lastServerSyncTimestamp = Date.now();

function start30MinServerAutoRefresh() {
  const THIRTY_MINUTES_MS = 30 * 60 * 1000;
  setInterval(() => {
    try {
      lastServerSyncTimestamp = Date.now();
      console.log(`[30-Min Auto Refresh] Server state and background sync refreshed at ${new Date().toISOString()}`);
    } catch (err) {
      console.error("Error in 30-minute auto-refresh loop:", err);
    }
  }, THIRTY_MINUTES_MS);
}

start30MinServerAutoRefresh();

// 📡 Server Auto-Refresh API endpoint
app.get("/api/server/sync", (req, res) => {
  res.json({
    status: "ok",
    lastSync: lastServerSyncTimestamp,
    autoRefreshIntervalMinutes: 30,
    serverTime: new Date().toISOString()
  });
});

// 📡 Live Channel Server Overrides Endpoint (ensures iPhone/Android Home Screen PWAs always get latest streams)
const LIVE_SPORT_SERVERS = {
  ownplus: [
    {
      labelKu: "سێرڤەری تۆپی پێ (یارییە دووبارەکان)",
      labelEn: "Football Replays (HD)",
      url: "/api/hls-proxy/live.m3u8?url=https%3A%2F%2F4397879b.wurl.com%2Fmaster%2Ff36d25e7e52f1ba8d7e56eb859c636563214f541%2FUmFrdXRlblRWLWRlX0ZJRkFQbHVzR2VybWFuX0hMUw%2Fplaylist.m3u8&transcode=1&brand=ownplus"
    }
  ],
  newline1: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/live/newline1/index.m3u8"
    }
  ],
  newline2: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/live/newline2/index.m3u8"
    }
  ],
  ldsport: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/live/asosport/index.m3u8"
    }
  ],
  alwansport1: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/api/alwan-live/1/live.m3u8?q=sd"
    }
  ],
  alwansport2: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/api/alwan-live/2/live.m3u8?q=sd"
    }
  ],
  alwansport3: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/api/alwan-live/3/live.m3u8?q=sd"
    }
  ],
  kurdmaxshow: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/live/kurdmaxshow/index.m3u8"
    }
  ],
  nrtsport: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F931930.m3u8&transcode=1"
    }
  ],
  mbc3: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/api/hls-proxy/live.m3u8?url=https%3A%2F%2Fshd-gcp-live.edgenextcdn.net%2Flive%2Fbitmovin-mbc-3-usa%2F5d58265a862a476dc7f97694addb5ded%2Findex.m3u8"
    }
  ],
  cnarabia: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F1881673.m3u8"
    }
  ],
  kurdmaxpepule: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F123tv.pro%2Flive%2FaSKpxnSj%2FhhewYcb%2F113245.m3u8&transcode=1"
    }
  ],
  majd: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F1508702.m3u8"
    }
  ],
  boomerang: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F123tv.pro%2Flive%2FaSKpxnSj%2FhhewYcb%2F1027293.m3u8"
    }
  ],
  galikurdistanplus: [
    {
      labelKu: "سێرڤەری ١ (خێرا FHD)",
      labelEn: "Server 1 (Fast FHD)",
      url: "/api/hls-proxy/live.m3u8?url=https%3A%2F%2Flive.host247.net%2Fgk%2Fgkplus%2Fplaylist.m3u8&transcode=1"
    }
  ],
  emantv: [
    {
      labelKu: "سێرڤەری ١ (خێرا FHD)",
      labelEn: "Server 1 (Fast FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F932119.m3u8&transcode=1"
    }
  ],
  tvsunnat: [
    {
      labelKu: "سێرڤەری ١ (خێرا FHD)",
      labelEn: "Server 1 (Fast FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F931890.m3u8&transcode=1"
    }
  ],
  shnaquran: [
    {
      labelKu: "سێرڤەری ١ (ناوخۆیی FHD)",
      labelEn: "Server 1 (Local FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2Frawshan.ddns.net%3A1935%2Flive%2Frawshantv%2Ftracks-v1a1%2Fmono.m3u8"
    }
  ],
  mihrabtv: [
    {
      labelKu: "سێرڤەری ١ (ناوخۆیی FHD)",
      labelEn: "Server 1 (Local FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2Fbaskhd.ddns.net%3A40%2Flive%2FMihrabTV%2Ftracks-v1a1%2Fmono.m3u8"
    }
  ],
  makkahquran: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "https://cdn-globecast.akamaized.net/live/eds/saudi_quran/hls_roku/index.m3u8"
    }
  ],
  madinahsunnah: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "https://cdn-globecast.akamaized.net/live/eds/saudi_sunnah/hls_roku/index.m3u8"
    }
  ],
  peshmergatv: [
    {
      labelKu: "سێرڤەری ١ (خێرا FHD)",
      labelEn: "Server 1 (Fast FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F123tv.pro%2Flive%2FaSKpxnSj%2FhhewYcb%2F113304.m3u8&transcode=1"
    }
  ],
  cnn: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/api/hls-proxy/live.m3u8?url=https%3A%2F%2Fd3bp6dwmpbdajl.cloudfront.net%2Fv1%2Fmaster%2F3722c60a815c199d9c0ef36c5b73da68a62b09d1%2Fcc-ury0meh5m4nzm%2Findex.m3u8"
    }
  ],
  beinsports1: [
    {
      labelKu: "سێرڤەری فەرمی 1080p (FHD)",
      labelEn: "Official Server 1080p (FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F1536465.m3u8"
    },
    {
      labelKu: "سێرڤەری لایڤ تۆد (FHD)",
      labelEn: "TOD Live Server (FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F1536465.m3u8&transcode=1"
    }
  ],
  beinsports2: [
    {
      labelKu: "سێرڤەری فەرمی 1080p (FHD)",
      labelEn: "Official Server 1080p (FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F1536466.m3u8"
    }
  ],
  beinsports3: [
    {
      labelKu: "سێرڤەری فەرمی 1080p (FHD)",
      labelEn: "Official Server 1080p (FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F1536467.m3u8"
    }
  ],
  beinsports4: [
    {
      labelKu: "سێرڤەری فەرمی 1080p (FHD)",
      labelEn: "Official Server 1080p (FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F1536472.m3u8"
    }
  ],
  beintod1: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F1536465.m3u8"
    }
  ],
  beintod2: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F1536466.m3u8"
    }
  ],
  beintod3: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F1536467.m3u8"
    }
  ],
  beintod4: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F1536472.m3u8"
    }
  ],
  starzplay1: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F2098186.m3u8"
    }
  ],
  starzplay2: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F2098187.m3u8"
    }
  ],
  thmanyah1: [
    {
      labelKu: "سێرڤەری فەرمی (HD)",
      labelEn: "Official Server (HD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F2097488.m3u8"
    }
  ],
  thmanyah2: [
    {
      labelKu: "سێرڤەری فەرمی (HD)",
      labelEn: "Official Server (HD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F2097491.m3u8"
    }
  ],
  natgeoabudhabi: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/live/natgeoad/index.m3u8"
    }
  ],
  natgeowild: [
    {
      labelKu: "سێرڤەری فەرمی (HD)",
      labelEn: "Official Server (HD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F1618767.m3u8"
    }
  ],
  acemovie: [
    {
      labelKu: "سێرڤەری فەرمی (HD)",
      labelEn: "Official Server (HD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F1035271.m3u8"
    }
  ],
  osnyahala: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F1573593.m3u8"
    }
  ],
  osnmoviesaction: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F1573295.m3u8"
    }
  ],
  zed: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/live/zed/index.m3u8"
    }
  ],
  avasport1: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/live/avasport1/index.m3u8"
    }
  ],
  elevensports1: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F11509.m3u8"
    }
  ],
  mutv: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F717526.m3u8"
    }
  ],
  beinsportsnews: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F1513550.m3u8"
    }
  ],
  canalplussport1: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F18013.m3u8&transcode=1"
    }
  ],
  canalplussport2: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F18014.m3u8&transcode=1"
    }
  ],
  canalplussport3: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F42359.m3u8"
    }
  ],
  canalplussport4: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F42360.m3u8"
    }
  ],
  cbssportshq: [
    {
      labelKu: "سێرڤەری فەرمی (FHD)",
      labelEn: "Official Server (FHD)",
      url: "/api/hls-proxy/live.m3u8?url=http%3A%2F%2F195.128.27.253%3A2095%2Flive%2F548607065148%2F955372318450%2F8245.m3u8"
    }
  ]
};

const STREAM_SHIELD_SECRET = "OwnPlus_StreamShield_2026_v9";

function encodeStreamShieldToken(rawUrl: string): string {
  const bytes = Buffer.from(rawUrl, "utf8");
  const keyBytes = Buffer.from(STREAM_SHIELD_SECRET, "utf8");
  const out = Buffer.allocUnsafe(bytes.length);
  for (let i = 0; i < bytes.length; i++) {
    out[i] = bytes[i] ^ keyBytes[i % keyBytes.length];
  }
  return out.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function decodeStreamShieldToken(token: string): string {
  try {
    const b64 = token.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "===".slice((b64.length + 3) % 4);
    const inBuf = Buffer.from(padded, "base64");
    const keyBytes = Buffer.from(STREAM_SHIELD_SECRET, "utf8");
    const out = Buffer.allocUnsafe(inBuf.length);
    for (let i = 0; i < inBuf.length; i++) {
      out[i] = inBuf[i] ^ keyBytes[i % keyBytes.length];
    }
    return out.toString("utf8");
  } catch {
    return "";
  }
}

function computeShieldSignature(input: string): string {
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

function protectServerUrlOnBackend(url: string, channelId: string): string {
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
    const s = encodeStreamShieldToken(trimmed);
    const k = computeShieldSignature(`${trimmed}|${channelId}`);
    return `${trimmed}${sep}s=${s}&k=${k}&ch=${encodeURIComponent(channelId)}`;
  }
  return trimmed;
}

function applyStreamShieldHeaders(req: express.Request, res: express.Response): boolean {
  const ua = String(req.headers["user-agent"] || "");
  if (/\b(curl|wget|python-requests|python-urllib|scrapy|iptv-checker|ffprobe|libcurl|go-http-client|postmanruntime)\b/i.test(ua)) {
    res.status(403).send("Stream Protected by OwnPlus Shield");
    return false;
  }
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Stream-Protection", "OwnPlus-Shield-Active");
  return true;
}

app.get("/api/channels-live", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  const protectedOverrides: Record<string, any[]> = {};
  for (const [chId, servers] of Object.entries(LIVE_SPORT_SERVERS)) {
    protectedOverrides[chId] = servers.map((srv) => ({
      ...srv,
      protected: true,
      url: protectServerUrlOnBackend(srv.url, chId)
    }));
  }
  res.json({ overrides: protectedOverrides });
});

// 📺 Direct M3U Playlist Export Endpoint for beIN Sports channels
app.get(["/api/bein-sports.m3u", "/api/bein-sports-playlist.m3u"], (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const host = req.get("host") || "localhost:3000";
  const protocol = req.protocol === "https" || req.headers["x-forwarded-proto"] === "https" ? "https" : "http";
  const baseUrl = `${protocol}://${host}`;

  const beinChannels = [
    { id: "beinsports1", name: "beIN Sports 1 HD", logo: "/logos/bein-sports-1.png", rawUrl: "http://195.128.27.253:2095/live/548607065148/955372318450/1536465.m3u8" },
    { id: "beinsports2", name: "beIN Sports 2 HD", logo: "/logos/bein-sports-2.png", rawUrl: "http://195.128.27.253:2095/live/548607065148/955372318450/1536466.m3u8" },
    { id: "beinsports3", name: "beIN Sports 3 HD", logo: "/logos/bein-sports-3.png", rawUrl: "http://195.128.27.253:2095/live/548607065148/955372318450/1536467.m3u8" },
    { id: "beinsports4", name: "beIN Sports 4 HD", logo: "/logos/bein-sports-4.png", rawUrl: "http://195.128.27.253:2095/live/548607065148/955372318450/1536472.m3u8" },
    { id: "beintod1", name: "beIN TOD 1 RAW", logo: "/logos/bein-sports-1.png", rawUrl: "http://195.128.27.253:2095/live/548607065148/955372318450/1536465.m3u8" },
    { id: "beintod2", name: "beIN TOD 2 RAW", logo: "/logos/bein-sports-2.png", rawUrl: "http://195.128.27.253:2095/live/548607065148/955372318450/1536466.m3u8" },
    { id: "beintod3", name: "beIN TOD 3 RAW", logo: "/logos/bein-sports-3.png", rawUrl: "http://195.128.27.253:2095/live/548607065148/955372318450/1536467.m3u8" },
    { id: "beintod4", name: "beIN TOD 4 RAW", logo: "/logos/bein-sports-4.png", rawUrl: "http://195.128.27.253:2095/live/548607065148/955372318450/1536472.m3u8" },
    { id: "beinsportsnews", name: "beIN Sports News HD", logo: "/logos/bein-sports-news.png", rawUrl: "http://195.128.27.253:2095/live/548607065148/955372318450/1513550.m3u8" },
    { id: "beinsportsxtra", name: "beIN Sports XTRA", logo: "/logos/bein-sports-xtra.png", rawUrl: "https://bein-xtra-bein.amagi.tv/playlist.m3u8" }
  ];

  const m3uLines = ["#EXTM3U url-tvg=\"\" tvg-shift=0"];
  for (const ch of beinChannels) {
    const fullStreamPath = protectServerUrlOnBackend(
      ch.rawUrl.startsWith("http") ? `/api/hls-proxy/live.m3u8?url=${encodeURIComponent(ch.rawUrl)}` : ch.rawUrl,
      ch.id
    );
    m3uLines.push(`#EXTINF:-1 tvg-id="${ch.id}" tvg-name="${ch.name}" tvg-logo="${baseUrl}${ch.logo}" group-title="beIN Sports",${ch.name} (FHD)`);
    m3uLines.push(`${baseUrl}${fullStreamPath}`);
  }

  res.setHeader("Content-Type", "application/x-mpegurl; charset=utf-8");
  res.setHeader("Content-Disposition", 'attachment; filename="bein_sports_ownplus.m3u"');
  return res.send(m3uLines.join("\n") + "\n");
});

// 📺 Ultra-Fast HLS Stream Proxy & Mobile-Compatible DVB-T2 HEVC->H.264 Transcoder
const resolveFfmpegBin = (): string => {
  if (fs.existsSync("/usr/bin/ffmpeg")) {
    return "/usr/bin/ffmpeg";
  }
  try {
    const req = createRequire(import.meta.url);
    const installer = req("@ffmpeg-installer/ffmpeg");
    const installerBin = installer && typeof installer.path === "string" ? installer.path : "";
    if (installerBin && fs.existsSync(installerBin)) {
      return installerBin;
    }
  } catch {}
  return "ffmpeg";
};
const FFMPEG_BIN = resolveFfmpegBin();
const redirectCache = new Map<string, { finalUrl: string; expires: number }>();
const playlistCache = new Map<string, { body: string; expires: number }>();
const transcodeCache = new Map<string, Buffer>();
const rawSegmentCache = new Map<string, Buffer>();
const activeRawSegmentFetches = new Map<string, Promise<Buffer>>();

// 🌐 Direct H.264 + AAC & FHD Alwan Sport 1, 2, 3 Upstream Feeds
const alwanDirectH264Feeds: Record<number, { sd: string; hd: string; hdNeedsTranscode?: boolean }> = {
  1: {
    sd: "http://195.128.27.253:2095/live/548607065148/955372318450/1859034.m3u8",
    hd: "http://195.128.27.253:2095/live/548607065148/955372318450/2098819.m3u8",
    hdNeedsTranscode: true
  },
  2: {
    sd: "http://195.128.27.253:2095/live/548607065148/955372318450/2098821.m3u8",
    hd: "http://195.128.27.253:2095/live/548607065148/955372318450/1859033.m3u8"
  },
  3: {
    sd: "http://195.128.27.253:2095/live/548607065148/955372318450/1859032.m3u8",
    hd: "http://195.128.27.253:2095/live/548607065148/955372318450/2098822.m3u8",
    hdNeedsTranscode: true
  }
};

function prefetchRawSegment(segUrl: string) {
  if (rawSegmentCache.has(segUrl) || activeRawSegmentFetches.has(segUrl)) return;
  const inflight = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const useVlcUa =
        /:2095\b|:8090\b|123tv\.pro|89\.31\.211\.25|103\.205\.17\.151|\/live\/play\/|195\.128\.27\.|37\.58\.48\.|212\.95\.38\.186|8kultra\.org|tahpascal78\.space|tectonbrand\.com/i.test(
          segUrl
        );
      const up = await fetch(segUrl, {
        headers: {
          "User-Agent": useVlcUa
            ? "VLC/3.0.18 LibVLC/3.0.18"
            : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          Accept: "*/*"
        },
        signal: controller.signal,
        redirect: "follow"
      });
      if (!up.ok) throw new Error(`HTTP ${up.status}`);
      const ab = await up.arrayBuffer();
      const buf = Buffer.from(ab);
      if (buf.length > 0) {
        if (rawSegmentCache.size >= 48) {
          const oldest = rawSegmentCache.keys().next().value;
          if (oldest) rawSegmentCache.delete(oldest);
        }
        rawSegmentCache.set(segUrl, buf);
      }
      return buf;
    } finally {
      clearTimeout(timeout);
      activeRawSegmentFetches.delete(segUrl);
    }
  })();
  inflight.catch(() => {});
  activeRawSegmentFetches.set(segUrl, inflight);
}


interface HlsLiveSession {
  sessionId: string;
  targetUrl: string;
  brand: string;
  dir: string;
  proc: ChildProcess;
  lastAccess: number;
  readyAt: number;
  pacedHeadSeg: number;
  lastStepAt: number;
  segDurations: Map<number, string>;
  lastPlaylist: string | null;
  readyPromise: Promise<boolean>;
  cleanup?: () => void;
}

const liveSessions = new Map<string, HlsLiveSession>();
const sessionLocks = new Map<string, Promise<HlsLiveSession | null>>();

// Track active viewer so background Preview tabs never steal single-connection Xtream streams from the Home Screen app
let activeStreamOwner: {
  sessionId: string;
  ts: number;
  sa: boolean;
  lastSeen: number;
} = {
  sessionId: "",
  ts: 0,
  sa: false,
  lastSeen: 0
};

function stopLiveSession(session: HlsLiveSession | null) {
  if (!session) return;
  try {
    session.cleanup?.();
  } catch {}
  try {
    if (session.proc.exitCode === null && !session.proc.killed) {
      session.proc.kill("SIGKILL");
    }
  } catch {}
  try {
    fs.rmSync(session.dir, { recursive: true, force: true });
  } catch {}
}

// Cleanup idle continuous transcode sessions after inactivity
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of liveSessions.entries()) {
    const maxIdle = session.brand === "series" ? 180_000 : 30_000;
    if (now - session.lastAccess > maxIdle) {
      liveSessions.delete(id);
      stopLiveSession(session);
    }
  }
}, 5_000);

function isSegmentClosedByFfmpeg(dir: string, segFile: string): boolean {
  try {
    const filePath = path.join(dir, segFile);
    if (!fs.existsSync(filePath)) return false;
    if (fs.existsSync(`${filePath}.tmp`)) return false;
    const st = fs.statSync(filePath);
    return st.size > 1024;
  } catch {
    return false;
  }
}

function getCompletedSegmentNumbers(dir: string): number[] {
  try {
    if (!fs.existsSync(dir)) return [];
    const m3u8Path = path.join(dir, "index.m3u8");
    const nums: number[] = [];
    if (fs.existsSync(m3u8Path)) {
      const raw = fs.readFileSync(m3u8Path, "utf8");
      const seen = new Set<number>();
      for (const line of raw.split(/\r?\n/)) {
        const m = line.trim().match(/^seg_(\d+)\.ts$/i);
        if (m) {
          const seq = parseInt(m[1], 10);
          if (!seen.has(seq) && isSegmentClosedByFfmpeg(dir, `seg_${seq}.ts`)) {
            seen.add(seq);
            nums.push(seq);
          }
        }
      }
      if (nums.length > 0) {
        nums.sort((a, b) => a - b);
        return nums;
      }
    }
    const files = fs.readdirSync(dir);
    for (const f of files) {
      const m = f.match(/^seg_(\d+)\.ts$/i);
      if (m && isSegmentClosedByFfmpeg(dir, f)) {
        nums.push(parseInt(m[1], 10));
      }
    }
    nums.sort((a, b) => a - b);
    return nums;
  } catch {
    return [];
  }
}

let globalEnsureLock: Promise<any> = Promise.resolve();

function ensureHlsLiveSession(targetUrl: string, brand: string, startSec = 0): Promise<HlsLiveSession | null> {
  const cleanStartSec = Number.isFinite(startSec) && startSec > 0 ? Math.floor(startSec) : 0;
  const sessionId = crypto
    .createHash("md5")
    .update(`${targetUrl}|${brand}|ss=${cleanStartSec}|v9`)
    .digest("hex")
    .slice(0, 12);

  const existing = liveSessions.get(sessionId);
  if (existing && existing.proc.exitCode === null && !existing.proc.killed) {
    existing.lastAccess = Date.now();
    return Promise.resolve(existing);
  }

  const next = globalEnsureLock.then(async () => {
    const current = liveSessions.get(sessionId);
    if (current && current.proc.exitCode === null && !current.proc.killed) {
      current.lastAccess = Date.now();
      return current;
    }

    // Kill any existing FFmpeg sessions before spawning a new FFmpeg process so single-connection Xtream upstream is immediately free
    let killedAny = false;
    for (const [id, s] of liveSessions.entries()) {
      liveSessions.delete(id);
      stopLiveSession(s);
      killedAny = true;
    }
    if (killedAny) {
      await new Promise((r) => setTimeout(r, 250));
    }

    const dir = path.join("/tmp", "hls_live", sessionId);
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      fs.mkdirSync(dir, { recursive: true });
    } catch {}

    const falconMatch = brand.match(/^falcon([1-4])$/i);
    const isOwnPlus = /^ownplus$/i.test(brand);
    const bugPath = falconMatch
      ? path.join(process.cwd(), "public", "logos", "tv_bugs", `falcon-${falconMatch[1]}.png`)
      : isOwnPlus
      ? path.join(process.cwd(), "public", "assets", "aistudio", "own_logo_no_tm_transparent_3cc8ece6.png")
      : "";
    const hasBug = Boolean(bugPath && fs.existsSync(bugPath));

    const resolvedTargetUrl = targetUrl;

    // For Xtream :2095 and 123tv.pro live streams, use continuous MPEG-TS (.ts) input so FFmpeg never hits single-use .m3u8 redirect tokens
    const isXtreamLiveM3u8 = /(:2095\/live\/|123tv\.pro\/live\/).*\.m3u8(\?|$)/i.test(
      resolvedTargetUrl
    );
    const streamInputUrl = isXtreamLiveM3u8
      ? resolvedTargetUrl.replace(/\.m3u8(\?.*)?$/i, ".ts")
      : resolvedTargetUrl;
    const isAsteraSource = /\/(931992|931996)\./.test(streamInputUrl);
    const isVodFile = /\.(mkv|mp4|avi)(\?|$)/i.test(streamInputUrl) || brand === "series" || brand === "vod";
    const isDirectTsStream = /\.ts(\?|$)/i.test(streamInputUrl);
    const isM3u8Stream = /\.m3u8(\?|$)/i.test(streamInputUrl);

    const vodMeta = isVodFile ? await probeVodMetadata(streamInputUrl) : { audioMap: "0:a:0?", duration: 0 };
    const vodAudioMap = vodMeta.audioMap;

    // Static FFmpeg binaries (used on Cloud Run Publish) segfault on glibc DNS lookup for hostname URLs
    // and can stall when reconnecting expired 302 tokens; pipe live .ts / .m3u8 streams via Node.js fetch() -> pipe:0.
    const useNodePipeInput = (isDirectTsStream || isM3u8Stream) && !isVodFile;

    const ffArgs: string[] = [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-fflags",
      "+genpts+igndts+discardcorrupt",
      "-probesize",
      isVodFile ? "300000" : "250000",
      "-analyzeduration",
      isVodFile ? "300000" : "600000",
      ...(useNodePipeInput
        ? []
        : [
            "-user_agent",
            "VLC/3.0.18 LibVLC/3.0.18",
            "-rw_timeout",
            "15000000",
            "-reconnect",
            "1",
            "-reconnect_streamed",
            "1",
            "-reconnect_delay_max",
            "2",
            ...(isVodFile || isDirectTsStream ? [] : ["-live_start_index", "-2"])
          ]),
      "-err_detect",
      "ignore_err",
      "-thread_queue_size",
      "2048",
      "-threads",
      "0",
      ...(isVodFile && cleanStartSec > 0 ? ["-ss", String(cleanStartSec)] : []),
      "-i",
      useNodePipeInput ? "pipe:0" : streamInputUrl
    ];

    if (hasBug && isOwnPlus) {
      ffArgs.push(
        "-i",
        bugPath,
        "-filter_complex",
        "[0:v]fps=25,setpts=PTS-STARTPTS,scale=960:540:flags=fast_bilinear[bg];[1:v]crop=2512:853:37:2,scale=118:40[bug];[bg][bug]overlay=x=822:y=14:format=auto,format=yuv420p[v]",
        "-map",
        "[v]",
        "-map",
        "0:a?"
      );
    } else if (hasBug) {
      const delogoChain = isAsteraSource
        ? "delogo=x=539:y=18:w=72:h=19"
        : "delogo=x=10:y=6:w=28:h=12,delogo=x=539:y=18:w=72:h=19";
      ffArgs.push(
        "-i",
        bugPath,
        "-filter_complex",
        `[0:v]fps=25,setpts=PTS-STARTPTS,scale=640:360:flags=fast_bilinear,${delogoChain}[bg];[bg][1:v]overlay=x=539:y=24:format=auto,format=yuv420p[v]`,
        "-map",
        "[v]",
        "-map",
        "0:a?"
      );
    } else if (isVodFile) {
      ffArgs.push(
        "-map",
        "0:v:0",
        "-map",
        vodAudioMap,
        "-sn",
        "-vf",
        "fps=25,setpts=PTS-STARTPTS,scale=854:480:flags=fast_bilinear,format=yuv420p"
      );
    } else {
      ffArgs.push(
        "-map",
        "0:v:0",
        "-map",
        "0:a:0?",
        "-sn",
        "-vf",
        "fps=25,setpts=PTS-STARTPTS,scale=960:540:flags=fast_bilinear,format=yuv420p"
      );
    }

    const m3u8Path = path.join(dir, "index.m3u8");
    const segPattern = path.join(dir, "seg_%d.ts");

    ffArgs.push(
      "-vsync",
      "cfr",
      "-r",
      "25",
      "-c:v",
      "libx264",
      "-preset",
      "ultrafast",
      "-tune",
      "zerolatency",
      "-profile:v",
      "main",
      "-level",
      "3.1",
      "-pix_fmt",
      "yuv420p",
      "-b:v",
      hasBug && !isOwnPlus ? "900k" : "1100k",
      "-maxrate",
      hasBug && !isOwnPlus ? "1200k" : "1500k",
      "-bufsize",
      hasBug && !isOwnPlus ? "2400k" : "3000k",
      "-g",
      "50",
      "-keyint_min",
      "50",
      "-sc_threshold",
      "0",
      ...(isVodFile ? ["-force_key_frames", "expr:gte(t,n_forced*2)"] : []),
      "-af",
      "aresample=async=1000:min_hard_comp=0.100000:first_pts=0",
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      "-ac",
      "2",
      "-ar",
      "44100",
      "-max_muxing_queue_size",
      "1024",
      "-f",
      "hls",
      "-hls_time",
      "2",
      "-hls_list_size",
      isVodFile ? "0" : "30",
      ...(isVodFile ? [] : ["-hls_delete_threshold", "15"]),
      "-hls_flags",
      isVodFile
        ? "independent_segments+temp_file"
        : "delete_segments+independent_segments+temp_file",
      "-hls_segment_filename",
      segPattern,
      m3u8Path
    );

    const proc = spawn(FFMPEG_BIN, ffArgs, {
      stdio: [useNodePipeInput ? "pipe" : "ignore", "ignore", "ignore"]
    });
    let spawnFailed = false;
    let pipeStopped = false;
    let activeAbort: AbortController | null = null;
    let activeReader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    const cleanupPipe = () => {
      pipeStopped = true;
      try {
        activeAbort?.abort();
      } catch {}
      try {
        activeReader?.cancel().catch(() => {});
      } catch {}
      try {
        proc.stdin?.end();
      } catch {}
    };

    if (useNodePipeInput && proc.stdin) {
      proc.stdin.on("error", () => {});
      const writeChunkToFfmpeg = async (chunk: Buffer): Promise<boolean> => {
        if (!proc.stdin || proc.stdin.destroyed || pipeStopped || spawnFailed) return false;
        const ok = proc.stdin.write(chunk);
        if (!ok) {
          await new Promise<void>((res) => {
            const onDrain = () => {
              proc.stdin?.off("close", onClose);
              res();
            };
            const onClose = () => {
              proc.stdin?.off("drain", onDrain);
              res();
            };
            proc.stdin?.once("drain", onDrain);
            proc.stdin?.once("close", onClose);
          });
        }
        return true;
      };

      if (isM3u8Stream) {
        (async () => {
          const seenSegments = new Set<string>();
          const seenOrder: string[] = [];
          let activePlaylistUrl = streamInputUrl;
          let firstPoll = true;
          while (!pipeStopped && !spawnFailed && proc.exitCode === null && !proc.killed) {
            const controller = new AbortController();
            activeAbort = controller;
            const plTimeout = setTimeout(() => controller.abort(), 10000);
            let pushedAny = false;
            try {
              const plRes = await fetch(activePlaylistUrl, {
                headers: {
                  "User-Agent": "VLC/3.0.18 LibVLC/3.0.18",
                  Accept: "*/*"
                },
                redirect: "follow",
                signal: controller.signal
              });
              clearTimeout(plTimeout);
              if (plRes.ok) {
                const plFinalUrl = plRes.url || activePlaylistUrl;
                const plText = await plRes.text();
                if (plText.includes("#EXT-X-STREAM-INF:")) {
                  const lines = plText.split(/\r?\n/);
                  let variant = "";
                  for (let i = 0; i < lines.length; i++) {
                    const t = lines[i].trim();
                    if (t && !t.startsWith("#")) {
                      variant = t;
                    }
                  }
                  if (variant) {
                    activePlaylistUrl = new URL(variant, plFinalUrl).toString();
                    continue;
                  }
                }
                const segUrls: string[] = [];
                for (const rawLine of plText.split(/\r?\n/)) {
                  const t = rawLine.trim();
                  if (!t || t.startsWith("#")) continue;
                  try {
                    segUrls.push(new URL(t, plFinalUrl).toString());
                  } catch {}
                }
                const candidateSegs = firstPoll ? segUrls.slice(-3) : segUrls;
                const isInitialBatch = firstPoll;
                firstPoll = false;
                const toFetch = candidateSegs.filter((segUrl) => {
                  if (seenSegments.has(segUrl)) return false;
                  seenSegments.add(segUrl);
                  seenOrder.push(segUrl);
                  if (seenOrder.length > 150) {
                    const old = seenOrder.shift();
                    if (old) seenSegments.delete(old);
                  }
                  return true;
                });

                const fetchSegBuffer = async (segUrl: string): Promise<Buffer | null> => {
                  const segAbort = new AbortController();
                  activeAbort = segAbort;
                  const segTimeout = setTimeout(() => segAbort.abort(), 10000);
                  try {
                    const segRes = await fetch(segUrl, {
                      headers: {
                        "User-Agent": "VLC/3.0.18 LibVLC/3.0.18",
                        Accept: "*/*"
                      },
                      redirect: "follow",
                      signal: segAbort.signal
                    });
                    clearTimeout(segTimeout);
                    if (!segRes.ok) return null;
                    const ab = await segRes.arrayBuffer();
                    return ab.byteLength > 0 ? Buffer.from(ab) : null;
                  } catch {
                    clearTimeout(segTimeout);
                    return null;
                  }
                };

                if (isInitialBatch && toFetch.length > 1) {
                  const bufs = await Promise.all(toFetch.map((u) => fetchSegBuffer(u)));
                  for (const buf of bufs) {
                    if (pipeStopped || spawnFailed || proc.exitCode !== null || proc.killed) break;
                    if (buf) {
                      const wrote = await writeChunkToFfmpeg(buf);
                      if (!wrote) break;
                      pushedAny = true;
                    }
                  }
                } else {
                  for (const segUrl of toFetch) {
                    if (pipeStopped || spawnFailed || proc.exitCode !== null || proc.killed) break;
                    const buf = await fetchSegBuffer(segUrl);
                    if (buf) {
                      const wrote = await writeChunkToFfmpeg(buf);
                      if (!wrote) break;
                      pushedAny = true;
                    }
                  }
                }
              }
            } catch {
              clearTimeout(plTimeout);
            } finally {
              if (activeAbort === controller) activeAbort = null;
            }
            if (!pipeStopped && !spawnFailed && proc.exitCode === null && !proc.killed) {
              await new Promise((r) => setTimeout(r, pushedAny ? 500 : 750));
            }
          }
        })();
      } else {
        (async () => {
          while (!pipeStopped && !spawnFailed && proc.exitCode === null && !proc.killed) {
            const controller = new AbortController();
            activeAbort = controller;
            const connectTimeout = setTimeout(() => controller.abort(), 14000);
            try {
              const up = await fetch(streamInputUrl, {
                headers: {
                  "User-Agent": "VLC/3.0.18 LibVLC/3.0.18",
                  Accept: "*/*"
                },
                redirect: "follow",
                signal: controller.signal
              });
              clearTimeout(connectTimeout);
              if (!up.ok || !up.body) {
                await new Promise((r) => setTimeout(r, 500));
                continue;
              }
              const reader = up.body.getReader();
              activeReader = reader;
              while (!pipeStopped && !spawnFailed && proc.exitCode === null && !proc.killed) {
                const readTimer = setTimeout(() => {
                  try {
                    controller.abort();
                  } catch {}
                }, 10000);
                let result: ReadableStreamReadResult<Uint8Array>;
                try {
                  result = await reader.read();
                } finally {
                  clearTimeout(readTimer);
                }
                if (result.done || !result.value) break;
                const wrote = await writeChunkToFfmpeg(Buffer.from(result.value));
                if (!wrote) break;
              }
            } catch {
              clearTimeout(connectTimeout);
            } finally {
              activeReader = null;
              if (activeAbort === controller) activeAbort = null;
            }
            if (!pipeStopped && !spawnFailed && proc.exitCode === null && !proc.killed) {
              await new Promise((r) => setTimeout(r, 400));
            }
          }
        })();
      }
    }

    const session: HlsLiveSession = {
      sessionId,
      targetUrl,
      brand,
      dir,
      proc,
      lastAccess: Date.now(),
      readyAt: 0,
      pacedHeadSeg: -1,
      lastStepAt: 0,
      segDurations: new Map<number, string>(),
      lastPlaylist: null,
      readyPromise: Promise.resolve(false),
      cleanup: cleanupPipe
    };

    session.readyPromise = new Promise<boolean>((resolve) => {
      const start = Date.now();
      let settled = false;
      const finish = (ok: boolean) => {
        if (settled) return;
        settled = true;
        clearInterval(timer);
        resolve(ok);
      };

      proc.on("error", () => {
        spawnFailed = true;
        cleanupPipe();
        if (liveSessions.get(sessionId) === session) {
          liveSessions.delete(sessionId);
        }
        finish(false);
      });

      const timer = setInterval(() => {
        if (spawnFailed || proc.exitCode !== null || proc.killed) {
          finish(false);
          return;
        }
        const completed = getCompletedSegmentNumbers(dir);
        const elapsed = Date.now() - start;
        const minReadySegments = 2;
        if (
          completed.length >= minReadySegments ||
          (completed.length >= 1 && elapsed > 9000)
        ) {
          session.readyAt = Date.now();
          session.pacedHeadSeg = completed[Math.max(0, completed.length - (completed.length >= 5 ? 3 : completed.length >= 3 ? 2 : 1))];
          session.lastStepAt = Date.now();
          finish(true);
          return;
        }
        if (elapsed > 16000) {
          if (completed.length > 0) {
            session.readyAt = Date.now();
            session.pacedHeadSeg = completed[completed.length - 1];
            session.lastStepAt = Date.now();
          }
          finish(completed.length > 0);
        }
      }, 40);
    });

    proc.on("close", () => {
      cleanupPipe();
      if (liveSessions.get(sessionId) === session) {
        liveSessions.delete(sessionId);
      }
    });

    liveSessions.set(sessionId, session);
    return session;
  });

  globalEnsureLock = next.catch(() => null);
  sessionLocks.set(sessionId, next.catch(() => null));
  return next;
}

function buildPacedLivePlaylist(session: HlsLiveSession): string | null {
  // Record exact #EXTINF durations written by FFmpeg so iOS AVPlayer gets exact muxed durations
  const m3u8Path = path.join(session.dir, "index.m3u8");
  try {
    if (fs.existsSync(m3u8Path)) {
      const raw = fs.readFileSync(m3u8Path, "utf8");
      const lines = raw.split(/\r?\n/);
      let pendingExtinf = "";
      for (const line of lines) {
        const t = line.trim();
        if (t.startsWith("#EXTINF:")) {
          pendingExtinf = t;
        } else {
          const m = t.match(/^seg_(\d+)\.ts$/i);
          if (m && pendingExtinf) {
            session.segDurations.set(parseInt(m[1], 10), pendingExtinf);
            pendingExtinf = "";
          }
        }
      }
    }
  } catch {}

  const completed = getCompletedSegmentNumbers(session.dir);
  if (completed.length === 0) {
    return session.lastPlaylist;
  }

  // Maintain a 1-2 segment pre-encoded disk cushion ahead of the advertised playlist edge
  // so upstream pauses (e.g. 123tv.pro 1-2s dips or avr.host247.net 6s chunks) never stall the player.
  const latestSeg = completed[completed.length - 1];
  const targetLead = completed.length >= 5 ? 2 : completed.length >= 3 ? 1 : 0;
  const cushionedHead = completed[Math.max(0, completed.length - 1 - targetLead)];
  const nextHead = Math.min(latestSeg, Math.max(session.pacedHeadSeg, cushionedHead));
  session.pacedHeadSeg = nextHead;

  const eligible = completed.filter((seq) => seq <= nextHead);
  const visibleCompleted = (eligible.length > 0 ? eligible : completed).slice(-10);
  const mediaSeq = visibleCompleted[0];

  let maxSegDur = 2;
  for (const seq of visibleCompleted) {
    const extinf = session.segDurations.get(seq) || "#EXTINF:2.000,";
    const durMatch = extinf.match(/#EXTINF:([\d.]+)/);
    if (durMatch) {
      const d = parseFloat(durMatch[1]);
      if (Number.isFinite(d) && d > maxSegDur) maxSegDur = d;
    }
  }
  const targetDuration = Math.max(3, Math.ceil(maxSegDur));

  const out: string[] = [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    "#EXT-X-ALLOW-CACHE:NO",
    `#EXT-X-TARGETDURATION:${targetDuration}`,
    `#EXT-X-MEDIA-SEQUENCE:${mediaSeq}`,
    "#EXT-X-INDEPENDENT-SEGMENTS"
  ];

  for (const seq of visibleCompleted) {
    const extinf = session.segDurations.get(seq) || "#EXTINF:2.000,";
    out.push(extinf);
    out.push(`/api/hls-proxy/live-seg/${session.sessionId}/seg_${seq}.ts`);
  }

  const playlist = out.join("\n") + "\n";
  session.lastPlaylist = playlist;
  return playlist;
}

function buildVodSeriesPlaylist(session: HlsLiveSession): string | null {
  const m3u8Path = path.join(session.dir, "index.m3u8");
  try {
    if (fs.existsSync(m3u8Path)) {
      const raw = fs.readFileSync(m3u8Path, "utf8");
      const lines = raw.split(/\r?\n/);
      let pendingExtinf = "";
      for (const line of lines) {
        const t = line.trim();
        if (t.startsWith("#EXTINF:")) {
          pendingExtinf = t;
        } else {
          const m = t.match(/^seg_(\d+)\.ts$/i);
          if (m && pendingExtinf) {
            session.segDurations.set(parseInt(m[1], 10), pendingExtinf);
            pendingExtinf = "";
          }
        }
      }
    }
  } catch {}

  const completed = getCompletedSegmentNumbers(session.dir);
  if (completed.length === 0) {
    return session.lastPlaylist;
  }

  const highestCompleted = completed[completed.length - 1];
  const maxSegToAdvertise = highestCompleted;
  const out: string[] = [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    "#EXT-X-PLAYLIST-TYPE:EVENT",
    "#EXT-X-START:TIME-OFFSET=0,PRECISE=YES",
    "#EXT-X-ALLOW-CACHE:NO",
    "#EXT-X-TARGETDURATION:3",
    "#EXT-X-MEDIA-SEQUENCE:0",
    "#EXT-X-INDEPENDENT-SEGMENTS"
  ];

  for (let seq = 0; seq <= maxSegToAdvertise; seq++) {
    const extinf = session.segDurations.get(seq) || "#EXTINF:2.000000,";
    out.push(extinf);
    out.push(`/api/hls-proxy/live-seg/${session.sessionId}/seg_${seq}.ts`);
  }

  if (session.proc.exitCode !== null || session.proc.killed) {
    out.push("#EXT-X-ENDLIST");
  }

  const playlist = out.join("\n") + "\n";
  session.lastPlaylist = playlist;
  return playlist;
}

interface TranscodeJob {
  chunks: Buffer[];
  done: boolean;
  error: boolean;
  listeners: Set<(chunk: Buffer | null, isErr?: boolean) => void>;
}
const activeTranscodeJobs = new Map<string, TranscodeJob>();

// Serialized upstream fetch lock so single-connection Xtream accounts never see overlapping requests
let upstreamQueuePromise: Promise<any> = Promise.resolve();
function withUpstreamLock<T>(fn: () => Promise<T>): Promise<T> {
  const next = upstreamQueuePromise.then(fn, fn);
  upstreamQueuePromise = next.catch(() => {});
  return next;
}

function remapLegacySportUrl(
  rawUrl: string,
  rawTranscode: boolean,
  rawBrand: string
): { targetUrl: string; transcode: boolean; brand: string } {
  let targetUrl = rawUrl;
  let transcode = rawTranscode;
  let brand = rawBrand;

  // Automatically upgrade any stale Home Screen PWA URLs or mislabeled DVB-T2 PIDs to verified sports feeds
  if (/mmn\.mypsx\.net|930281\.m3u8/i.test(targetUrl)) {
    targetUrl = "http://195.128.27.253:2095/live/548607065148/955372318450/932000.m3u8";
    transcode = true;
  } else if (/195\.201\.243\.254\/stream10|932084\.m3u8/i.test(targetUrl)) {
    targetUrl = "http://195.128.27.253:2095/live/548607065148/955372318450/1547797.m3u8";
    transcode = true;
    if (!brand) brand = "falcon2";
  } else if (/195\.201\.243\.254\/stream8|930397\.m3u8/i.test(targetUrl)) {
    targetUrl = "http://195.128.27.253:2095/live/548607065148/955372318450/1513530.m3u8";
    transcode = true;
    if (!brand) brand = "falcon3";
  } else if (/932126\.m3u8/i.test(targetUrl)) {
    targetUrl =
      brand === "falcon4"
        ? "http://195.128.27.253:2095/live/548607065148/955372318450/1547805.m3u8"
        : "http://195.128.27.253:2095/live/548607065148/955372318450/1547798.m3u8";
    transcode = true;
    if (!brand) brand = "falcon1";
  } else if (/932044\.m3u8/i.test(targetUrl) && brand === "falcon4") {
    targetUrl = "http://195.128.27.253:2095/live/548607065148/955372318450/1547805.m3u8";
    transcode = true;
  } else if (/8kultra\.org.*\/(701761|600138)\.m3u8/i.test(targetUrl)) {
    targetUrl = "http://195.128.27.253:2095/live/548607065148/955372318450/932000.m3u8";
    transcode = true;
  } else if (/8kultra\.org.*\/701765\.m3u8/i.test(targetUrl)) {
    targetUrl = "http://195.128.27.253:2095/live/548607065148/955372318450/1547798.m3u8";
    transcode = true;
    if (!brand) brand = "falcon1";
  } else if (/8kultra\.org.*\/701764\.m3u8/i.test(targetUrl)) {
    targetUrl = "http://195.128.27.253:2095/live/548607065148/955372318450/1547797.m3u8";
    transcode = true;
    if (!brand) brand = "falcon2";
  } else if (/8kultra\.org.*\/701763\.m3u8/i.test(targetUrl)) {
    targetUrl = "http://195.128.27.253:2095/live/548607065148/955372318450/1513530.m3u8";
    transcode = true;
    if (!brand) brand = "falcon3";
  } else if (/8kultra\.org.*\/(701768|701758)\.m3u8/i.test(targetUrl)) {
    targetUrl = "http://195.128.27.253:2095/live/548607065148/955372318450/1547805.m3u8";
    transcode = true;
    if (!brand) brand = "falcon4";
  } else if (/1508706\.m3u8|1618770\.m3u8|149\.100\.11\.252:8000\/play\/a056/i.test(targetUrl)) {
    targetUrl = "http://195.128.27.253:2095/live/548607065148/955372318450/1881673.m3u8";
    transcode = false;
  } else if (/2098823\.m3u8/i.test(targetUrl)) {
    targetUrl = "http://195.128.27.253:2095/live/548607065148/955372318450/1859032.m3u8";
    transcode = false;
  } else if (/\/live\/natgeoad\/index\.m3u8/i.test(targetUrl)) {
    targetUrl = "http://195.128.27.253:2095/live/548607065148/955372318450/1883848.m3u8";
    transcode = true;
  } else if (/\/live\/zed\/index\.m3u8/i.test(targetUrl)) {
    targetUrl = "http://123tv.pro/live/aSKpxnSj/hhewYcb/24711.m3u8";
    transcode = true;
  } else if (/\/live\/avasport1\/index\.m3u8/i.test(targetUrl)) {
    targetUrl = "https://avr.host247.net/live/AvaSport/playlist.m3u8";
    transcode = true;
  } else if (/\/live\/kurdmaxshow\/index\.m3u8/i.test(targetUrl)) {
    targetUrl = "http://195.128.27.253:2095/live/548607065148/955372318450/931837.m3u8";
    transcode = true;
  } else if (/\/live\/newline1\/index\.m3u8/i.test(targetUrl)) {
    targetUrl = "http://123tv.pro/live/aSKpxnSj/hhewYcb/24728.m3u8";
    transcode = true;
  } else if (/\/live\/newline2\/index\.m3u8/i.test(targetUrl)) {
    targetUrl = "http://123tv.pro/live/aSKpxnSj/hhewYcb/24727.m3u8";
    transcode = true;
  } else if (/\/live\/(asosport|ldsport)\/index\.m3u8/i.test(targetUrl)) {
    targetUrl = "http://195.128.27.253:2095/live/548607065148/955372318450/932044.m3u8";
    transcode = true;
  } else if (/117739\.m3u8/i.test(targetUrl)) {
    targetUrl = "http://123tv.pro/live/aSKpxnSj/hhewYcb/1027293.m3u8";
    transcode = false;
  } else if (/avr\.host247\.net\/live\/emantv\/playlist\.m3u8/i.test(targetUrl)) {
    targetUrl = "http://195.128.27.253:2095/live/548607065148/955372318450/932119.m3u8";
    transcode = false;
  } else if (/giatv-rsunnat/i.test(targetUrl)) {
    targetUrl = "http://195.128.27.253:2095/live/548607065148/955372318450/931890.m3u8";
    transcode = false;
  } else if (/peshmerge\/playlist\.m3u8/i.test(targetUrl)) {
    targetUrl = "http://123tv.pro/live/aSKpxnSj/hhewYcb/113304.m3u8";
    transcode = true;
  } else if (/UmFrdXRlblRWLWRlX0ZJRkFQbHVzR2VybWFuX0hMUw/i.test(targetUrl)) {
    transcode = true;
    brand = "ownplus";
  } else if (
    /123tv\.pro\/live\/[^/]+\/[^/]+\/(24728|24727|24711|113245|113304)\.m3u8/i.test(targetUrl) ||
    /live\.host247\.net\/gk\/gkplus\/playlist\.m3u8/i.test(targetUrl) ||
    /avr\.host247\.net\/live\/AvaSport\/playlist\.m3u8/i.test(targetUrl) ||
    /\/(931837|932044|931930|1883848|18013|18014)\.m3u8/i.test(targetUrl)
  ) {
    transcode = true;
  } else if (
    /\/(1508706|1881673|1883539|1859034|2098821|1859033|1859032|931831|932119|931890|1027293)\.m3u8/i.test(
      targetUrl
    )
  ) {
    // These streams are already native H.264 + AAC and play instantaneously without FFmpeg transcoding
    transcode = false;
  }

  return { targetUrl, transcode, brand };
}

function getOrStartTranscodeJob(
  cacheKey: string,
  segUrl: string,
  brand: string,
  headers: Record<string, string>
): TranscodeJob {
  const existing = activeTranscodeJobs.get(cacheKey);
  if (existing) return existing;

  const job: TranscodeJob = {
    chunks: [],
    done: false,
    error: false,
    listeners: new Set()
  };
  activeTranscodeJobs.set(cacheKey, job);

  (async () => {
    try {
      // Download raw .ts segment into RAM inside serialized lock (~0.19s) so upstream socket closes immediately
      const rawBuf = await withUpstreamLock(async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        try {
          const resp = await fetch(segUrl, {
            headers,
            signal: controller.signal,
            redirect: "follow"
          });
          if (!resp.ok) {
            throw new Error(`Segment HTTP ${resp.status}`);
          }
          const ab = await resp.arrayBuffer();
          return Buffer.from(ab);
        } finally {
          clearTimeout(timeout);
        }
      });

      const falconMatch = brand.match(/^falcon([1-4])$/i);
      const isOwnPlus = /^ownplus$/i.test(brand);
      const bugPath = falconMatch
        ? path.join(process.cwd(), "public", "logos", "tv_bugs", `falcon-${falconMatch[1]}.png`)
        : isOwnPlus
        ? path.join(process.cwd(), "public", "assets", "aistudio", "own_logo_no_tm_transparent_3cc8ece6.png")
        : "";
      const hasBug = Boolean(bugPath && fs.existsSync(bugPath));

      const ffArgs: string[] = [
        "-hide_banner",
        "-loglevel",
        "error",
        "-fflags",
        "+genpts+discardcorrupt",
        "-err_detect",
        "ignore_err",
        "-threads",
        "0",
        "-i",
        "pipe:0"
      ];

      if (hasBug && isOwnPlus) {
        ffArgs.push(
          "-i",
          bugPath,
          "-filter_complex",
          "[0:v]fps=25,scale=960:540:flags=fast_bilinear[bg];[1:v]crop=2512:853:37:2,scale=118:40[bug];[bg][bug]overlay=x=822:y=14:format=auto,format=yuv420p[v]",
          "-map",
          "[v]",
          "-map",
          "0:a?"
        );
      } else if (hasBug) {
        ffArgs.push(
          "-i",
          bugPath,
          "-filter_complex",
          "[0:v]fps=25,scale=640:360:flags=fast_bilinear,delogo=x=10:y=6:w=28:h=12,delogo=x=539:y=18:w=72:h=19[bg];[bg][1:v]overlay=x=539:y=24:format=auto,format=yuv420p[v]",
          "-map",
          "[v]",
          "-map",
          "0:a?"
        );
      } else {
        ffArgs.push("-vf", "fps=25,scale=960:540:flags=fast_bilinear,format=yuv420p");
      }

      ffArgs.push(
        "-copyts",
        "-muxdelay",
        "0",
        "-muxpreload",
        "0",
        "-flush_packets",
        "1",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-tune",
        "zerolatency",
        "-profile:v",
        "main",
        "-level",
        "3.1",
        "-pix_fmt",
        "yuv420p",
        "-crf",
        hasBug ? "26" : "25",
        "-g",
        "50",
        "-c:a",
        "aac",
        "-b:a",
        "128k",
        "-ac",
        "2",
        "-ar",
        "44100",
        "-mpegts_flags",
        "+resend_headers",
        "-f",
        "mpegts",
        "pipe:1"
      );

      const ff = spawn(FFMPEG_BIN, ffArgs, { stdio: ["pipe", "pipe", "ignore"] });

      ff.stdout.on("data", (chunk: Buffer) => {
        job.chunks.push(chunk);
        for (const listener of job.listeners) {
          try {
            listener(chunk, false);
          } catch {}
        }
      });

      ff.on("error", () => {
        job.error = true;
        job.done = true;
        activeTranscodeJobs.delete(cacheKey);
        for (const listener of job.listeners) {
          try {
            listener(null, true);
          } catch {}
        }
        job.listeners.clear();
      });

      ff.on("close", (code) => {
        job.done = true;
        activeTranscodeJobs.delete(cacheKey);
        if (code === 0 && job.chunks.length > 0) {
          if (transcodeCache.size >= 12) {
            const oldestKey = transcodeCache.keys().next().value;
            if (oldestKey) transcodeCache.delete(oldestKey);
          }
          transcodeCache.set(cacheKey, Buffer.concat(job.chunks));
          for (const listener of job.listeners) {
            try {
              listener(null, false);
            } catch {}
          }
        } else {
          job.error = true;
          for (const listener of job.listeners) {
            try {
              listener(null, true);
            } catch {}
          }
        }
        job.listeners.clear();
      });

      ff.stdin.on("error", () => {});
      ff.stdin.end(rawBuf);
    } catch {
      job.error = true;
      job.done = true;
      activeTranscodeJobs.delete(cacheKey);
      for (const listener of job.listeners) {
        try {
          listener(null, true);
        } catch {}
      }
      job.listeners.clear();
    }
  })();

  return job;
}

function sendBufferWithRangeSupport(req: express.Request, res: express.Response, buf: Buffer) {
  res.setHeader("Content-Type", "video/mp2t");
  res.setHeader("Cache-Control", "public, max-age=30");
  res.setHeader("Accept-Ranges", "bytes");
  const range = req.headers.range;
  if (range) {
    const match = range.match(/bytes=(\d+)-(\d*)/);
    if (match) {
      const start = parseInt(match[1], 10);
      const end = match[2] ? Math.min(parseInt(match[2], 10), buf.length - 1) : buf.length - 1;
      if (start <= end && start < buf.length) {
        const sub = buf.subarray(start, end + 1);
        res.status(206);
        res.setHeader("Content-Range", `bytes ${start}-${end}/${buf.length}`);
        res.setHeader("Content-Length", String(sub.length));
        return res.send(sub);
      }
    }
  }
  res.setHeader("Content-Length", String(buf.length));
  return res.send(buf);
}

// Serve continuous live/VOD HLS segments with instant disk read, wait-for-segment support, Content-Length, and Byte-Range support for iOS Native AVPlayer
app.get("/api/hls-proxy/live-seg/:sessionId/:file", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=60");

  const sessionId = String(req.params.sessionId || "").replace(/[^a-z0-9]/gi, "");
  const file = String(req.params.file || "").replace(/[^a-z0-9_.-]/gi, "");
  if (!sessionId || !file.endsWith(".ts")) {
    return res.status(400).end();
  }

  const session = liveSessions.get(sessionId);
  if (session) {
    session.lastAccess = Date.now();
    if (session.brand === "series" || session.brand === "vod") {
      activeStreamOwner = {
        sessionId,
        ts: Date.now() + 30_000,
        sa: true,
        lastSeen: Date.now()
      };
    }
  }
  if (activeStreamOwner.sessionId === sessionId) {
    activeStreamOwner.lastSeen = Date.now();
  }

  const dir = path.join("/tmp", "hls_live", sessionId);
  const filePath = path.join(dir, file);

  // Wait until FFmpeg has completely written and closed this segment (never serve 0-byte or partial in-flight files)
  if (!isSegmentClosedByFfmpeg(dir, file) && session && session.proc.exitCode === null && !session.proc.killed) {
    const waitStart = Date.now();
    while (!isSegmentClosedByFfmpeg(dir, file) && Date.now() - waitStart < 12_000) {
      if (session.proc.exitCode !== null || session.proc.killed) break;
      await new Promise((r) => setTimeout(r, 60));
    }
  }

  if (!isSegmentClosedByFfmpeg(dir, file)) {
    return res.status(404).end();
  }

  try {
    const buf = fs.readFileSync(filePath);
    return sendBufferWithRangeSupport(req, res, buf);
  } catch {
    return res.status(500).end();
  }
});

// Keep Cloud Run container CPU unthrottled while a user is actively watching a transcoded live channel
app.get("/api/live-keepalive", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  res.write(": connected\n\n");

  const iv = setInterval(() => {
    try {
      for (const s of liveSessions.values()) {
        s.lastAccess = Date.now();
      }
      res.write(": ping\n\n");
    } catch {}
  }, 4000);

  const maxTimer = setTimeout(() => {
    clearInterval(iv);
    try {
      res.end();
    } catch {}
  }, 20 * 60 * 1000);

  req.on("close", () => {
    clearInterval(iv);
    clearTimeout(maxTimer);
  });
});

// 📺 Direct HTTPS Live HLS Endpoint for Newline 1, Newline 2, Kurdmax Show, and Aso Sport
app.get("/live/:ch/index.m3u8", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  if (req.method === "HEAD") {
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    return res.status(200).end();
  }

  const ch = String(req.params.ch || "").toLowerCase();
  const map: Record<string, { url: string; title: string }> = {
    newline1: {
      url: "http://123tv.pro/live/aSKpxnSj/hhewYcb/24728.m3u8",
      title: "Newline 1 HD"
    },
    newline2: {
      url: "http://123tv.pro/live/aSKpxnSj/hhewYcb/24727.m3u8",
      title: "Newline 2 HD"
    },
    kurdmaxshow: {
      url: "http://195.128.27.253:2095/live/548607065148/955372318450/931837.m3u8",
      title: "Kurdmax Show HD"
    },
    asosport: {
      url: "http://195.128.27.253:2095/live/548607065148/955372318450/932044.m3u8",
      title: "Aso Sport HD"
    },
    ldsport: {
      url: "http://195.128.27.253:2095/live/548607065148/955372318450/932044.m3u8",
      title: "Aso Sport HD"
    },
    zed: {
      url: "http://123tv.pro/live/aSKpxnSj/hhewYcb/24711.m3u8",
      title: "Zed HD"
    },
    avasport1: {
      url: "https://avr.host247.net/live/AvaSport/playlist.m3u8",
      title: "AVA Sport 1 HD"
    },
    natgeoad: {
      url: "http://195.128.27.253:2095/live/548607065148/955372318450/1883848.m3u8",
      title: "National Geographic Abu Dhabi HD"
    }
  };

  const entry = map[ch];
  if (!entry) {
    return res.status(404).send("Channel not found");
  }

  const accept = String(req.headers.accept || "");
  const isBrowserNavigation =
    req.query.raw !== "1" &&
    !req.query.ts &&
    (/text\/html/i.test(accept) ||
      req.headers["sec-fetch-dest"] === "document" ||
      req.headers["sec-fetch-mode"] === "navigate");

  // When a user copies the link and pastes it into Google Chrome or Safari address bar,
  // warm up the live stream immediately and serve a full-screen dark live player (never a white screen).
  if (isBrowserNavigation) {
    ensureHlsLiveSession(entry.url, "").catch(() => {});
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    const rawM3u8Url = `/live/${encodeURIComponent(ch)}/index.m3u8?raw=1`;
    return res.send(`<!DOCTYPE html>
<html lang="ku" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover" />
<title>${entry.title} - پەخشی ڕاستەوخۆ</title>
<script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js"></script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 100%; height: 100%; background: #000; color: #fff; font-family: -apple-system, BlinkMacSystemFont, sans-serif; overflow: hidden; }
  .wrap { position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #000; }
  video { width: 100%; height: 100%; object-fit: contain; background: #000; }
  .badge { position: absolute; top: 16px; right: 16px; background: rgba(220,38,38,0.9); color: #fff; padding: 6px 14px; border-radius: 8px; font-size: 13px; font-weight: 700; z-index: 10; pointer-events: none; }
  .loader { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; background: rgba(0,0,0,0.65); z-index: 5; transition: opacity 0.25s; pointer-events: none; }
  .spinner { width: 42px; height: 42px; border: 3px solid rgba(255,255,255,0.2); border-top-color: #ef4444; border-radius: 50%; animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
</head>
<body>
<div class="wrap">
  <div class="badge">LIVE • ${entry.title}</div>
  <div id="loader" class="loader"><div class="spinner"></div><div style="font-size:14px;color:#e5e7eb;">پەخشی ڕاستەوخۆ دەکرێتەوە...</div></div>
  <video id="video" autoplay playsinline disableRemotePlayback controls></video>
</div>
<script>
  const video = document.getElementById('video');
  const loader = document.getElementById('loader');
  const src = ${JSON.stringify(rawM3u8Url)};
  const hideLoader = () => { if (loader) loader.style.opacity = '0'; };
  video.addEventListener('playing', hideLoader);
  video.addEventListener('timeupdate', () => { if (video.currentTime > 0) hideLoader(); });

  function tryPlay() {
    video.play().catch(() => {
      video.muted = true;
      video.play().catch(() => {});
    });
  }

  function startNative() {
    video.src = src + '&t=' + Date.now();
    video.addEventListener('loadedmetadata', tryPlay, { once: true });
    video.addEventListener('error', () => {
      setTimeout(startNative, 1500);
    }, { once: true });
    tryPlay();
  }

  if (window.Hls && Hls.isSupported()) {
    const hls = new Hls({ enableWorker: true, lowLatencyMode: false, manifestLoadingMaxRetry: 12, manifestLoadingRetryDelay: 1000 });
    hls.loadSource(src);
    hls.attachMedia(video);
    hls.on(Hls.Events.MANIFEST_PARSED, tryPlay);
    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) {
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          setTimeout(() => hls.startLoad(), 1000);
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          hls.destroy();
          startNative();
        } else {
          hls.recoverMediaError();
        }
      }
    });
  } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
    startNative();
  }
</script>
</body>
</html>`);
  }

  res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
  try {
    const session = await ensureHlsLiveSession(entry.url, "");
    if (session) {
      await session.readyPromise;
      const ua = String(req.headers["user-agent"] || "");
      if (/AppleCoreMedia/i.test(ua)) {
        const waitStart = Date.now();
        while (getCompletedSegmentNumbers(session.dir).length < 2 && Date.now() - waitStart < 1500) {
          if (session.proc.exitCode !== null || session.proc.killed) break;
          await new Promise((r) => setTimeout(r, 80));
        }
      }
      const paced = buildPacedLivePlaylist(session) || session.lastPlaylist;
      if (paced) {
        session.lastAccess = Date.now();
        return res.send(paced);
      }
    }
    return res.status(503).send("Live stream warming up");
  } catch {
    return res.status(503).send("Live stream error");
  }
});

// ⚽ OWN+ 24/7 Live UEFA Champions League (2026/27 Season) Broadcast Engine
// Serves a real-time sliding-window LIVE HLS stream (no #EXT-X-ENDLIST, no VOD duration)
// so it works instantaneously in Add to Home Screen & Safari/Chrome and never looks like a recorded video in fullscreen.
const uclSegmentRamCache = new Map<string, Buffer>();

app.get("/api/ownplus-ucl/live.m3u8", (req, res) => {
  if (!applyStreamShieldHeaders(req, res)) return;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  if (req.method === "HEAD") {
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    return res.status(200).end();
  }

  const replayUrl =
    "https://4397879b.wurl.com/master/f36d25e7e52f1ba8d7e56eb859c636563214f541/UmFrdXRlblRWLWRlX0ZJRkFQbHVzR2VybWFuX0hMUw/playlist.m3u8";
  return res.redirect(307, protectServerUrlOnBackend(replayUrl, "ownplus"));
});

app.get("/api/ownplus-ucl/seg/:file", (req, res) => {
  if (!applyStreamShieldHeaders(req, res)) return;
  res.setHeader("Access-Control-Allow-Origin", "*");
  const file = String(req.params.file || "").replace(/[^a-z0-9_.-]/gi, "");
  if (!/^seg_\d+\.ts$/i.test(file)) {
    return res.status(400).end();
  }

  let buf = uclSegmentRamCache.get(file);
  if (!buf) {
    const primaryPath = path.join(process.cwd(), "ucl_stream", file);
    const fallbackPath = path.join(process.cwd(), "public", "ucl_live", file);
    const segPath = fs.existsSync(primaryPath) ? primaryPath : fallbackPath;
    if (!fs.existsSync(segPath)) {
      return res.status(404).end();
    }
    try {
      buf = fs.readFileSync(segPath);
      if (uclSegmentRamCache.size >= 40) {
        const oldest = uclSegmentRamCache.keys().next().value;
        if (oldest) uclSegmentRamCache.delete(oldest);
      }
      uclSegmentRamCache.set(file, buf);
    } catch {
      return res.status(500).end();
    }
  }

  return sendBufferWithRangeSupport(req, res, buf);
});

// Fast, zero-stall Alwan Sport 1, 2, 3 live endpoint (direct H.264 + AAC & FHD streams)
app.get("/api/alwan-live/:id/live.m3u8", async (req, res) => {
  if (!applyStreamShieldHeaders(req, res)) return;
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  const channelId = Number(req.params.id || 1);
  if (![1, 2, 3].includes(channelId)) {
    return res.status(404).send("Invalid Alwan channel");
  }

  if (req.method === "HEAD") {
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    return res.status(200).end();
  }

  const quality = String(req.query.q || "sd").toLowerCase() === "hd" ? "hd" : "sd";
  const feedCfg = alwanDirectH264Feeds[channelId] || alwanDirectH264Feeds[1];
  const targetUrl = quality === "hd" ? feedCfg.hd : feedCfg.sd;
  const needsTranscode = Boolean(quality === "hd" && feedCfg.hdNeedsTranscode);

  // If this variant requires HEVC->H.264 transcoding, serve via continuous live session
  if (needsTranscode) {
    try {
      const session = await ensureHlsLiveSession(targetUrl, "");
      if (session) {
        await session.readyPromise;
        const paced = buildPacedLivePlaylist(session) || session.lastPlaylist;
        if (paced) {
          session.lastAccess = Date.now();
          res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
          return res.send(paced);
        }
      }
    } catch {}
  }

  // Stop any idle FFmpeg liveSessions so the Xtream connection is completely free for direct H.264 streaming
  if (liveSessions.size > 0) {
    for (const [id, s] of liveSessions.entries()) {
      liveSessions.delete(id);
      stopLiveSession(s);
    }
  }

  const directUrl = needsTranscode ? feedCfg.sd : targetUrl;
  const plCacheKey = `alwan_direct_${channelId}_${quality}`;
  const now = Date.now();
  const cachedPl = playlistCache.get(plCacheKey);
  if (cachedPl && cachedPl.expires > now) {
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    return res.send(cachedPl.body);
  }

  try {
    const upstream = await withUpstreamLock(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        return await fetch(directUrl, {
          headers: {
            "User-Agent": "VLC/3.0.18 LibVLC/3.0.18",
            Accept: "*/*"
          },
          signal: controller.signal,
          redirect: "follow"
        });
      } finally {
        clearTimeout(timeout);
      }
    });

    if (!upstream.ok) {
      return res.status(upstream.status).send("Alwan upstream error");
    }

    const finalUrl = upstream.url || directUrl;
    const rawText = await upstream.text();
    if (rawText.includes("#EXTM3U")) {
      const lines = rawText.split(/\r?\n/);
      const segmentAbsUrls: string[] = [];
      const rewritten = lines
        .map((line) => {
          const t = line.trim();
          if (!t || t.startsWith("#")) return line;
          try {
            const abs = new URL(t, finalUrl).toString();
            segmentAbsUrls.push(abs);
            const sToken = encodeStreamShieldToken(abs);
            const kSig = computeShieldSignature(abs);
            return `/api/hls-proxy/seg.ts?s=${sToken}&k=${kSig}`;
          } catch {
            return line;
          }
        })
        .join("\n");

      if (segmentAbsUrls.length > 0) {
        prefetchRawSegment(segmentAbsUrls[segmentAbsUrls.length - 1]);
      }

      playlistCache.set(plCacheKey, { body: rewritten, expires: Date.now() + 1200 });
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      return res.send(rewritten);
    }

    return res.status(503).send("Alwan stream warming up");
  } catch {
    return res.status(503).send("Alwan stream error");
  }
});

app.get(["/api/hls-proxy", "/api/hls-proxy/live.m3u8", "/api/hls-proxy/seg.ts"], async (req, res) => {
  if (!applyStreamShieldHeaders(req, res)) return;
  const sToken = String(req.query.s || "").trim();
  const rawUrl = sToken ? decodeStreamShieldToken(sToken) : String(req.query.url || "").trim();
  const referer = String(req.query.referer || "").trim();
  const rawTranscode = String(req.query.transcode || "") === "1";
  const rawBrand = String(req.query.brand || "").trim();
  const reqTs = Number(req.query.ts || 0);
  const reqSa = String(req.query.sa || "") === "1";

  if (!rawUrl || (!/^https?:\/\//i.test(rawUrl) && !rawUrl.startsWith("/live/"))) {
    return res.status(400).send("Invalid stream URL");
  }

  const { targetUrl, transcode, brand } = remapLegacySportUrl(rawUrl, rawTranscode, rawBrand);

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  if (req.method === "HEAD") {
    const isM3u = /\.m3u8(\?|$)/i.test(targetUrl) || req.path.endsWith(".m3u8");
    res.setHeader("Content-Type", isM3u ? "application/vnd.apple.mpegurl" : "video/mp2t");
    return res.status(200).end();
  }

  const isM3u8Target =
    /\.m3u8(\?|$)/i.test(targetUrl) ||
    (req.path.endsWith("/live.m3u8") && /\/live\//i.test(targetUrl));

  // Track latest active stream session
  if (isM3u8Target) {
    const sessionId = crypto
      .createHash("md5")
      .update(`${targetUrl}|${brand}|v7`)
      .digest("hex")
      .slice(0, 12);

    const now = Date.now();
    activeStreamOwner = {
      sessionId,
      ts: reqTs > 0 ? reqTs : now,
      sa: reqSa,
      lastSeen: now
    };
  }

  // Continuous HLS live packager (works in iOS Home Screen Native AVPlayer + Android + Preview)
  if (transcode && isM3u8Target) {
    try {
      const session = await ensureHlsLiveSession(targetUrl, brand);
      if (session) {
        await session.readyPromise;
        const pacedPlaylist = buildPacedLivePlaylist(session) || session.lastPlaylist;
        if (pacedPlaylist) {
          session.lastAccess = Date.now();
          res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
          return res.send(pacedPlaylist);
        }
      }
      return res.status(503).send("Live transcoder warming up");
    } catch {
      return res.status(503).send("Live transcoder error");
    }
  }

  const useVlcUa =
    transcode ||
    /:2095\b|:8090\b|123tv\.pro|89\.31\.211\.25|103\.205\.17\.151|\/live\/play\/|195\.128\.27\.|37\.58\.48\.|212\.95\.38\.186|8kultra\.org|tahpascal78\.space|tectonbrand\.com/i.test(
      targetUrl
    );
  const headers: Record<string, string> = {
    "User-Agent": useVlcUa
      ? "VLC/3.0.18 LibVLC/3.0.18"
      : "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "*/*"
  };
  if (referer) {
    headers["Referer"] = referer;
  }

  // Fast path for transcoded .ts segments (serves cached Buffer or attaches to probe-safe TranscodeJob)
  const isSegmentRequest = req.path.endsWith("/seg.ts") || /\.ts(\?|$)/i.test(targetUrl);
  const cacheKey = `${targetUrl}|${brand}`;

  if (transcode && isSegmentRequest) {
    const cachedBuf = transcodeCache.get(cacheKey);
    if (cachedBuf) {
      return sendBufferWithRangeSupport(req, res, cachedBuf);
    }

    res.setHeader("Content-Type", "video/mp2t");
    const job = getOrStartTranscodeJob(cacheKey, targetUrl, brand, headers);

    for (const chunk of job.chunks) {
      if (!res.writableEnded) {
        res.write(chunk);
      }
    }

    if (job.done) {
      return res.end();
    }

    const listener = (chunk: Buffer | null, isErr?: boolean) => {
      if (res.writableEnded) return;
      if (chunk) {
        res.write(chunk);
      } else {
        if (isErr && !res.headersSent) {
          res.status(502).end();
        } else {
          res.end();
        }
      }
    };

    job.listeners.add(listener);
    req.on("close", () => {
      job.listeners.delete(listener);
    });
    return;
  }

  // Fast path for non-transcoded binary segments (.ts) with RAM caching + Byte-Range support for iOS Home Screen AVPlayer
  if (!transcode && isSegmentRequest && !isM3u8Target) {
    const cachedRaw = rawSegmentCache.get(targetUrl);
    if (cachedRaw) {
      return sendBufferWithRangeSupport(req, res, cachedRaw);
    }
    try {
      let inflight = activeRawSegmentFetches.get(targetUrl);
      if (!inflight) {
        inflight = (async () => {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 12000);
          try {
            const up = await fetch(targetUrl, {
              headers,
              signal: controller.signal,
              redirect: "follow"
            });
            if (!up.ok) {
              throw new Error(`HTTP ${up.status}`);
            }
            const ab = await up.arrayBuffer();
            const buf = Buffer.from(ab);
            if (buf.length > 0) {
              if (rawSegmentCache.size >= 48) {
                const oldest = rawSegmentCache.keys().next().value;
                if (oldest) rawSegmentCache.delete(oldest);
              }
              rawSegmentCache.set(targetUrl, buf);
            }
            return buf;
          } finally {
            clearTimeout(timeout);
            activeRawSegmentFetches.delete(targetUrl);
          }
        })();
        activeRawSegmentFetches.set(targetUrl, inflight);
      }
      const buf = await inflight;
      return sendBufferWithRangeSupport(req, res, buf);
    } catch {
      return res.status(502).send("Segment fetch error");
    }
  }

  try {
    const now = Date.now();

    // Stop any idle FFmpeg liveSessions when a direct Xtream :2095 playlist is requested so the connection is free
    if (!transcode && isM3u8Target && /:2095\b/i.test(targetUrl) && liveSessions.size > 0) {
      for (const [id, s] of liveSessions.entries()) {
        liveSessions.delete(id);
        stopLiveSession(s);
      }
      await new Promise((r) => setTimeout(r, 250));
    }

    // Serve short-lived cached playlist (1.5s TTL) if multiple requests poll simultaneously
    const plCacheKey = `${targetUrl}|${transcode ? 1 : 0}|${brand}`;
    const cachedPl = playlistCache.get(plCacheKey);
    if (isM3u8Target && cachedPl && cachedPl.expires > now) {
      res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
      return res.send(cachedPl.body);
    }

    // Never cache single-use token redirect URLs from :2095 / /live/play/ / 123tv.pro
    const isSingleUseTokenRedirect = /:2095\b|:8090\b|123tv\.pro|\/live\/play\//i.test(targetUrl);
    const cachedRedirect = !isSingleUseTokenRedirect ? redirectCache.get(targetUrl) : undefined;
    let fetchUrl =
      cachedRedirect && cachedRedirect.expires > now ? cachedRedirect.finalUrl : targetUrl;

    const needsLock = useVlcUa && isM3u8Target;
    const runFetch = async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        let up = await fetch(fetchUrl, {
          headers,
          signal: controller.signal,
          redirect: "follow"
        });
        if (!up.ok && fetchUrl !== targetUrl) {
          redirectCache.delete(targetUrl);
          fetchUrl = targetUrl;
          up = await fetch(targetUrl, {
            headers,
            signal: controller.signal,
            redirect: "follow"
          });
        }
        return up;
      } finally {
        clearTimeout(timeout);
      }
    };

    const upstream = needsLock ? await withUpstreamLock(runFetch) : await runFetch();

    if (!upstream.ok) {
      return res.status(upstream.status).send(`Upstream returned ${upstream.status}`);
    }

    const finalUrl = upstream.url || fetchUrl;
    if (
      finalUrl !== targetUrl &&
      isM3u8Target &&
      !isSingleUseTokenRedirect &&
      !/\/live\/play\//i.test(finalUrl)
    ) {
      redirectCache.set(targetUrl, { finalUrl, expires: now + 90_000 });
    }

    const contentType = (upstream.headers.get("content-type") || "").toLowerCase();
    const isPlaylist =
      contentType.includes("mpegurl") ||
      contentType.includes("text/") ||
      /\.m3u8(\?|$)/i.test(finalUrl) ||
      isM3u8Target;

    if (isPlaylist) {
      let text = await upstream.text();
      let resolvedFinalUrl = finalUrl;

      // Fast-path for single-stream Master Playlists (Wowza/Flussonic local channels):
      // Resolve the variant chunklist directly on the server to save a round-trip and cache the direct URL.
      if (
        !transcode &&
        text.includes("#EXT-X-STREAM-INF:") &&
        !text.includes("#EXTINF:") &&
        !/#EXT-X-MEDIA:.*URI=/i.test(text)
      ) {
        const masterLines = text.split(/\r?\n/);
        let variantRel = "";
        for (let i = 0; i < masterLines.length; i++) {
          const l = masterLines[i].trim();
          if (l.startsWith("#EXT-X-STREAM-INF:")) {
            for (let j = i + 1; j < masterLines.length; j++) {
              const candidate = masterLines[j].trim();
              if (!candidate) continue;
              if (!candidate.startsWith("#")) {
                variantRel = candidate;
              }
              break;
            }
            if (variantRel) break;
          }
        }
        if (variantRel) {
          try {
            const variantAbs = new URL(variantRel, finalUrl).toString();
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 8000);
            try {
              const varUp = await fetch(variantAbs, {
                headers,
                signal: controller.signal,
                redirect: "follow"
              });
              if (varUp.ok) {
                const varText = await varUp.text();
                if (varText.trimStart().startsWith("#EXTM3U")) {
                  text = varText;
                  resolvedFinalUrl = varUp.url || variantAbs;
                  redirectCache.set(targetUrl, {
                    finalUrl: resolvedFinalUrl,
                    expires: Date.now() + 90_000
                  });
                }
              }
            } finally {
              clearTimeout(timeout);
            }
          } catch {}
        }
      }

      if (text.trimStart().startsWith("#EXTM3U")) {
        const refParam = referer ? `&referer=${encodeURIComponent(referer)}` : "";
        const transParam = transcode ? "&transcode=1" : "";
        const brandParam = brand ? `&brand=${encodeURIComponent(brand)}` : "";
        const ownerParam =
          (reqTs > 0 ? `&ts=${reqTs}` : "") + (reqSa ? "&sa=1" : "");

        let rawLines = text.split(/\r?\n/);

        // When transcoding DVB-T2 HEVC segments, keep the latest 3 segments and pre-warm transcoding immediately
        if (transcode) {
          const extinfIndices: number[] = [];
          for (let i = 0; i < rawLines.length; i++) {
            if (rawLines[i].trim().startsWith("#EXTINF:")) {
              extinfIndices.push(i);
            }
          }
          if (extinfIndices.length > 3) {
            const dropCount = extinfIndices.length - 3;
            const cutStart = extinfIndices[0];
            const keepFrom = extinfIndices[dropCount];
            const headerLines = rawLines.slice(0, cutStart).map((hl) => {
              const m = hl.match(/^#EXT-X-MEDIA-SEQUENCE:(\d+)/i);
              if (m) {
                return `#EXT-X-MEDIA-SEQUENCE:${parseInt(m[1], 10) + dropCount}`;
              }
              return hl;
            });
            rawLines = [...headerLines, ...rawLines.slice(keepFrom)];
          }
        }

        const segmentAbsUrls: string[] = [];
        let expectVariantPlaylistNext = false;

        const rewritten = rawLines
          .map((line) => {
            const trimmed = line.trim();
            if (!trimmed) return line;
            if (trimmed.startsWith("#")) {
              if (/^#EXT-X-STREAM-INF:/i.test(trimmed)) {
                expectVariantPlaylistNext = true;
              } else if (/^#EXTINF:/i.test(trimmed)) {
                expectVariantPlaylistNext = false;
              }
              let fixedLine = line;
              if (/^#EXT-X-MEDIA:.*TYPE=AUDIO/i.test(trimmed)) {
                fixedLine = line.replace(/DEFAULT=NO/i, "DEFAULT=YES");
              } else if (/^#EXT-X-MEDIA:.*TYPE=SUBTITLES/i.test(trimmed)) {
                fixedLine = line
                  .replace(/DEFAULT=YES/gi, "DEFAULT=NO")
                  .replace(/AUTOSELECT=YES/gi, "AUTOSELECT=NO");
              }
              return fixedLine.replace(/URI="([^"]+)"/g, (_m, uri) => {
                try {
                  const abs = new URL(uri, resolvedFinalUrl).toString();
                  const isUriM3u8 =
                    /\.m3u8(\?|$)/i.test(abs) || /^#EXT-X-MEDIA:/i.test(trimmed);
                  const uriBase = isUriM3u8 ? "/api/hls-proxy/live.m3u8" : "/api/hls-proxy/seg.ts";
                  const sTok = encodeStreamShieldToken(abs);
                  const kSig = computeShieldSignature(abs);
                  return `URI="${uriBase}?s=${sTok}&k=${kSig}${transParam}${brandParam}${refParam}${ownerParam}"`;
                } catch {
                  return _m;
                }
              });
            }
            try {
              const abs = new URL(trimmed, resolvedFinalUrl).toString();
              const isSubM3u8 = expectVariantPlaylistNext || /\.m3u8(\?|$)/i.test(abs);
              expectVariantPlaylistNext = false;
              if (!isSubM3u8) {
                segmentAbsUrls.push(abs);
              }
              const basePath = isSubM3u8 ? "/api/hls-proxy/live.m3u8" : "/api/hls-proxy/seg.ts";
              const sTok = encodeStreamShieldToken(abs);
              const kSig = computeShieldSignature(abs);
              return `${basePath}?s=${sTok}&k=${kSig}${transParam}${brandParam}${refParam}${ownerParam}`;
            } catch {
              expectVariantPlaylistNext = false;
              return line;
            }
          })
          .join("\n");

        if (transcode && segmentAbsUrls.length > 0) {
          const firstSeg = segmentAbsUrls[0];
          const firstKey = `${firstSeg}|${brand}`;
          if (!transcodeCache.has(firstKey) && !activeTranscodeJobs.has(firstKey)) {
            getOrStartTranscodeJob(firstKey, firstSeg, brand, headers);
          }
        } else if (!transcode && segmentAbsUrls.length > 0) {
          for (const segUrl of segmentAbsUrls.slice(-3)) {
            prefetchRawSegment(segUrl);
          }
        }

        playlistCache.set(plCacheKey, { body: rewritten, expires: Date.now() + 1500 });
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        return res.send(rewritten);
      }
    }

    const arrayBuffer = await upstream.arrayBuffer();
    const buf = Buffer.from(arrayBuffer);
    if (buf.length > 0) {
      if (rawSegmentCache.size >= 24) {
        const oldest = rawSegmentCache.keys().next().value;
        if (oldest) rawSegmentCache.delete(oldest);
      }
      rawSegmentCache.set(targetUrl, buf);
    }
    return sendBufferWithRangeSupport(req, res, buf);
  } catch (err: any) {
    if (!res.headersSent) {
      return res.status(502).send("Stream proxy error");
    }
  }
});


// 🎬 Movie Stream & Kurdish WebVTT Subtitle Endpoints (Blue Streak 1999)
app.get("/api/subtitles/blue-streak-ku.vtt", (_req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "text/vtt; charset=utf-8");
  try {
    const jsonPath = path.join(process.cwd(), "public", "subtitles", "blue-streak-ku.json");
    if (!fs.existsSync(jsonPath)) {
      return res.send("WEBVTT\n\n");
    }
    const cues: { start: number; end: number; text: string }[] = JSON.parse(
      fs.readFileSync(jsonPath, "utf8")
    );
    const fmt = (sec: number) => {
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = Math.floor(sec % 60);
      const ms = Math.round((sec - Math.floor(sec)) * 1000);
      return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
    };
    const lines = ["WEBVTT", ""];
    for (const c of cues) {
      if (c && typeof c.start === "number" && typeof c.end === "number" && c.text) {
        lines.push(`${fmt(c.start)} --> ${fmt(c.end)} line:88%`);
        lines.push(c.text);
        lines.push("");
      }
    }
    return res.send(lines.join("\n"));
  } catch {
    return res.send("WEBVTT\n\n");
  }
});

app.get("/api/movie-stream/blue-streak", async (req, res) => {
  const movieUrl =
    "https://ia800708.us.archive.org/9/items/blue-streak-1999.-nf.-web-dl/Blue%20Streak%20%281999%29.NF.WEB-DL.mp4";
  res.setHeader("Access-Control-Allow-Origin", "*");
  try {
    const reqHeaders: Record<string, string> = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    };
    if (req.headers.range) {
      reqHeaders["Range"] = String(req.headers.range);
    }
    const up = await fetch(movieUrl, { headers: reqHeaders, redirect: "follow" });
    res.status(up.status);
    const copyHeaders = ["content-type", "content-length", "content-range", "accept-ranges"];
    for (const h of copyHeaders) {
      const v = up.headers.get(h);
      if (v) res.setHeader(h, v);
    }
    if (up.body) {
      const stream = Readable.fromWeb(up.body as any);
      req.on("close", () => {
        try {
          stream.destroy();
        } catch {}
      });
      return stream.pipe(res);
    }
    return res.end();
  } catch {
    return res.status(502).end();
  }
});

// 📺 Direct Series Episode Resolver & Subtitle-Free Streamer (Game of Thrones, Breaking Bad & Kurdbin Flona)
const FLONA_EPISODE_GUIDS = [
  "31379cd2-ab07-434e-9a09-29c18d57af35",
  "6943c37b-200d-4ddc-bcfe-5391d8568fbf",
  "58b03997-0be5-41f0-b20c-9c16d03077d9",
  "7f189533-7a63-42c1-8c44-afa36bed5788",
  "65291a1b-fe00-4174-a886-5e745be5bbdc",
  "f4a149c9-1d85-4c96-badd-d415d7dc477d",
  "cc34e405-9265-4ce0-a222-739ae19fc312",
  "6012d97e-e508-4e26-b412-5ba8c7aea10c",
  "ff3bf0d7-2328-40d4-84c8-1338ae5c9945",
  "91c8098f-a7ba-453b-85e9-39b62f298896",
  "bbfbbbef-40d8-4e0e-80fb-b73ae5b8e87f",
  "1365b72f-b1fa-4ee7-a959-6e3f8cfcd6c9",
  "a621d39e-e14b-4e0e-9eb7-aa600bea477f",
  "02239532-6717-4571-b740-36d7e39c1bee",
  "cb157f04-93ed-4ec1-b23a-f90894b39797"
];

const flonaVodCache = new Map<string, { playlist: string; duration: number }>();

async function fetchFlonaVodPlaylist(episode: number): Promise<{ playlist: string; duration: number } | null> {
  const guid = FLONA_EPISODE_GUIDS[episode - 1];
  if (!guid) return null;
  const cached = flonaVodCache.get(guid);
  if (cached) return cached;

  const baseHost = "https://vz-436f3b70-ee3.b-cdn.net";
  const variantUrl = `${baseHost}/${guid}/720p/video.m3u8`;
  try {
    const resp = await fetch(variantUrl, {
      headers: { "User-Agent": "Mozilla/5.0" }
    });
    if (!resp.ok) return null;
    const raw = await resp.text();
    let totalDur = 0;
    const rewrittenLines = raw.split(/\r?\n/).map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith("#EXTINF:")) {
        const val = parseFloat(trimmed.slice(8).split(",")[0]);
        if (Number.isFinite(val) && val > 0) totalDur += val;
        return line;
      }
      if (trimmed.startsWith("#EXT-X-KEY:") && trimmed.includes('URI="')) {
        return trimmed.replace(/URI="([^"]+)"/, (_m, uri) => {
          const abs = uri.startsWith("http")
            ? uri
            : uri.startsWith("/")
            ? `${baseHost}${uri}`
            : `${baseHost}/${guid}/720p/${uri}`;
          return `URI="${abs}"`;
        });
      }
      if (trimmed.startsWith("#")) return line;
      return trimmed.startsWith("http")
        ? trimmed
        : trimmed.startsWith("/")
        ? `${baseHost}${trimmed}`
        : `${baseHost}/${guid}/720p/${trimmed}`;
    });

    const result = {
      playlist: rewrittenLines.join("\n"),
      duration: Math.floor(totalDur)
    };
    flonaVodCache.set(guid, result);
    vodMetaCache.set(`${baseHost}/${guid}/playlist.m3u8`, {
      audioMap: "0:a:0?",
      duration: result.duration
    });
    return result;
  } catch {
    return null;
  }
}

let cachedSeriesEpisodes: Record<string, Record<string, Record<string, string>>> | null = null;

function resolveSeriesEpisodeUrl(seriesId: string, season: number, episode: number, srv = 0): string | null {
  if (seriesId === "flona") {
    const guid = FLONA_EPISODE_GUIDS[episode - 1];
    return guid ? `https://vz-436f3b70-ee3.b-cdn.net/${guid}/playlist.m3u8` : null;
  }
  try {
    if (!cachedSeriesEpisodes) {
      const epPath = path.join(process.cwd(), "public", "series-episodes.json");
      if (fs.existsSync(epPath)) {
        cachedSeriesEpisodes = JSON.parse(fs.readFileSync(epPath, "utf8"));
      }
    }
    if (!cachedSeriesEpisodes) return null;

    const xtreamIds =
      seriesId === "game-of-thrones"
        ? srv === 1
          ? ["19404", "17194"]
          : ["17194", "19404"]
        : seriesId === "breaking-bad"
        ? srv === 1
          ? ["13698", "10377"]
          : ["10377", "13698"]
        : [];

    for (const xid of xtreamIds) {
      const file = cachedSeriesEpisodes[xid]?.[String(season)]?.[String(episode)];
      if (file) {
        return `http://195.128.27.253:2095/series/548607065148/955372318450/${file}`;
      }
    }
    return null;
  } catch {
    return null;
  }
}

const vodMetaCache = new Map<string, { audioMap: string; duration: number }>();
async function probeVodMetadata(url: string): Promise<{ audioMap: string; duration: number }> {
  const cached = vodMetaCache.get(url);
  if (cached) return cached;
  try {
    const out = await new Promise<string>((resolve) => {
      execFile(
        "ffprobe",
        [
          "-v",
          "error",
          "-user_agent",
          "VLC/3.0.18 LibVLC/3.0.18",
          "-show_entries",
          "format=duration:stream=index,codec_type:stream_tags=language",
          "-of",
          "json",
          url
        ],
        { timeout: 3500 },
        (err, stdout) => {
          resolve(err ? "" : stdout || "");
        }
      );
    });
    if (out) {
      const parsed = JSON.parse(out);
      const audioStreams: { index: number; codec_type?: string; tags?: { language?: string } }[] =
        (parsed?.streams || []).filter((s: any) => s?.codec_type === "audio");
      const engIdx = audioStreams.findIndex((s) => /^eng?$/i.test(s?.tags?.language || ""));
      const audioMap = engIdx >= 0 ? `0:a:${engIdx}?` : "0:a:0?";
      const rawDur = parseFloat(parsed?.format?.duration || "0");
      const duration = Number.isFinite(rawDur) && rawDur > 0 ? Math.floor(rawDur) : 0;
      const meta = { audioMap, duration };
      vodMetaCache.set(url, meta);
      return meta;
    }
  } catch {}
  return { audioMap: "0:a:0?", duration: 0 };
}

app.get("/api/series-stream/:seriesId/:season/:episode/info", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-cache");
  const seriesId = String(req.params.seriesId || "");
  const season = Math.max(1, Number(req.params.season || 1));
  const episode = Math.max(1, Number(req.params.episode || 1));
  const srv = Number(req.query.srv || 0);
  if (seriesId === "flona") {
    const flona = await fetchFlonaVodPlaylist(episode);
    return res.json({ duration: flona?.duration || 0 });
  }
  const epUrl = resolveSeriesEpisodeUrl(seriesId, season, episode, srv);
  if (!epUrl) {
    return res.json({ duration: 0 });
  }
  const meta = vodMetaCache.get(epUrl);
  return res.json({ duration: meta?.duration || 0 });
});

let latestSeriesSwitchTs = 0;
let latestSeriesSessionId = "";

app.get("/api/series-stream/:seriesId/:season/:episode/live.m3u8", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Expose-Headers", "X-Vod-Duration");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  if (req.method === "HEAD") {
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    return res.status(200).end();
  }

  const seriesId = String(req.params.seriesId || "");
  const season = Math.max(1, Number(req.params.season || 1));
  const episode = Math.max(1, Number(req.params.episode || 1));
  const srv = Number(req.query.srv || 0);
  const startSec = Math.max(0, Math.floor(Number(req.query.start || 0) || 0));
  const reqTs = Number(req.query.ts || 0) || 0;

  if (seriesId === "flona") {
    const flona = await fetchFlonaVodPlaylist(episode);
    if (!flona) {
      return res.status(404).send("Flona episode not found");
    }
    if (flona.duration > 0) {
      res.setHeader("X-Vod-Duration", String(flona.duration));
    }
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    return res.send(flona.playlist);
  }

  const epUrl = resolveSeriesEpisodeUrl(seriesId, season, episode, srv);
  if (!epUrl) {
    return res.status(404).send("Episode not found");
  }

  try {
    const sessionId = crypto
      .createHash("md5")
      .update(`${epUrl}|series|ss=${startSec}|v9`)
      .digest("hex")
      .slice(0, 12);

    // Reject stale playlist polls from a previously closed episode so they never kill or overwrite the active episode
    if (
      reqTs > 0 &&
      latestSeriesSwitchTs > 0 &&
      reqTs < latestSeriesSwitchTs &&
      sessionId !== latestSeriesSessionId
    ) {
      return res.status(410).send("Superseded episode request");
    }

    if (reqTs >= latestSeriesSwitchTs || latestSeriesSwitchTs === 0) {
      if (reqTs > 0) latestSeriesSwitchTs = reqTs;
      latestSeriesSessionId = sessionId;
    }

    activeStreamOwner = {
      sessionId,
      ts: Date.now() + 30_000,
      sa: true,
      lastSeen: Date.now()
    };

    const session = await ensureHlsLiveSession(epUrl, "series", startSec);
    if (session) {
      await session.readyPromise;
      // Verify this episode was not superseded by a newer episode switch while warming up
      if (
        (latestSeriesSessionId && session.sessionId !== latestSeriesSessionId) ||
        liveSessions.get(session.sessionId) !== session
      ) {
        return res.status(409).send("Episode switched");
      }
      const vodPlaylist = buildVodSeriesPlaylist(session) || session.lastPlaylist;
      if (vodPlaylist) {
        session.lastAccess = Date.now();
        const meta = vodMetaCache.get(epUrl);
        if (meta?.duration) {
          res.setHeader("X-Vod-Duration", String(meta.duration));
        }
        res.setHeader("Surrogate-Control", "no-store");
        res.setHeader("X-Accel-Buffering", "no");
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        return res.send(vodPlaylist);
      }
    }
    return res.status(503).send("Series stream warming up");
  } catch {
    return res.status(503).send("Series stream error");
  }
});

app.get("/api/series-stream/:seriesId/:season/:episode/video.mp4", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  const seriesId = String(req.params.seriesId || "");
  const season = Math.max(1, Number(req.params.season || 1));
  const episode = Math.max(1, Number(req.params.episode || 1));
  const srv = Number(req.query.srv || 0);
  const startSec = Math.max(0, Math.floor(Number(req.query.start || 0) || 0));
  const reqTs = Number(req.query.ts || 0) || 0;

  if (reqTs > 0 && latestSeriesSwitchTs > 0 && reqTs < latestSeriesSwitchTs) {
    return res.status(410).send("Superseded episode request");
  }
  if (reqTs >= latestSeriesSwitchTs) {
    if (reqTs > 0) latestSeriesSwitchTs = reqTs;
    latestSeriesSessionId = "";
  }

  const epUrl = resolveSeriesEpisodeUrl(seriesId, season, episode, srv);
  if (!epUrl) {
    return res.status(404).send("Episode not found");
  }

  // Stop any active HLS session so the Xtream connection is dedicated to this stream
  for (const [id, s] of liveSessions.entries()) {
    liveSessions.delete(id);
    stopLiveSession(s);
  }

  const meta = await probeVodMetadata(epUrl);
  res.setHeader("Content-Type", "video/mp4");

  const ffArgs = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-fflags",
    "+genpts+igndts+discardcorrupt",
    "-probesize",
    "500000",
    "-analyzeduration",
    "500000",
    "-user_agent",
    "VLC/3.0.18 LibVLC/3.0.18",
    "-reconnect",
    "1",
    "-reconnect_streamed",
    "1",
    "-reconnect_delay_max",
    "2",
    ...(startSec > 0 ? ["-ss", String(startSec)] : []),
    "-i",
    epUrl,
    "-map",
    "0:v:0",
    "-map",
    meta.audioMap,
    "-sn",
    "-vf",
    "scale=854:480:flags=fast_bilinear,format=yuv420p",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-tune",
    "zerolatency",
    "-crf",
    "26",
    "-maxrate",
    "1100k",
    "-bufsize",
    "2200k",
    "-g",
    "48",
    "-c:a",
    "aac",
    "-ac",
    "2",
    "-b:a",
    "128k",
    "-f",
    "mp4",
    "-movflags",
    "frag_keyframe+empty_moov+default_base_moof",
    "pipe:1"
  ];

  const proc = spawn(FFMPEG_BIN, ffArgs, { stdio: ["ignore", "pipe", "ignore"] });
  proc.stdout.pipe(res);

  req.on("close", () => {
    try {
      if (proc.exitCode === null && !proc.killed) {
        proc.kill("SIGKILL");
      }
    } catch {}
  });
});

interface CompactCue {
  s: number;
  e: number;
  t: string;
}

function resolveSeriesSubtitleJsonPath(seriesId: string, season: number, episode: number): string | null {
  const safeSeries = seriesId.replace(/[^a-z0-9-]/gi, "");
  if (!safeSeries || !Number.isFinite(season) || !Number.isFinite(episode)) return null;
  const rel = path.join("subtitles", "series", safeSeries, `s${season}e${episode}.json`);
  const publicPath = path.join(process.cwd(), "public", rel);
  if (fs.existsSync(publicPath)) return publicPath;
  const distPath = path.join(process.cwd(), "dist", rel);
  if (fs.existsSync(distPath)) return distPath;
  return null;
}

function formatVttTimestamp(sec: number): string {
  const clamped = Math.max(0, sec);
  const h = Math.floor(clamped / 3600);
  const m = Math.floor((clamped % 3600) / 60);
  const s = Math.floor(clamped % 60);
  const ms = Math.round((clamped - Math.floor(clamped)) * 1000);
  const carrySec = ms >= 1000 ? 1 : 0;
  const finalMs = ms >= 1000 ? ms - 1000 : ms;
  const totalS = s + carrySec;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(totalS).padStart(2, "0")}.${String(finalMs).padStart(3, "0")}`;
}

app.get("/api/series-subtitles/:seriesId/:season/:episode/cues.json", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  const seriesId = String(req.params.seriesId || "");
  const season = Math.max(1, Math.floor(Number(req.params.season || 1)));
  const episode = Math.max(1, Math.floor(Number(req.params.episode || 1)));
  const jsonPath = resolveSeriesSubtitleJsonPath(seriesId, season, episode);
  if (!jsonPath) {
    return res.status(404).json([]);
  }
  return res.sendFile(jsonPath);
});

app.get("/api/series-subtitles/:seriesId/:season/:episode/subtitles.vtt", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "text/vtt; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  const seriesId = String(req.params.seriesId || "");
  const season = Math.max(1, Math.floor(Number(req.params.season || 1)));
  const episode = Math.max(1, Math.floor(Number(req.params.episode || 1)));
  const startSec = Math.max(0, Number(req.query.start || 0) || 0);
  const jsonPath = resolveSeriesSubtitleJsonPath(seriesId, season, episode);
  if (!jsonPath) {
    return res.send("WEBVTT\n\n");
  }
  try {
    const cues: CompactCue[] = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    const lines = ["WEBVTT", ""];
    let idx = 1;
    for (const c of cues) {
      if (!c || typeof c.s !== "number" || typeof c.e !== "number" || !c.t) continue;
      const shiftedEnd = c.e - startSec;
      if (shiftedEnd <= 0.05) continue;
      const shiftedStart = Math.max(0, c.s - startSec);
      const rtlWrapped = c.t
        .split("\n")
        .map((line) => `\u2067${line}\u2069`)
        .join("\n");
      lines.push(String(idx++));
      lines.push(`${formatVttTimestamp(shiftedStart)} --> ${formatVttTimestamp(shiftedEnd)} line:82%`);
      lines.push(rtlWrapped);
      lines.push("");
    }
    return res.send(lines.join("\n"));
  } catch {
    return res.send("WEBVTT\n\n");
  }
});

// 🎬 50 International Movies VOD Streamer & Kurdish Subtitle Endpoints
let cachedMovieStreams: Record<string, string[]> | null = null;

function resolveMovieStreamUrl(movieId: string, srv = 0): string | null {
  const safeId = movieId.replace(/[^a-z0-9-]/gi, "");
  if (!safeId) return null;
  try {
    if (!cachedMovieStreams) {
      const publicPath = path.join(process.cwd(), "public", "movie-streams.json");
      const distPath = path.join(process.cwd(), "dist", "movie-streams.json");
      const targetPath = fs.existsSync(publicPath)
        ? publicPath
        : fs.existsSync(distPath)
        ? distPath
        : null;
      if (targetPath) {
        cachedMovieStreams = JSON.parse(fs.readFileSync(targetPath, "utf8"));
      }
    }
    if (!cachedMovieStreams) return null;
    const files = cachedMovieStreams[safeId];
    if (!Array.isArray(files) || files.length === 0) return null;
    const file = files[srv] || files[0];
    if (!file) return null;
    return `http://195.128.27.253:2095/movie/548607065148/955372318450/${file}`;
  } catch {
    return null;
  }
}

function resolveMovieSubtitleJsonPath(movieId: string): string | null {
  const safeId = movieId.replace(/[^a-z0-9-]/gi, "");
  if (!safeId) return null;
  const rel = path.join("subtitles", "movies", `${safeId}.json`);
  const publicPath = path.join(process.cwd(), "public", rel);
  if (fs.existsSync(publicPath)) return publicPath;
  const distPath = path.join(process.cwd(), "dist", rel);
  if (fs.existsSync(distPath)) return distPath;
  return null;
}

app.get("/api/movie-vod/:movieId/info", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-cache");
  const movieId = String(req.params.movieId || "");
  const srv = Number(req.query.srv || 0);
  const movieUrl = resolveMovieStreamUrl(movieId, srv);
  if (!movieUrl) {
    return res.json({ duration: 0 });
  }
  const meta = vodMetaCache.get(movieUrl);
  return res.json({ duration: meta?.duration || 0 });
});

app.get("/api/movie-vod/:movieId/live.m3u8", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Expose-Headers", "X-Vod-Duration");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  if (req.method === "HEAD") {
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
    return res.status(200).end();
  }

  const movieId = String(req.params.movieId || "");
  const srv = Number(req.query.srv || 0);
  const startSec = Math.max(0, Math.floor(Number(req.query.start || 0) || 0));
  const reqTs = Number(req.query.ts || 0) || 0;

  const movieUrl = resolveMovieStreamUrl(movieId, srv);
  if (!movieUrl) {
    return res.status(404).send("Movie not found");
  }

  try {
    const sessionId = crypto
      .createHash("md5")
      .update(`${movieUrl}|series|ss=${startSec}|v9`)
      .digest("hex")
      .slice(0, 12);

    if (
      reqTs > 0 &&
      latestSeriesSwitchTs > 0 &&
      reqTs < latestSeriesSwitchTs &&
      sessionId !== latestSeriesSessionId
    ) {
      return res.status(410).send("Superseded movie request");
    }

    if (reqTs >= latestSeriesSwitchTs || latestSeriesSwitchTs === 0) {
      if (reqTs > 0) latestSeriesSwitchTs = reqTs;
      latestSeriesSessionId = sessionId;
    }

    activeStreamOwner = {
      sessionId,
      ts: Date.now() + 30_000,
      sa: true,
      lastSeen: Date.now()
    };

    const session = await ensureHlsLiveSession(movieUrl, "series", startSec);
    if (session) {
      await session.readyPromise;
      if (
        (latestSeriesSessionId && session.sessionId !== latestSeriesSessionId) ||
        liveSessions.get(session.sessionId) !== session
      ) {
        return res.status(409).send("Movie switched");
      }
      const vodPlaylist = buildVodSeriesPlaylist(session) || session.lastPlaylist;
      if (vodPlaylist) {
        session.lastAccess = Date.now();
        const meta = vodMetaCache.get(movieUrl);
        if (meta?.duration) {
          res.setHeader("X-Vod-Duration", String(meta.duration));
        }
        res.setHeader("Surrogate-Control", "no-store");
        res.setHeader("X-Accel-Buffering", "no");
        res.setHeader("Content-Type", "application/vnd.apple.mpegurl");
        return res.send(vodPlaylist);
      }
    }
    return res.status(503).send("Movie stream warming up");
  } catch {
    return res.status(503).send("Movie stream error");
  }
});

app.get("/api/movie-vod/:movieId/video.mp4", async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  const movieId = String(req.params.movieId || "");
  const srv = Number(req.query.srv || 0);
  const startSec = Math.max(0, Math.floor(Number(req.query.start || 0) || 0));
  const reqTs = Number(req.query.ts || 0) || 0;

  if (reqTs > 0 && latestSeriesSwitchTs > 0 && reqTs < latestSeriesSwitchTs) {
    return res.status(410).send("Superseded movie request");
  }
  if (reqTs >= latestSeriesSwitchTs) {
    if (reqTs > 0) latestSeriesSwitchTs = reqTs;
    latestSeriesSessionId = "";
  }

  const movieUrl = resolveMovieStreamUrl(movieId, srv);
  if (!movieUrl) {
    return res.status(404).send("Movie not found");
  }

  for (const [id, s] of liveSessions.entries()) {
    liveSessions.delete(id);
    stopLiveSession(s);
  }

  const meta = await probeVodMetadata(movieUrl);
  res.setHeader("Content-Type", "video/mp4");

  const ffArgs = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-fflags",
    "+genpts+igndts+discardcorrupt",
    "-probesize",
    "500000",
    "-analyzeduration",
    "500000",
    "-user_agent",
    "VLC/3.0.18 LibVLC/3.0.18",
    "-reconnect",
    "1",
    "-reconnect_streamed",
    "1",
    "-reconnect_delay_max",
    "2",
    ...(startSec > 0 ? ["-ss", String(startSec)] : []),
    "-i",
    movieUrl,
    "-map",
    "0:v:0",
    "-map",
    meta.audioMap,
    "-sn",
    "-vf",
    "scale=854:480:flags=fast_bilinear,format=yuv420p",
    "-c:v",
    "libx264",
    "-preset",
    "ultrafast",
    "-tune",
    "zerolatency",
    "-crf",
    "26",
    "-maxrate",
    "1100k",
    "-bufsize",
    "2200k",
    "-g",
    "48",
    "-c:a",
    "aac",
    "-ac",
    "2",
    "-b:a",
    "128k",
    "-f",
    "mp4",
    "-movflags",
    "frag_keyframe+empty_moov+default_base_moof",
    "pipe:1"
  ];

  const proc = spawn(FFMPEG_BIN, ffArgs, { stdio: ["ignore", "pipe", "ignore"] });
  proc.stdout.pipe(res);

  req.on("close", () => {
    try {
      if (proc.exitCode === null && !proc.killed) {
        proc.kill("SIGKILL");
      }
    } catch {}
  });
});

app.get("/api/movie-subtitles/:movieId/cues.json", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=86400");
  const movieId = String(req.params.movieId || "");
  const jsonPath = resolveMovieSubtitleJsonPath(movieId);
  if (!jsonPath) {
    return res.status(404).json([]);
  }
  return res.sendFile(jsonPath);
});

app.get("/api/movie-subtitles/:movieId/subtitles.vtt", (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Content-Type", "text/vtt; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  const movieId = String(req.params.movieId || "");
  const startSec = Math.max(0, Number(req.query.start || 0) || 0);
  const jsonPath = resolveMovieSubtitleJsonPath(movieId);
  if (!jsonPath) {
    return res.send("WEBVTT\n\n");
  }
  try {
    const cues: CompactCue[] = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
    const lines = ["WEBVTT", ""];
    let idx = 1;
    for (const c of cues) {
      if (!c || typeof c.s !== "number" || typeof c.e !== "number" || !c.t) continue;
      const shiftedEnd = c.e - startSec;
      if (shiftedEnd <= 0.05) continue;
      const shiftedStart = Math.max(0, c.s - startSec);
      const rtlWrapped = c.t
        .split("\n")
        .map((line) => `\u2067${line}\u2069`)
        .join("\n");
      lines.push(String(idx++));
      lines.push(`${formatVttTimestamp(shiftedStart)} --> ${formatVttTimestamp(shiftedEnd)} line:82%`);
      lines.push(rtlWrapped);
      lines.push("");
    }
    return res.send(lines.join("\n"));
  } catch {
    return res.send("WEBVTT\n\n");
  }
});

async function startServer() {
  // 🛡️ Permanent immutable static cache for all channel logos so they never break or reload slowly
  app.use(
    "/logos",
    express.static(path.join(process.cwd(), "public", "logos"), {
      maxAge: "365d",
      immutable: true,
      etag: true,
      lastModified: true
    })
  );

  // 📱 Service Worker & PWA Manifest static handlers (supports OS notifications on iOS & Android without caching HLS streams)
  app.get(['/sw.js', '/sw.mjs', '/dev-sw.js'], (_req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Service-Worker-Allowed', '/');
    return res.send(`
      self.addEventListener('install', () => {
        self.skipWaiting();
      });

      self.addEventListener('activate', (event) => {
        event.waitUntil(
          caches.keys()
            .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
            .then(() => self.clients.claim())
        );
      });

      self.addEventListener('push', (event) => {
        let data = {};
        if (event.data) {
          try {
            data = event.data.json();
          } catch {
            data = { title: 'own+', body: event.data.text() };
          }
        }
        const title = data.title || 'own+';
        const options = {
          body: data.body || '',
          icon: '/icon.png?v=12',
          badge: '/favicon.png?v=12',
          tag: data.tag || 'ownplus-alert',
          renotify: true,
          vibrate: [180, 80, 180],
          data: { url: data.url || '/' }
        };
        event.waitUntil(self.registration.showNotification(title, options));
      });

      self.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
          const payload = event.data.payload || {};
          event.waitUntil(
            self.registration.showNotification(payload.title || 'own+', {
              body: payload.body || '',
              icon: '/icon.png?v=12',
              badge: '/favicon.png?v=12',
              tag: payload.tag || 'ownplus-alert',
              renotify: true,
              vibrate: [180, 80, 180],
              data: { url: payload.url || '/' }
            })
          );
        }
      });

      self.addEventListener('notificationclick', (event) => {
        event.notification.close();
        const targetUrl = (event.notification.data && event.notification.data.url) || '/';
        event.waitUntil(
          self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
            for (const client of clientList) {
              if ('focus' in client) {
                return client.focus();
              }
            }
            if (self.clients.openWindow) {
              return self.clients.openWindow(targetUrl);
            }
          })
        );
      });
    `);
  });

  app.get('/manifest.webmanifest', (req, res) => {
    const distManifest = path.join(process.cwd(), 'dist', 'manifest.webmanifest');
    if (fs.existsSync(distManifest)) {
      res.setHeader('Content-Type', 'application/manifest+json');
      return res.sendFile(distManifest);
    }
    res.setHeader('Content-Type', 'application/manifest+json');
    return res.json({
      id: "/",
      name: "own+",
      short_name: "own+",
      theme_color: "#ffffff",
      background_color: "#ffffff",
      display: "standalone",
      orientation: "portrait",
      scope: "/",
      start_url: "/",
      icons: [
        { src: "/apple-touch-icon.png?v=12", sizes: "180x180", type: "image/png", purpose: "any" },
        { src: "/pwa-192x192.png?v=12", sizes: "192x192", type: "image/png", purpose: "any" },
        { src: "/pwa-512x512.png?v=12", sizes: "512x512", type: "image/png", purpose: "any" },
        { src: "/pwa-maskable-512x512.png?v=12", sizes: "512x512", type: "image/png", purpose: "maskable" }
      ]
    });
  });

  const httpServer = http.createServer(app);

  // Vite middleware setup (only in dev mode; npm start or NODE_ENV=production serves built dist)
  const isProductionMode =
    process.env.NODE_ENV === "production" ||
    (process.env.npm_lifecycle_event === "start" &&
      fs.existsSync(path.join(process.cwd(), "dist", "index.html")));
  if (!isProductionMode) {
    // Serve a WebSocket-free /@vite/client when HMR is disabled so AI Studio Preview never triggers @vite/client:454:31 WebSocket errors
    app.get("/@vite/client", (_req, res) => {
      res.setHeader("Content-Type", "application/javascript; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      return res.send(`
const sheetsMap = new Map();
if (typeof document !== "undefined") {
  document.querySelectorAll("style[data-vite-dev-id]").forEach((el) => {
    sheetsMap.set(el.getAttribute("data-vite-dev-id"), el);
  });
}
let lastInsertedStyle;
export function updateStyle(id, content) {
  if (typeof document === "undefined") return;
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("type", "text/css");
    style.setAttribute("data-vite-dev-id", id);
    style.textContent = content;
    if (!lastInsertedStyle) {
      document.head.appendChild(style);
      setTimeout(() => { lastInsertedStyle = undefined; }, 0);
    } else {
      lastInsertedStyle.insertAdjacentElement("afterend", style);
    }
    lastInsertedStyle = style;
  } else {
    style.textContent = content;
  }
  sheetsMap.set(id, style);
}
export function removeStyle(id) {
  if (typeof document === "undefined") return;
  const style = sheetsMap.get(id);
  if (style) {
    document.head.removeChild(style);
    sheetsMap.delete(id);
  }
}
export function injectQuery(url, queryToInject) {
  if (url[0] !== "." && url[0] !== "/") return url;
  const pathname = url.replace(/[?#].*$/, "");
  const { search, hash } = new URL(url, "http://vite.dev");
  return \`\${pathname}?\${queryToInject}\${search ? "&" + search.slice(1) : ""}\${hash || ""}\`;
}
const dataMap = new Map();
export function createHotContext(ownerPath) {
  if (!dataMap.has(ownerPath)) dataMap.set(ownerPath, {});
  return {
    get data() { return dataMap.get(ownerPath); },
    accept() {},
    acceptExports() {},
    dispose() {},
    prune() {},
    decline() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
    acceptDeps() {}
  };
}
const BaseElement = typeof HTMLElement !== "undefined" ? HTMLElement : class {};
export class ErrorOverlay extends BaseElement {
  close() {}
}
`);
    });

    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false,
        watch: null
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
});
