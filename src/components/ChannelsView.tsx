import React, { useState, useEffect, useRef, useCallback } from "react";
import Hls from "hls.js";
import { motion, AnimatePresence } from "motion/react";
import {
  Tv,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  RefreshCw,
  Search,
  Heart,
  Radio,
  PictureInPicture2,
  ArrowRight,
  ArrowLeft,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { KURDISH_CHANNELS, KurdishChannel, ChannelCategory } from "../data/kurdishChannels";
import { Language, Translations } from "../translations";
import EdgeSwipeBack from "./EdgeSwipeBack";

interface ChannelsViewProps {
  lang: Language;
  t: Translations;
  favorites: string[];
  onToggleFavorite: (channelId: string) => void;
  onlyFavorites?: boolean;
  selectedChannelId: string;
  onSelectChannel: (channelId: string) => void;
  externalCategory?: ChannelCategory;
  onExternalCategoryChange?: (cat: ChannelCategory) => void;
  externalSearchQuery?: string;
  isTabActive?: boolean;
  popToRootTick?: number;
  openChannelRequest?: { id: string; tick: number } | null;
}

export default function ChannelsView({
  lang,
  t,
  favorites,
  onToggleFavorite,
  onlyFavorites = false,
  selectedChannelId,
  onSelectChannel,
  externalCategory = "all",
  onExternalCategoryChange,
  externalSearchQuery = "",
  isTabActive = true,
  popToRootTick = 0,
  openChannelRequest = null
}: ChannelsViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<ChannelCategory>("all");
  const [watchingChannelId, setWatchingChannelId] = useState<string | null>(null);
  const [serverIndex, setServerIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isBuffering, setIsBuffering] = useState(true);
  const [streamError, setStreamError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [minRevealElapsed, setMinRevealElapsed] = useState(false);
  const [revealStage, setRevealStage] = useState<"loading" | "opening" | "open">("loading");
  const [serverOverrides, setServerOverrides] = useState<
    Record<string, KurdishChannel["servers"]>
  >({});
  const [adBannerIndex, setAdBannerIndex] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const attachVideoRef = useCallback((node: HTMLVideoElement | null) => {
    videoRef.current = node;
    setVideoEl(node);
  }, []);
  const playerContainerRef = useRef<HTMLDivElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const waitingTimerRef = useRef<number | null>(null);
  const controlsTimerRef = useRef<number | null>(null);
  const mutedRef = useRef<boolean>(isMuted);
  const revealStageRef = useRef<"loading" | "opening" | "open">(revealStage);
  const hasStartedPlayingRef = useRef<boolean>(false);
  const lastSelectTimeRef = useRef<number>(0);
  const listScrollRef = useRef<number>(0);
  const prevPopTickRef = useRef<number>(popToRootTick);
  const viaSwipeRef = useRef<boolean>(false);

  const isRtl = lang === "ku";
  const pushInX = isRtl ? "-100%" : "100%";
  const parentShiftX = isRtl ? "24%" : "-24%";
  const iosPageEase = [0.32, 0.72, 0, 1] as const;
  const clearZeroTransform = (_: unknown, generated: string) =>
    generated === "translateX(0px)" ||
    generated === "translateX(0%)" ||
    generated === "translate3d(0px, 0px, 0px)" ||
    generated === "scale(1)" ||
    generated === "translateY(0px) scale(1)" ||
    generated === "translateY(0px)" ||
    generated === "none"
      ? "none"
      : generated;

  useEffect(() => {
    mutedRef.current = isMuted;
  }, [isMuted]);

  useEffect(() => {
    revealStageRef.current = revealStage;
  }, [revealStage]);

  useEffect(() => {
    if (!isTabActive) return;
    const timer = window.setInterval(() => {
      setAdBannerIndex((prev) => (prev === 0 ? 1 : 0));
    }, 4500);
    return () => window.clearInterval(timer);
  }, [isTabActive]);

  const clearWaitingTimer = () => {
    if (waitingTimerRef.current !== null) {
      window.clearTimeout(waitingTimerRef.current);
      waitingTimerRef.current = null;
    }
  };

  const clearControlsTimer = useCallback(() => {
    if (controlsTimerRef.current !== null) {
      window.clearTimeout(controlsTimerRef.current);
      controlsTimerRef.current = null;
    }
  }, []);

  const scheduleHideControls = useCallback(() => {
    clearControlsTimer();
    controlsTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
    }, 3200);
  }, [clearControlsTimer]);

  const revealControls = useCallback(
    (autoHide = true) => {
      setControlsVisible(true);
      if (autoHide && isPlaying && !streamError && revealStage === "open") {
        scheduleHideControls();
      } else {
        clearControlsTimer();
      }
    },
    [isPlaying, streamError, revealStage, scheduleHideControls, clearControlsTimer]
  );

  // Auto-hide controls after playback opens, and keep visible when paused or errored
  useEffect(() => {
    if (!watchingChannelId) {
      clearControlsTimer();
      setControlsVisible(true);
      return;
    }
    if (revealStage === "open" && isPlaying && !streamError) {
      setControlsVisible(true);
      scheduleHideControls();
    } else {
      clearControlsTimer();
      setControlsVisible(true);
    }
    return () => clearControlsTimer();
  }, [watchingChannelId, revealStage, isPlaying, streamError, scheduleHideControls, clearControlsTimer]);

  // Preload and permanently warm channel logos in browser image cache so they never flicker or break
  useEffect(() => {
    const preloadTimer = window.setTimeout(() => {
      for (const ch of KURDISH_CHANNELS) {
        const img = new window.Image();
        img.decoding = "async";
        img.src = ch.logo;
      }
    }, 300);
    return () => window.clearTimeout(preloadTimer);
  }, []);

  const handleChannelLogoError = (
    e: React.SyntheticEvent<HTMLImageElement, Event>,
    channel: KurdishChannel
  ) => {
    const target = e.currentTarget;
    const stage = Number(target.getAttribute("data-fallback-stage") || "0");
    if (stage === 0) {
      target.setAttribute("data-fallback-stage", "1");
      if (channel.fallbackLogo && channel.fallbackLogo !== channel.logo) {
        target.src = channel.fallbackLogo;
        return;
      }
      const cleanLogo = channel.logo.split("?")[0];
      target.src = `${cleanLogo}?v=permanent`;
      return;
    }
    if (stage === 1) {
      target.setAttribute("data-fallback-stage", "2");
      const cleanFallback = (channel.fallbackLogo || channel.logo).split("?")[0];
      target.src = cleanFallback;
      return;
    }
    if (stage === 2) {
      target.setAttribute("data-fallback-stage", "3");
      target.src = "/assets/aistudio/key-logo-3d.png";
    }
  };

  // Sync latest live channel servers from backend (bypasses any stale PWA cache on iPhone/Android Home Screen)
  useEffect(() => {
    fetch(`/api/channels-live?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.overrides) {
          setServerOverrides(data.overrides);
        }
      })
      .catch(() => {});
  }, []);

  // Sync external category filter from top Netflix navbar
  useEffect(() => {
    setActiveCategory(externalCategory);
  }, [externalCategory]);

  const effectiveChannelId = watchingChannelId;
  const showPlayer = Boolean(effectiveChannelId);

  const rawActiveChannel: KurdishChannel =
    KURDISH_CHANNELS.find((c) => c.id === effectiveChannelId) ||
    KURDISH_CHANNELS[0];

  const activeChannel: KurdishChannel = serverOverrides[rawActiveChannel.id]
    ? { ...rawActiveChannel, servers: serverOverrides[rawActiveChannel.id] }
    : rawActiveChannel;

  const currentServer =
    activeChannel.servers[serverIndex] || activeChannel.servers[0];
  const currentServerUrl = currentServer?.url || "";

  // Reset server index and 4s cinema reveal gate when switching channel
  useEffect(() => {
    setServerIndex(0);
    setStreamError(false);
    setIsBuffering(true);
    hasStartedPlayingRef.current = false;
  }, [activeChannel.id, showPlayer]);

  // Enforce a forced minimum 4-second cinema loader animation on every channel open / retry
  useEffect(() => {
    if (!showPlayer || !isTabActive) {
      setMinRevealElapsed(false);
      setRevealStage("loading");
      return;
    }
    setMinRevealElapsed(false);
    setRevealStage("loading");
    const timer = window.setTimeout(() => {
      setMinRevealElapsed(true);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [activeChannel.id, showPlayer, isTabActive, retryTick, currentServerUrl]);

  // Trigger the horizontal center-slit curtain reveal only after BOTH 4s elapsed AND stream is ready
  useEffect(() => {
    if (!showPlayer || !isTabActive || streamError) return;
    if (revealStage === "loading" && minRevealElapsed && !isBuffering) {
      setRevealStage("opening");
    }
  }, [showPlayer, isTabActive, streamError, revealStage, minRevealElapsed, isBuffering]);

  useEffect(() => {
    if (revealStage !== "opening") return;
    const doneTimer = window.setTimeout(() => {
      setRevealStage("open");
    }, 620);
    return () => window.clearTimeout(doneTimer);
  }, [revealStage]);

  // Keep video muted while the 4s opening motion & curtain reveal play; unmute only once fully revealed
  useEffect(() => {
    const video = videoEl || videoRef.current;
    if (!video || !showPlayer || !isTabActive) return;
    if (revealStage !== "open") {
      video.muted = true;
      return;
    }
    video.muted = mutedRef.current;
    if (video.paused && !document.hidden) {
      video.play().catch(() => {
        video.muted = true;
        mutedRef.current = true;
        setIsMuted(true);
        video.play().catch(() => {});
      });
    }
  }, [revealStage, showPlayer, isTabActive, videoEl]);

  // Setup ultra-fast HLS stream (compatible with iPhone Home Screen Web App, iOS Safari & Android)
  useEffect(() => {
    if (!showPlayer || !isTabActive) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      return;
    }
    const video = videoEl || videoRef.current;
    if (!video || !currentServerUrl) return;

    clearWaitingTimer();
    setIsBuffering(true);
    setStreamError(false);
    hasStartedPlayingRef.current = false;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isStandalone =
      typeof window !== "undefined" &&
      ((window.navigator as any).standalone === true ||
        window.matchMedia("(display-mode: standalone)").matches);

    const selectionTs = Date.now();
    const buildStreamUrl = () => {
      if (
        currentServerUrl.startsWith("/api/hls-proxy") ||
        currentServerUrl.startsWith("/api/alwan-live") ||
        currentServerUrl.startsWith("/api/ownplus-ucl") ||
        currentServerUrl.startsWith("/live/")
      ) {
        const sep = currentServerUrl.includes("?") ? "&" : "?";
        return `${currentServerUrl}${sep}ts=${selectionTs}&sa=${isStandalone ? "1" : "0"}`;
      }
      return currentServerUrl;
    };

    let streamUrl = buildStreamUrl();

    const startPlay = () => {
      video.muted = revealStageRef.current !== "open" ? true : mutedRef.current;
      video
        .play()
        .then(() => {
          setIsPlaying(true);
        })
        .catch(() => {
          // Autoplay fallback on mobile / PWA: mute and play
          video.muted = true;
          mutedRef.current = true;
          setIsMuted(true);
          video
            .play()
            .then(() => setIsPlaying(true))
            .catch(() => {});
        });
    };

    const canPlayNativeHls = Boolean(video.canPlayType("application/vnd.apple.mpegurl"));
    // Prefer Hls.js (MSE / ManagedMediaSource) for proxied streams, falling back to Native AVPlayer automatically if needed.
    const useNativeHls = canPlayNativeHls && !Hls.isSupported();

    let keepaliveSource: EventSource | null = null;
    if (
      typeof EventSource !== "undefined" &&
      (currentServerUrl.startsWith("/live/") ||
        currentServerUrl.startsWith("/api/hls-proxy") ||
        currentServerUrl.startsWith("/api/alwan-live"))
    ) {
      try {
        keepaliveSource = new EventSource("/api/live-keepalive");
      } catch {}
    }

    // Completely release background tab stream polling when user switches to Home Screen app
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (keepaliveSource) {
          keepaliveSource.close();
          keepaliveSource = null;
        }
        if (hlsRef.current) {
          hlsRef.current.stopLoad();
        } else {
          video.pause();
          video.removeAttribute("src");
          video.load();
        }
        video.pause();
      } else {
        if (
          !keepaliveSource &&
          typeof EventSource !== "undefined" &&
          (currentServerUrl.startsWith("/live/") ||
            currentServerUrl.startsWith("/api/hls-proxy") ||
            currentServerUrl.startsWith("/api/alwan-live"))
        ) {
          try {
            keepaliveSource = new EventSource("/api/live-keepalive");
          } catch {}
        }
        streamUrl = buildStreamUrl();
        if (hlsRef.current) {
          hlsRef.current.loadSource(streamUrl);
          hlsRef.current.startLoad();
          startPlay();
        } else if (canPlayNativeHls) {
          video.src = streamUrl;
          video.load();
          startPlay();
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (!useNativeHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        liveDurationInfinity: true,
        liveSyncDurationCount: 2,
        liveMaxLatencyDurationCount: 8,
        maxLiveSyncPlaybackRate: 1,
        maxBufferLength: 24,
        maxMaxBufferLength: 45,
        backBufferLength: 20,
        maxBufferHole: 0.8,
        highBufferWatchdogPeriod: 2,
        nudgeOffset: 0.25,
        nudgeMaxRetry: 10,
        manifestLoadingTimeOut: 20000,
        manifestLoadingMaxRetry: 12,
        manifestLoadingRetryDelay: 400,
        levelLoadingTimeOut: 20000,
        levelLoadingMaxRetry: 12,
        levelLoadingRetryDelay: 400,
        fragLoadingTimeOut: 25000,
        fragLoadingMaxRetry: 10,
        fragLoadingRetryDelay: 400
      });

      hls.subtitleDisplay = false;
      hlsRef.current = hls;
      hls.loadSource(streamUrl);
      hls.attachMedia(video);

      let networkRecoveryAttempts = 0;
      let mediaRecoveryAttempts = 0;

      const switchToNativeFallback = () => {
        hls.destroy();
        if (hlsRef.current === hls) {
          hlsRef.current = null;
        }
        const nativeUrl = buildStreamUrl();
        const onNativeReady = () => {
          clearWaitingTimer();
          setIsBuffering(false);
          setStreamError(false);
          startPlay();
        };
        video.addEventListener("loadedmetadata", onNativeReady, { once: true });
        video.addEventListener("canplay", onNativeReady, { once: true });
        video.src = nativeUrl;
        video.load();
        startPlay();
      };

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        networkRecoveryAttempts = 0;
        hls.subtitleTrack = -1;
        setStreamError(false);
        startPlay();
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              networkRecoveryAttempts += 1;
              if (
                networkRecoveryAttempts >= 2 &&
                !hasStartedPlayingRef.current &&
                canPlayNativeHls
              ) {
                switchToNativeFallback();
              } else if (
                networkRecoveryAttempts >= 4 &&
                !hasStartedPlayingRef.current &&
                serverIndex + 1 < activeChannel.servers.length
              ) {
                setServerIndex((prev) => prev + 1);
              } else {
                setTimeout(() => {
                  if (hlsRef.current === hls) {
                    hls.startLoad();
                  }
                }, 600);
              }
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              if (mediaRecoveryAttempts < 4) {
                mediaRecoveryAttempts += 1;
                hls.recoverMediaError();
              } else if (canPlayNativeHls) {
                switchToNativeFallback();
              } else {
                setIsBuffering(false);
                setStreamError(true);
              }
              break;
            default:
              if (serverIndex + 1 < activeChannel.servers.length && !hasStartedPlayingRef.current) {
                setServerIndex((prev) => prev + 1);
              } else if (canPlayNativeHls) {
                switchToNativeFallback();
              } else {
                setIsBuffering(false);
                setStreamError(true);
              }
              break;
          }
        }
      });

      return () => {
        if (keepaliveSource) {
          keepaliveSource.close();
          keepaliveSource = null;
        }
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        clearWaitingTimer();
        hls.destroy();
        if (hlsRef.current === hls) {
          hlsRef.current = null;
        }
      };
    } else if (canPlayNativeHls) {
      const handleInitialLoaded = () => {
        clearWaitingTimer();
        setIsBuffering(false);
        setStreamError(false);
        startPlay();
      };

      const handleCanPlay = () => {
        clearWaitingTimer();
        setIsBuffering(false);
        setStreamError(false);
        nativeRetryCount = 0;
        if (video.paused && !document.hidden) {
          video.play().catch(() => {});
        }
      };

      let nativeRetryCount = 0;
      const handleError = () => {
        if (nativeRetryCount < 6) {
          nativeRetryCount += 1;
          setTimeout(() => {
            if (!videoRef.current || document.hidden) return;
            streamUrl = buildStreamUrl();
            video.src = streamUrl;
            video.load();
            startPlay();
          }, 800);
          return;
        }
        setIsBuffering(false);
        setStreamError(true);
      };

      // Native AVPlayer stall recovery watchdog if playback time stops advancing for >5.5s
      let lastVideoTime = -1;
      let stuckTicks = 0;
      const nativeWatchdog = window.setInterval(() => {
        if (document.hidden || video.paused || !hasStartedPlayingRef.current) {
          stuckTicks = 0;
          return;
        }
        if (Math.abs(video.currentTime - lastVideoTime) < 0.05) {
          stuckTicks += 1;
          if (stuckTicks >= 4) {
            stuckTicks = 0;
            streamUrl = buildStreamUrl();
            video.src = streamUrl;
            video.load();
            startPlay();
          }
        } else {
          lastVideoTime = video.currentTime;
          stuckTicks = 0;
        }
      }, 1500);

      video.addEventListener("loadedmetadata", handleInitialLoaded, { once: true });
      video.addEventListener("canplay", handleCanPlay);
      video.addEventListener("error", handleError);
      video.src = streamUrl;
      video.load();
      startPlay();

      return () => {
        if (keepaliveSource) {
          keepaliveSource.close();
          keepaliveSource = null;
        }
        window.clearInterval(nativeWatchdog);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
        clearWaitingTimer();
        video.removeEventListener("loadedmetadata", handleInitialLoaded);
        video.removeEventListener("canplay", handleCanPlay);
        video.removeEventListener("error", handleError);
        video.removeAttribute("src");
        video.load();
      };
    }

    return () => {
      if (keepaliveSource) {
        keepaliveSource.close();
        keepaliveSource = null;
      }
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [activeChannel.id, currentServerUrl, retryTick, showPlayer, isTabActive, videoEl]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleFullscreen = () => {
    const container = playerContainerRef.current;
    const video = videoRef.current as HTMLVideoElement & {
      webkitEnterFullscreen?: () => void;
      webkitRequestFullscreen?: () => Promise<void>;
    };
    if (!container) return;

    const doc = document as Document & {
      webkitFullscreenElement?: Element | null;
      webkitExitFullscreen?: () => Promise<void>;
    };

    if (document.fullscreenElement || doc.webkitFullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (doc.webkitExitFullscreen) {
        doc.webkitExitFullscreen();
      }
      return;
    }

    if (video?.webkitEnterFullscreen && /iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      video.webkitEnterFullscreen();
    } else if (container.requestFullscreen) {
      container.requestFullscreen().catch(() => {
        if (video?.webkitEnterFullscreen) video.webkitEnterFullscreen();
      });
    } else if ((container as any).webkitRequestFullscreen) {
      try {
        (container as any).webkitRequestFullscreen();
      } catch {
        if (video?.webkitEnterFullscreen) video.webkitEnterFullscreen();
      }
    } else if (video?.webkitEnterFullscreen) {
      video.webkitEnterFullscreen();
    }
  };

  const handlePiP = async () => {
    const video = videoRef.current;
    if (!video) return;
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (document.pictureInPictureEnabled) {
        await video.requestPictureInPicture();
      }
    } catch {}
  };

  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});

  const toggleCategoryExpand = (catId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [catId]: !prev[catId]
    }));
  };

  const categorySections: {
    id: Exclude<ChannelCategory, "all">;
    labelKu: string;
    labelEn: string;
  }[] = [
    { id: "news", labelKu: "هەواڵ", labelEn: "News" },
    { id: "sports", labelKu: "وەرزشی", labelEn: "Sports" },
    { id: "general", labelKu: "گشتی و خێزانی", labelEn: "General & Family" },
    { id: "local", labelKu: "کەناڵە ناوخۆییەکان", labelEn: "Local Channels" },
    { id: "religious", labelKu: "ئایینی", labelEn: "Religious" },
    { id: "kids", labelKu: "منداڵان", labelEn: "Kids" },
    { id: "culture", labelKu: "کلتوری و موزیک", labelEn: "Culture & Music" }
  ];

  const effectiveSearchQuery = externalSearchQuery.trim() || searchQuery.trim();

  const filteredChannels = KURDISH_CHANNELS.filter((channel) => {
    if (onlyFavorites && !favorites.includes(channel.id)) return false;
    if (activeCategory !== "all") {
      if (activeCategory === "local") {
        if (!channel.isLocal && channel.category !== "local") return false;
      } else if (channel.category !== activeCategory) {
        return false;
      }
    }
    if (!effectiveSearchQuery) return true;
    const q = effectiveSearchQuery.toLowerCase();
    return (
      channel.nameKu.toLowerCase().includes(q) ||
      channel.nameEn.toLowerCase().includes(q) ||
      channel.cityKu.toLowerCase().includes(q) ||
      channel.cityEn.toLowerCase().includes(q) ||
      channel.categoryLabelKu.toLowerCase().includes(q) ||
      channel.categoryLabelEn.toLowerCase().includes(q)
    );
  });

  const handleExitPlayer = useCallback(() => {
    setWatchingChannelId(null);
    const savedY = listScrollRef.current || 0;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: savedY, behavior: "auto" });
    });
  }, []);

  useEffect(() => {
    if (popToRootTick !== prevPopTickRef.current) {
      prevPopTickRef.current = popToRootTick;
      if (watchingChannelId) {
        viaSwipeRef.current = false;
        handleExitPlayer();
      }
    }
  }, [popToRootTick, watchingChannelId, handleExitPlayer]);

  const lastOpenReqTickRef = useRef<number>(0);
  useEffect(() => {
    if (openChannelRequest && openChannelRequest.tick !== lastOpenReqTickRef.current) {
      lastOpenReqTickRef.current = openChannelRequest.tick;
      viaSwipeRef.current = false;
      setWatchingChannelId(openChannelRequest.id);
      window.scrollTo({ top: 0, behavior: "auto" });
    }
  }, [openChannelRequest]);

  const handleSelectChannelCard = (channel: KurdishChannel) => {
    const now = Date.now();
    if (now - lastSelectTimeRef.current < 250 && watchingChannelId === channel.id) {
      return;
    }
    lastSelectTimeRef.current = now;
    if (!watchingChannelId) {
      listScrollRef.current = window.scrollY || 0;
    }
    viaSwipeRef.current = false;
    setWatchingChannelId(channel.id);
    onSelectChannel(channel.id);
    window.scrollTo({ top: 0, behavior: "auto" });
  };

  const isSearching = Boolean(effectiveSearchQuery);

  // Build ordered list for instant Prev/Next channel zapping inside the player
  const zapList = (() => {
    if (filteredChannels.length > 1 && filteredChannels.some((c) => c.id === activeChannel.id)) {
      return filteredChannels;
    }
    const sameCat = KURDISH_CHANNELS.filter((c) => c.category === activeChannel.category);
    return sameCat.length > 1 ? sameCat : KURDISH_CHANNELS;
  })();
  const currentZapIndex = Math.max(
    0,
    zapList.findIndex((c) => c.id === activeChannel.id)
  );
  const prevChannel =
    zapList.length > 1
      ? zapList[(currentZapIndex - 1 + zapList.length) % zapList.length]
      : null;
  const nextChannel =
    zapList.length > 1 ? zapList[(currentZapIndex + 1) % zapList.length] : null;

  const handleZapChannel = useCallback(
    (direction: "prev" | "next") => {
      const target = direction === "prev" ? prevChannel : nextChannel;
      if (!target) return;
      viaSwipeRef.current = false;
      setWatchingChannelId(target.id);
      onSelectChannel(target.id);
      setControlsVisible(true);
    },
    [prevChannel, nextChannel, onSelectChannel]
  );

  // Keyboard support for channel zapping while watching
  useEffect(() => {
    if (!showPlayer || !isTabActive) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") {
        handleZapChannel(isRtl ? "prev" : "next");
      } else if (e.key === "ArrowLeft") {
        handleZapChannel(isRtl ? "next" : "prev");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showPlayer, isTabActive, isRtl, handleZapChannel]);

  // 🎬 Dedicated Inner Channel Watch View + Native iOS Page Push/Pop Transition + Edge Swipe Back
  return (
    <div className="relative w-full overflow-x-clip">
    <AnimatePresence initial={false} mode="popLayout" custom={viaSwipeRef.current}>
      {showPlayer ? (() => {
        const relatedChannels = KURDISH_CHANNELS.filter(
          (c) => c.category === activeChannel.category && c.id !== activeChannel.id
        ).slice(0, 6);

        return (
          <motion.div
            key="watch-player-screen"
            custom={viaSwipeRef.current}
            transformTemplate={clearZeroTransform}
            initial={{ x: pushInX, opacity: 1 }}
            animate={{
              x: 0,
              opacity: 1,
              transition: { duration: 0.38, ease: iosPageEase }
            }}
            exit={(wasSwiped: boolean) =>
              wasSwiped
                ? { opacity: 0, transition: { duration: 0.01 } }
                : { x: pushInX, opacity: 0, transition: { duration: 0.34, ease: iosPageEase } }
            }
            className="tab-view w-full"
          >
          <EdgeSwipeBack
            onBeforeSwipePop={() => {
              viaSwipeRef.current = true;
            }}
            onBack={handleExitPlayer}
          >
          <div className="flex flex-col gap-3.5 pb-28">
        {/* Top Back Button & Quick Channel Switcher Row */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              viaSwipeRef.current = false;
              handleExitPlayer();
            }}
            className="px-4 py-2.5 rounded-2xl glass-card border border-white/70 dark:border-white/10 text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer hover:opacity-90 active:scale-95 transition-all kurdish-bold shrink-0"
          >
            {lang === "ku" ? (
              <ArrowRight className="w-4 h-4" />
            ) : (
              <ArrowLeft className="w-4 h-4" />
            )}
            <span>{lang === "ku" ? "گەڕانەوە" : "Back"}</span>
          </button>

          {prevChannel && nextChannel && (
            <div className="flex items-center gap-1.5 min-w-0">
              <button
                type="button"
                onClick={() => handleZapChannel("prev")}
                title={lang === "ku" ? `پێشوو: ${prevChannel.nameKu}` : `Previous: ${prevChannel.nameEn}`}
                className="px-3 py-2.5 rounded-2xl glass-card border border-white/70 dark:border-white/10 text-slate-800 dark:text-slate-100 text-xs font-bold flex items-center gap-1 cursor-pointer hover:opacity-90 active:scale-95 transition-all"
              >
                {isRtl ? <ChevronRight className="w-4 h-4 shrink-0" /> : <ChevronLeft className="w-4 h-4 shrink-0" />}
                <span className="hidden sm:inline max-w-[96px] truncate">
                  {lang === "ku" ? prevChannel.nameKu : prevChannel.nameEn}
                </span>
                <span className="sm:hidden">{lang === "ku" ? "پێشوو" : "Prev"}</span>
              </button>

              <button
                type="button"
                onClick={() => handleZapChannel("next")}
                title={lang === "ku" ? `داهاتوو: ${nextChannel.nameKu}` : `Next: ${nextChannel.nameEn}`}
                className="px-3 py-2.5 rounded-2xl glass-card border border-white/70 dark:border-white/10 text-slate-800 dark:text-slate-100 text-xs font-bold flex items-center gap-1 cursor-pointer hover:opacity-90 active:scale-95 transition-all"
              >
                <span className="hidden sm:inline max-w-[96px] truncate">
                  {lang === "ku" ? nextChannel.nameKu : nextChannel.nameEn}
                </span>
                <span className="sm:hidden">{lang === "ku" ? "داهاتوو" : "Next"}</span>
                {isRtl ? <ChevronLeft className="w-4 h-4 shrink-0" /> : <ChevronRight className="w-4 h-4 shrink-0" />}
              </button>
            </div>
          )}
        </div>

        {/* 📺 Live Stream Player Glass Card */}
        <section className="glass-card rounded-3xl p-3.5 sm:p-5 shadow-md border border-white/70 dark:border-white/10 flex flex-col gap-3.5">
        {/* Top Channel Bar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={`w-12 h-12 rounded-2xl shadow-sm border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-center shrink-0 overflow-hidden ${
                activeChannel.id.startsWith("alwansport") ||
                activeChannel.id === "fifaplus" ||
                activeChannel.id === "kurdmaxshow" ||
                activeChannel.id === "nrtsport" ||
                activeChannel.id === "starzplay1" ||
                activeChannel.id === "starzplay2"
                  ? "bg-[#0f172a] p-0"
                  : activeChannel.id === "newline1" ||
                    activeChannel.id === "newline2"
                  ? "bg-[#4b0060] p-0.5"
                  : activeChannel.id === "basktv"
                  ? "bg-[#09081b] p-0"
                  : activeChannel.id === "osnyahala" ||
                    activeChannel.id === "osnmoviesaction"
                  ? "bg-[#e51000] p-0"
                  : activeChannel.id === "thmanyah1" ||
                    activeChannel.id === "thmanyah2"
                  ? "bg-[#f23d13] p-0"
                  : activeChannel.id === "majd"
                  ? "bg-[#de2a28] p-0"
                  : activeChannel.id === "kurdmaxpepule"
                  ? "bg-[#bfe0f3] p-0"
                  : activeChannel.id === "boomerang"
                  ? "bg-[#1e1e20] p-1.5"
                  : activeChannel.id === "mbc3" ||
                    activeChannel.id === "cnarabia" ||
                    activeChannel.id === "cnn" ||
                    activeChannel.id === "acemovie"
                  ? "bg-white p-0"
                  : activeChannel.id === "makkahquran" ||
                    activeChannel.id === "madinahsunnah"
                  ? "bg-white dark:bg-slate-800 p-2"
                  : "bg-white dark:bg-slate-800 p-1.5"
              }`}
            >
              <img
                src={activeChannel.logo}
                alt={activeChannel.nameKu}
                decoding="async"
                referrerPolicy="no-referrer"
                onError={(e) => handleChannelLogoError(e, activeChannel)}
                className={`w-full h-full ${
                  activeChannel.id === "makkahquran" ||
                  activeChannel.id === "madinahsunnah"
                    ? "rounded-none object-contain"
                    : activeChannel.id === "fifaplus" ||
                      activeChannel.id.startsWith("alwansport") ||
                      activeChannel.id === "kurdmaxshow" ||
                      activeChannel.id === "nrtsport" ||
                      activeChannel.id === "starzplay1" ||
                      activeChannel.id === "starzplay2" ||
                      activeChannel.id === "basktv" ||
                      activeChannel.id === "mbc3" ||
                      activeChannel.id === "cnarabia" ||
                      activeChannel.id === "cnn" ||
                      activeChannel.id === "acemovie" ||
                      activeChannel.id === "osnmoviesaction" ||
                      activeChannel.id === "osnyahala" ||
                      activeChannel.id === "thmanyah1" ||
                      activeChannel.id === "thmanyah2" ||
                      activeChannel.id === "kurdmaxpepule" ||
                      activeChannel.id === "majd"
                    ? "rounded-xl object-cover"
                    : "rounded-xl object-contain"
                }`}
              />
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 truncate kurdish-bold">
                  <span
                    dir={activeChannel.id === "ownplus" ? "ltr" : undefined}
                    style={activeChannel.id === "ownplus" ? { unicodeBidi: "isolate" } : undefined}
                    className={activeChannel.id === "ownplus" ? "inline-block" : undefined}
                  >
                    {lang === "ku" ? activeChannel.nameKu : activeChannel.nameEn}
                  </span>
                </h2>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => onToggleFavorite(activeChannel.id)}
              className={`p-2.5 rounded-2xl border transition-all cursor-pointer ${
                favorites.includes(activeChannel.id)
                  ? "bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400"
                  : "bg-white/50 dark:bg-slate-800/50 border-slate-200/60 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 hover:text-rose-500"
              }`}
              title={lang === "ku" ? "زیادکردن بۆ دڵخوازەکان" : "Toggle Favorite"}
            >
              <Heart
                className={`w-5 h-5 ${favorites.includes(activeChannel.id) ? "fill-current" : ""}`}
              />
            </button>
          </div>
        </div>

        {/* Video Container */}
        <div
          ref={playerContainerRef}
          onMouseMove={() => {
            if (revealStage === "open" && !streamError) {
              revealControls(true);
            }
          }}
          onMouseLeave={() => {
            if (revealStage === "open" && isPlaying && !streamError) {
              clearControlsTimer();
              setControlsVisible(false);
            }
          }}
          onClick={() => {
            if (revealStage !== "open" || streamError) return;
            if (controlsVisible && isPlaying) {
              clearControlsTimer();
              setControlsVisible(false);
            } else {
              revealControls(true);
            }
          }}
          className={`relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-950 shadow-inner border border-slate-800/60 select-none ${
            revealStage === "open" && !controlsVisible ? "cursor-none" : "cursor-pointer"
          }`}
        >
          <video
            ref={attachVideoRef}
            className="w-full h-full object-contain bg-black"
            playsInline
            autoPlay
            disableRemotePlayback
            controls={false}
            onContextMenu={(e) => e.preventDefault()}
            onPlaying={() => {
              clearWaitingTimer();
              hasStartedPlayingRef.current = true;
              setIsBuffering(false);
              setIsPlaying(true);
              setStreamError(false);
            }}
            onTimeUpdate={() => {
              clearWaitingTimer();
              hasStartedPlayingRef.current = true;
              if (isBuffering) setIsBuffering(false);
            }}
            onStalled={() => {
              const v = videoRef.current;
              if (hlsRef.current && !document.hidden) {
                hlsRef.current.startLoad();
              }
              if (v && !document.hidden && v.paused) {
                v.play().catch(() => {});
              }
            }}
            onWaiting={() => {
              clearWaitingTimer();
              if (hasStartedPlayingRef.current) {
                waitingTimerRef.current = window.setTimeout(() => {
                  const v = videoRef.current;
                  if (hlsRef.current && !document.hidden) {
                    hlsRef.current.startLoad();
                  }
                  if (v && !document.hidden && v.paused) {
                    v.play().catch(() => {});
                  }
                }, 1000);
                return;
              }
            }}
            onPause={() => setIsPlaying(false)}
            onPlay={() => setIsPlaying(true)}
          />

          {/* Forced 4-Second Edge-to-Edge Luminous Beam Loader + Center-Slit Curtain Reveal */}
          {revealStage !== "open" && !streamError && (
            <div
              key={`intro-${activeChannel.id}-${retryTick}-${currentServerUrl}`}
              className="absolute inset-0 z-20 overflow-hidden pointer-events-none select-none"
            >
              {/* Top Black Curtain */}
              <motion.div
                initial={{ y: "0%" }}
                animate={{ y: revealStage === "opening" ? "-106%" : "0%" }}
                transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
                className="absolute top-0 inset-x-0 h-1/2 bg-[#030408] shadow-[0_14px_30px_rgba(3,4,8,0.92)] will-change-transform"
              />

              {/* Bottom Black Curtain */}
              <motion.div
                initial={{ y: "0%" }}
                animate={{ y: revealStage === "opening" ? "106%" : "0%" }}
                transition={{ duration: 0.58, ease: [0.22, 1, 0.36, 1] }}
                className="absolute bottom-0 inset-x-0 h-1/2 bg-[#030408] shadow-[0_-14px_30px_rgba(3,4,8,0.92)] will-change-transform"
              />

              {/* Soft Center Atmospheric Glow Halo */}
              <motion.div
                initial={{ opacity: 0.1, scaleX: 0.3 }}
                animate={
                  revealStage === "opening"
                    ? { opacity: 0, scaleY: 1.5, scaleX: 1 }
                    : { opacity: [0.16, 0.32, 0.22], scaleX: 1 }
                }
                transition={
                  revealStage === "opening"
                    ? { duration: 0.45, ease: "easeOut" }
                    : { duration: 3.9, ease: [0.22, 0.61, 0.36, 1] }
                }
                className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-10 bg-gradient-to-r from-sky-400/10 via-indigo-300/15 to-sky-400/10 blur-xl will-change-transform"
              />

              {/* Edge-to-Edge Horizontal Luminous Progress Beam */}
              <motion.div
                initial={{ opacity: 0.85 }}
                animate={{ opacity: revealStage === "opening" ? 0 : 1 }}
                transition={{
                  duration: revealStage === "opening" ? 0.44 : 0.25,
                  delay: revealStage === "opening" ? 0.14 : 0,
                  ease: "easeOut"
                }}
                className="absolute inset-x-0 top-1/2 -translate-y-1/2 flex items-center justify-center"
              >
                <div className="relative w-full h-[1px] flex items-center justify-center">
                  {/* Subtle full-width baseline rail */}
                  <div
                    className={`w-full h-[1px] bg-white/[0.04] transition-opacity duration-200 ${
                      revealStage === "opening" ? "opacity-0" : "opacity-100"
                    }`}
                  />
                  {/* Soft luminous halo beam */}
                  <motion.div
                    initial={{ scaleX: 0.08 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 3.95, ease: [0.22, 0.61, 0.36, 1] }}
                    className="absolute -inset-y-[1px] inset-x-0 origin-center bg-gradient-to-r from-sky-300/35 via-white/50 to-sky-300/35 blur-[2.5px] opacity-55 will-change-transform"
                  />
                  {/* Subtle core beam reaching the frame edges */}
                  <motion.div
                    initial={{ scaleX: 0.08 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 3.95, ease: [0.22, 0.61, 0.36, 1] }}
                    className="absolute inset-0 origin-center bg-gradient-to-r from-sky-200/45 via-white/75 to-sky-200/45 shadow-[0_0_8px_1px_rgba(125,211,252,0.32),0_0_3px_rgba(255,255,255,0.45)] will-change-transform"
                  />
                </div>
              </motion.div>
            </div>
          )}

          {/* Post-Reveal Mid-Stream Re-Buffering Indicator */}
          <AnimatePresence>
            {revealStage === "open" && isBuffering && !streamError && (
              <motion.div
                key="channel-wait-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.22, ease: "easeInOut" }}
                className="absolute inset-0 z-20 bg-slate-950/65 backdrop-blur-xs flex items-center justify-center text-white pointer-events-none select-none"
              >
                <motion.span
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: [0.4, 1, 0.4], y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{
                    opacity: { duration: 1.3, repeat: Infinity, ease: "easeInOut" },
                    y: { duration: 0.2, ease: "easeOut" }
                  }}
                  className="text-xs sm:text-sm font-bold text-white kurdish-bold"
                >
                  {lang === "ku" ? "چاوەڕوان بە" : "Please wait"}
                </motion.span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Error / Retry Overlay */}
          {streamError && (
            <div className="absolute inset-0 z-30 bg-slate-950/85 backdrop-blur-sm flex flex-col items-center justify-center gap-3 p-4 text-center text-white">
              <Tv className="w-9 h-9 text-blue-400 opacity-80" />
              <p className="text-xs sm:text-sm font-bold text-slate-200">
                {lang === "ku"
                  ? "پەخشی ئەم کەناڵە لە ئێستادا وەستاوە، تکایە دووبارە هەوڵبدەرەوە"
                  : "Stream temporarily unavailable, please retry"}
              </p>
              <button
                onClick={() => setRetryTick((t) => t + 1)}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                {lang === "ku" ? "نوێکردنەوەی پەخش" : "Reload Stream"}
              </button>
            </div>
          )}

          {/* Auto-Hiding Top Channel Info Overlay inside Video (great for Fullscreen zapping) */}
          <div
            onClick={(e) => e.stopPropagation()}
            className={`absolute top-0 inset-x-0 z-10 px-3 pt-2.5 pb-6 bg-gradient-to-b from-black/80 via-black/35 to-transparent flex items-center justify-between gap-2 transition-all duration-300 ${
              revealStage === "open" && controlsVisible && !streamError
                ? "opacity-100 translate-y-0"
                : "opacity-0 -translate-y-2 pointer-events-none"
            }`}
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs sm:text-sm font-black text-white drop-shadow truncate kurdish-bold">
                {lang === "ku" ? activeChannel.nameKu : activeChannel.nameEn}
              </span>
            </div>

            {zapList.length > 1 && (
              <span
                dir="ltr"
                className="text-[10px] font-bold text-white/80 bg-white/10 backdrop-blur-md px-2 py-0.5 rounded-full shrink-0"
              >
                {currentZapIndex + 1} / {zapList.length}
              </span>
            )}
          </div>

          {/* Auto-Hiding Floating Control Bar inside Video */}
          <div
            onClick={(e) => {
              e.stopPropagation();
              revealControls(true);
            }}
            className={`absolute bottom-0 inset-x-0 z-10 p-2.5 sm:p-3 bg-gradient-to-t from-black/85 via-black/45 to-transparent flex items-center justify-between gap-2 transition-all duration-300 ${
              revealStage === "open" && controlsVisible && !streamError
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-2 pointer-events-none"
            }`}
          >
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  togglePlay();
                  revealControls(true);
                }}
                className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white backdrop-blur-md transition-all cursor-pointer active:scale-95"
                title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  toggleMute();
                  revealControls(true);
                }}
                className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white backdrop-blur-md transition-all cursor-pointer active:scale-95"
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? (
                  <VolumeX className="w-4 h-4 text-rose-400" />
                ) : (
                  <Volume2 className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setRetryTick((t) => t + 1);
                  revealControls(true);
                }}
                className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white backdrop-blur-md transition-all cursor-pointer active:scale-95"
                title={lang === "ku" ? "نوێکردنەوەی پەخش" : "Reload Stream"}
              >
                <RefreshCw className="w-4 h-4" />
              </button>

              {/* In-Player Channel Zapping (Prev / Next) */}
              {prevChannel && nextChannel && (
                <div
                  dir="ltr"
                  className="flex items-center gap-1 bg-white/10 backdrop-blur-md rounded-xl p-0.5 border border-white/10"
                >
                  <button
                    type="button"
                    onClick={() => handleZapChannel("prev")}
                    className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-all cursor-pointer active:scale-95"
                    title={lang === "ku" ? `کەناڵی پێشوو: ${prevChannel.nameKu}` : `Previous: ${prevChannel.nameEn}`}
                  >
                    <SkipBack className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleZapChannel("next")}
                    className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-all cursor-pointer active:scale-95"
                    title={lang === "ku" ? `کەناڵی داهاتوو: ${nextChannel.nameKu}` : `Next: ${nextChannel.nameEn}`}
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  handlePiP();
                  revealControls(true);
                }}
                className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white backdrop-blur-md transition-all cursor-pointer active:scale-95"
                title={lang === "ku" ? "پەنجەرەی بچووک" : "Picture in Picture"}
              >
                <PictureInPicture2 className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  handleFullscreen();
                  revealControls(true);
                }}
                className="p-2 rounded-xl bg-white/15 hover:bg-white/25 text-white backdrop-blur-md transition-all cursor-pointer active:scale-95"
                title={lang === "ku" ? "پڕکردنی شاشە" : "Fullscreen"}
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
        </section>

        {/* کەناڵە هاوشێوەکان لە ناو تابی پەخش */}
        {relatedChannels.length > 0 && (
          <motion.section
            initial={{ opacity: 0.75, x: isRtl ? -16 : 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.2, ease: iosPageEase }}
            className="flex flex-col gap-3 mt-1"
          >
            <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white px-1 kurdish-bold">
              {lang === "ku" ? "کەناڵەکانی دیکەی ئەم بەشە" : "More in this category"}
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
              {relatedChannels.map((ch, idx) => (
                <motion.div
                  key={ch.id}
                  initial={{ opacity: 0.7, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileTap={{ scale: 0.95 }}
                  transition={{
                    duration: 0.17,
                    delay: Math.min(idx * 0.015, 0.075),
                    ease: iosPageEase
                  }}
                  onClick={() => handleSelectChannelCard(ch)}
                  className="glass-card rounded-2xl px-1.5 py-2.5 sm:p-2.5 transition-all cursor-pointer flex flex-col items-center text-center gap-1.5 border border-white/70 dark:border-white/10 select-none touch-manipulation"
                >
                  <div
                    className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl shadow-xs border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-center overflow-hidden pointer-events-none ${
                      ch.id.startsWith("alwansport") ||
                      ch.id === "fifaplus" ||
                      ch.id === "kurdmaxshow" ||
                      ch.id === "nrtsport" ||
                      ch.id === "starzplay1" ||
                      ch.id === "starzplay2"
                        ? "bg-[#0f172a] p-0"
                        : ch.id === "newline1" ||
                          ch.id === "newline2"
                        ? "bg-[#4b0060] p-0.5"
                        : ch.id === "basktv"
                        ? "bg-[#09081b] p-0"
                        : ch.id === "osnyahala" ||
                          ch.id === "osnmoviesaction"
                        ? "bg-[#e51000] p-0"
                        : ch.id === "thmanyah1" ||
                          ch.id === "thmanyah2"
                        ? "bg-[#f23d13] p-0"
                        : ch.id === "majd"
                        ? "bg-[#de2a28] p-0"
                        : ch.id === "kurdmaxpepule"
                        ? "bg-[#bfe0f3] p-0"
                        : ch.id === "boomerang"
                        ? "bg-[#1e1e20] p-1.5"
                        : ch.id === "mbc3" ||
                          ch.id === "cnarabia" ||
                          ch.id === "cnn" ||
                          ch.id === "acemovie"
                        ? "bg-white p-0"
                        : ch.id === "makkahquran" ||
                          ch.id === "madinahsunnah"
                        ? "bg-white dark:bg-slate-800/90 p-2"
                        : "bg-white dark:bg-slate-800/90 p-1.5"
                    }`}
                  >
                    <img
                      src={ch.logo}
                      alt={ch.nameKu}
                      loading="eager"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      onError={(e) => handleChannelLogoError(e, ch)}
                      className={`w-full h-full ${
                        ch.id === "makkahquran" ||
                        ch.id === "madinahsunnah"
                          ? "rounded-none object-contain"
                          : ch.id === "fifaplus" ||
                            ch.id.startsWith("alwansport") ||
                            ch.id === "kurdmaxshow" ||
                            ch.id === "nrtsport" ||
                            ch.id === "starzplay1" ||
                            ch.id === "starzplay2" ||
                            ch.id === "basktv" ||
                            ch.id === "mbc3" ||
                            ch.id === "cnarabia" ||
                            ch.id === "cnn" ||
                            ch.id === "acemovie" ||
                            ch.id === "osnmoviesaction" ||
                            ch.id === "osnyahala" ||
                            ch.id === "thmanyah1" ||
                            ch.id === "thmanyah2" ||
                            ch.id === "kurdmaxpepule" ||
                            ch.id === "majd"
                          ? "rounded-xl object-cover"
                          : "rounded-xl object-contain"
                      }`}
                    />
                  </div>
                  <h4 className="channel-card-title text-slate-900 dark:text-slate-100 truncate w-full px-0.5 pointer-events-none">
                    <span
                      dir={ch.id === "ownplus" ? "ltr" : undefined}
                      style={ch.id === "ownplus" ? { unicodeBidi: "isolate" } : undefined}
                      className={ch.id === "ownplus" ? "inline-block" : undefined}
                    >
                      {lang === "ku" ? ch.nameKu : ch.nameEn}
                    </span>
                  </h4>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}
          </div>
          </EdgeSwipeBack>
          </motion.div>
        );
      })() : (
        <motion.div
          key="channels-list-view"
          transformTemplate={clearZeroTransform}
          initial={{ x: parentShiftX, opacity: 0.6 }}
          animate={{
            x: 0,
            opacity: 1,
            transition: { duration: 0.38, ease: iosPageEase }
          }}
          exit={{
            x: parentShiftX,
            opacity: 0,
            transition: { duration: 0.34, ease: iosPageEase }
          }}
          className="tab-view flex flex-col gap-5 pb-28"
        >
      {/* 📡 Categorized Channels List (3 per category by default + "زیاتر ببینە" View All toggle) */}
      <motion.div
        key={`cat-${activeCategory}-${isSearching ? "search" : "browse"}`}
        transformTemplate={clearZeroTransform}
        initial={{ opacity: 0.75, x: isRtl ? -26 : 26 }}
        animate={{
          opacity: 1,
          x: 0,
          transition: { duration: 0.34, ease: iosPageEase }
        }}
      >
      {filteredChannels.length === 0 ? (
        <section className="glass-card rounded-3xl p-8 text-center border border-white/60 dark:border-white/10 flex flex-col items-center justify-center gap-2">
          <Radio className="w-8 h-8 text-slate-400" />
          <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
            {onlyFavorites
              ? lang === "ku"
                ? "هیچ کەناڵێکت لە بەشی دڵخوازەکان زیاد نەکردووە"
                : "No favorite channels saved yet"
              : lang === "ku"
              ? "هیچ کەناڵێک بەم ناوە نەدۆزرایەوە"
              : "No channels found"}
          </p>
        </section>
      ) : (
        <div className="flex flex-col gap-6">
          {categorySections.map((section, sectionIdx) => {
            const sectionChannels = filteredChannels.filter((c) => c.category === section.id);
            if (sectionChannels.length === 0) return null;

            const isExpanded =
              Boolean(expandedCategories[section.id]) ||
              isSearching ||
              activeCategory !== "all";
            const visibleChannels = isExpanded ? sectionChannels : sectionChannels.slice(0, 3);
            const hasMore = sectionChannels.length > 3 && !isSearching && activeCategory === "all";

            return (
              <React.Fragment key={section.id}>
              <section
                className="flex flex-col gap-3"
              >
                {/* Category Header Row (like "News" ... "+ View all" / "+ زیاتر ببینە") */}
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white kurdish-bold">
                    {lang === "ku" ? section.labelKu : section.labelEn}
                  </h3>

                  {hasMore && (
                    <button
                      type="button"
                      onClick={() => toggleCategoryExpand(section.id)}
                      className="text-xs sm:text-sm font-bold text-rose-500 dark:text-rose-400 hover:text-rose-600 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <span>{isExpanded ? "−" : "+"}</span>
                      <span>
                        {lang === "ku"
                          ? isExpanded
                            ? "کەمتر ببینە"
                            : "زیاتر ببینە"
                          : isExpanded
                          ? "Show less"
                          : "View all"}
                      </span>
                    </button>
                  )}
                </div>

                {/* 3-Column Channel Cards Row / Grid */}
                <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
                  <AnimatePresence initial={false}>
                  {visibleChannels.map((channel, idx) => {
                    const isSelected = showPlayer && channel.id === activeChannel.id;
                    const isExtraChannel = idx >= 3;

                    return (
                      <motion.div
                        key={channel.id}
                        transformTemplate={clearZeroTransform}
                        initial={
                          isExtraChannel
                            ? { opacity: 0, y: 8 }
                            : false
                        }
                        animate={{
                          opacity: 1,
                          y: 0,
                          transition: {
                            duration: 0.16,
                            delay: isExtraChannel
                              ? Math.min((idx - 3) * 0.012, 0.048)
                              : 0,
                            ease: iosPageEase
                          }
                        }}
                        whileTap={{ scale: 0.96, transition: { duration: 0.08 } }}
                        onClick={() => handleSelectChannelCard(channel)}
                        className={`channel-glass-card rounded-2xl sm:rounded-3xl px-2 py-3 sm:p-3.5 transition-colors cursor-pointer relative flex flex-col items-center text-center gap-2 border select-none touch-manipulation ${
                          isSelected
                            ? "ring-2 ring-blue-500 border-blue-500/60 bg-blue-500/10 dark:bg-blue-500/15 shadow-md"
                            : "border-white/70 dark:border-white/10"
                        }`}
                      >
                        {/* Official Channel Logo Box */}
                        <div
                          className={`w-[74px] h-[74px] sm:w-[86px] sm:h-[86px] rounded-[20px] shadow-xs border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-center overflow-hidden pointer-events-none ${
                            channel.id.startsWith("alwansport") ||
                            channel.id === "fifaplus" ||
                            channel.id === "kurdmaxshow" ||
                            channel.id === "nrtsport" ||
                            channel.id === "starzplay1" ||
                            channel.id === "starzplay2"
                              ? "bg-[#0f172a] p-0"
                              : channel.id === "newline1" ||
                                channel.id === "newline2"
                              ? "bg-[#4b0060] p-0.5"
                              : channel.id === "basktv"
                              ? "bg-[#09081b] p-0"
                              : channel.id === "osnyahala" ||
                                channel.id === "osnmoviesaction"
                              ? "bg-[#e51000] p-0"
                              : channel.id === "thmanyah1" ||
                                channel.id === "thmanyah2"
                              ? "bg-[#f23d13] p-0"
                              : channel.id === "majd"
                              ? "bg-[#de2a28] p-0"
                              : channel.id === "kurdmaxpepule"
                              ? "bg-[#bfe0f3] p-0"
                              : channel.id === "boomerang"
                              ? "bg-[#1e1e20] p-1.5"
                              : channel.id === "mbc3" ||
                                channel.id === "cnarabia" ||
                                channel.id === "cnn" ||
                                channel.id === "acemovie"
                              ? "bg-white p-0"
                              : channel.id === "makkahquran" ||
                                channel.id === "madinahsunnah"
                              ? "bg-white dark:bg-slate-800/90 p-2.5 sm:p-3"
                              : "bg-white dark:bg-slate-800/90 p-1.5"
                          }`}
                        >
                          <img
                            src={channel.logo}
                            alt={channel.nameKu}
                            loading="eager"
                            decoding="async"
                            referrerPolicy="no-referrer"
                            onError={(e) => handleChannelLogoError(e, channel)}
                            className={`w-full h-full ${
                              channel.id === "makkahquran" ||
                              channel.id === "madinahsunnah"
                                ? "rounded-none object-contain"
                                : channel.id === "fifaplus" ||
                                  channel.id.startsWith("alwansport") ||
                                  channel.id === "kurdmaxshow" ||
                                  channel.id === "nrtsport" ||
                                  channel.id === "starzplay1" ||
                                  channel.id === "starzplay2" ||
                                  channel.id === "basktv" ||
                                  channel.id === "mbc3" ||
                                  channel.id === "cnarabia" ||
                                  channel.id === "cnn" ||
                                  channel.id === "acemovie" ||
                                  channel.id === "osnmoviesaction" ||
                                  channel.id === "osnyahala" ||
                                  channel.id === "thmanyah1" ||
                                  channel.id === "thmanyah2" ||
                                  channel.id === "kurdmaxpepule" ||
                                  channel.id === "majd"
                                ? "rounded-xl object-cover"
                                : "rounded-xl object-contain"
                            }`}
                          />
                        </div>

                        {/* Channel Name */}
                        <div className="w-full min-w-0 px-0.5 pointer-events-none">
                          <h4 className="channel-card-title text-slate-900 dark:text-slate-100 truncate">
                            <span
                              dir={channel.id === "ownplus" ? "ltr" : undefined}
                              style={channel.id === "ownplus" ? { unicodeBidi: "isolate" } : undefined}
                              className={channel.id === "ownplus" ? "inline-block" : undefined}
                            >
                              {lang === "ku" ? channel.nameKu : channel.nameEn}
                            </span>
                          </h4>
                        </div>
                      </motion.div>
                    );
                  })}
                  </AnimatePresence>
                </div>
              </section>

              {section.id === "news" &&
                !onlyFavorites &&
                activeCategory === "all" &&
                !isSearching &&
                filteredChannels.some((c) => c.category === "sports") && (
                  <motion.div
                    key="rekan-water-ad-banner"
                    transformTemplate={clearZeroTransform}
                    initial={{ opacity: 0.85, y: 6 }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      transition: { duration: 0.18, ease: iosPageEase }
                    }}
                    whileTap={{ scale: 0.985, transition: { duration: 0.08 } }}
                    className="relative w-full aspect-[1242/215] rounded-2xl sm:rounded-3xl overflow-hidden border border-white/70 dark:border-white/10 shadow-sm bg-white/40 dark:bg-slate-900/40 select-none"
                  >
                    <motion.img
                      src="/assets/aistudio/E3655B7D-A75C-4E14-A66B-2259435BBC60_b9e90794.jpeg"
                      alt="ئاوی ڕێکان"
                      loading="eager"
                      decoding="async"
                      initial={false}
                      animate={{ opacity: adBannerIndex === 0 ? 1 : 0 }}
                      transition={{ duration: 0.9, ease: "easeInOut" }}
                      className="absolute inset-0 w-full h-full object-cover block"
                    />
                    <motion.img
                      src="/assets/aistudio/IMG_0819_88784996.jpeg"
                      alt="بانەری ڕیکلام"
                      loading="eager"
                      decoding="async"
                      initial={false}
                      animate={{ opacity: adBannerIndex === 1 ? 1 : 0 }}
                      transition={{ duration: 0.9, ease: "easeInOut" }}
                      className="absolute inset-0 w-full h-full object-cover block"
                    />
                  </motion.div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      )}
      </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </div>
  );
}

