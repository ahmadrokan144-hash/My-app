import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  Tv as TicketIcon, 
  Heart, 
  MoreVertical,
  Search
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { onAuthStateChanged } from "@firebase/auth";
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  writeBatch,
  serverTimestamp
} from "@firebase/firestore";
import { auth, db, handleFirestoreError, OperationType } from "./firebase";
import { translations, Language } from "./translations";
import {
  OwnPlusLoginScreen,
  OwnPlusAccount,
  getVerifiedSession,
  clearVerifiedSession,
  syncUserProfileToFirestore
} from "./components/ProfileView";
import ChannelsView from "./components/ChannelsView";
import SearchView from "./components/SearchView";
import MoreView from "./components/MoreView";
import { ChannelCategory } from "./data/kurdishChannels";
import {
  getNotificationsEnabledPref,
  setNotificationsEnabledPref
} from "./utils/notifications";

// Synchronized verbatim with firebase-blueprint.json (UserFavorite.id) and firestore.rules
const CHANNEL_ID_MAX_LENGTH = 64;
const CHANNEL_ID_REGEX = /^[a-zA-Z0-9_-]+$/;
const FAVORITES_STORAGE_KEY = "globaltv_user_favorites_v2";

function isValidChannelId(id: string): boolean {
  return (
    typeof id === "string" &&
    id.length >= 1 &&
    id.length <= CHANNEL_ID_MAX_LENGTH &&
    CHANNEL_ID_REGEX.test(id)
  );
}

export default function App() {
  const [showSplash, setShowSplash] = useState<boolean>(true);
  const [splashFadingOut, setSplashFadingOut] = useState<boolean>(false);

  const [authReady, setAuthReady] = useState<boolean>(false);
  const [loggedInAccount, setLoggedInAccount] = useState<OwnPlusAccount | null>(() => {
    return getVerifiedSession();
  });

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (!active) return;
      if (!firebaseUser) {
        clearVerifiedSession();
        setLoggedInAccount(null);
        setAuthReady(true);
        return;
      }

      const current = auth.currentUser || firebaseUser;

      await current.getIdToken(true).catch(() => {});

      try {
        const synced = await syncUserProfileToFirestore(current);
        if (active) {
          setLoggedInAccount(synced);
        }
      } catch {
        // Fallback to authenticated verified Firebase user details if offline
        if (active) {
          const fallbackEmail = (current.email || "").toLowerCase();
          const fallbackName =
            current.displayName ||
            fallbackEmail.split("@")[0] ||
            `user_${current.uid.slice(0, 5)}`;
          setLoggedInAccount((prev) =>
            prev && prev.id === current.uid
              ? prev
              : {
                  id: current.uid,
                  username: fallbackName,
                  email: fallbackEmail,
                  createdAt:
                    current.metadata?.creationTime || new Date().toISOString(),
                  authProvider: current.providerData.some(
                    (p) => p.providerId === "google.com"
                  )
                    ? "google"
                    : "password"
                }
          );
        }
      } finally {
        if (active) {
          setAuthReady(true);
        }
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const [lang, setLang] = useState<Language>(() => {
    const saved = localStorage.getItem("quran_language") as Language;
    if (saved === "ku" || saved === "en") {
      return saved;
    }
    return "ku";
  });

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    return localStorage.getItem("quran_dark_mode") === "true";
  });

  const [navBlur, setNavBlur] = useState<number>(() => {
    const saved = localStorage.getItem("ownplus_nav_blur");
    if (saved !== null && !Number.isNaN(Number(saved))) {
      return Math.max(0, Math.min(45, Number(saved)));
    }
    return 18;
  });

  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    return getNotificationsEnabledPref();
  });

  const settingsSnapshotRef = useRef({
    darkMode,
    lang,
    navBlur,
    notificationsEnabled
  });
  settingsSnapshotRef.current = {
    darkMode,
    lang,
    navBlur,
    notificationsEnabled
  };
  const settingsWriteTimerRef = useRef<number | null>(null);

  const [activeTab, setActiveTab] = useState<number>(0);
  const [tabSlideDir, setTabSlideDir] = useState<"left" | "right">("left");
  const tabScrollPositionsRef = useRef<Record<number, number>>({ 0: 0, 1: 0, 2: 0, 3: 0 });
  const [popToRootTicks, setPopToRootTicks] = useState<Record<number, number>>({
    0: 0,
    1: 0,
    2: 0,
    3: 0,
  });

  const [selectedChannelId, setSelectedChannelId] = useState<string>(() => {
    return localStorage.getItem("globaltv_selected_channel") || "rudaw";
  });

  const [recentChannelIds, setRecentChannelIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("ownplus_recent_channels");
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed)
        ? parsed.filter((id): id is string => isValidChannelId(String(id))).slice(0, 8)
        : [];
    } catch {
      return [];
    }
  });

  const [openChannelRequest, setOpenChannelRequest] = useState<{
    id: string;
    tick: number;
  } | null>(null);

  const [topCategory, setTopCategory] = useState<ChannelCategory>("all");
  const navRef = useRef<HTMLElement | null>(null);

  const [favorites, setFavorites] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(FAVORITES_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed)
        ? parsed.filter((id): id is string => isValidChannelId(String(id)))
        : [];
    } catch {
      return [];
    }
  });
  const favoritesRef = useRef<string[]>(favorites);
  useEffect(() => {
    favoritesRef.current = favorites;
  }, [favorites]);

  const t = translations[lang];

  const triggerSplashFadeOut = useCallback(() => {
    setSplashFadingOut((alreadyFading) => {
      if (!alreadyFading) {
        window.setTimeout(() => {
          setShowSplash(false);
        }, 950);
      }
      return true;
    });
  }, []);

  // Sync status bar / notch theme-color with dark/light splash screen then restore app theme
  useEffect(() => {
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (showSplash && !splashFadingOut) {
      const splashBg = darkMode ? "#0b0f19" : "#ffffff";
      if (metaTheme) metaTheme.setAttribute("content", splashBg);
      document.documentElement.style.backgroundColor = splashBg;
    } else {
      const targetColor = darkMode ? "#0b0f19" : "#edf2f7";
      if (metaTheme) metaTheme.setAttribute("content", targetColor);
      document.documentElement.style.backgroundColor = "";
    }
  }, [showSplash, splashFadingOut, darkMode]);

  useEffect(() => {
    if (!showSplash) return;

    const fadeTimer = window.setTimeout(() => {
      triggerSplashFadeOut();
    }, 2250);

    return () => {
      window.clearTimeout(fadeTimer);
    };
  }, [showSplash, triggerSplashFadeOut]);

  useEffect(() => {
    document.documentElement.dir = (lang === "ku") ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  // Sync dynamic top & bottom bar frosted blur variables cleanly across 0px–45px
  useEffect(() => {
    const ratio = Math.max(0, Math.min(45, navBlur)) / 45;
    const sat = Math.round(115 + ratio * 105);
    const alphaLight = (0.28 + ratio * 0.54).toFixed(2);
    const alphaDark = (0.34 + ratio * 0.52).toFixed(2);
    document.documentElement.style.setProperty("--nav-blur", `${navBlur}px`);
    document.documentElement.style.setProperty("--nav-sat", `${sat}%`);
    document.documentElement.style.setProperty("--nav-bg-alpha-light", alphaLight);
    document.documentElement.style.setProperty("--nav-bg-alpha-dark", alphaDark);
  }, [navBlur]);

  const persistSettingsToCloud = useCallback(
    (
      next: {
        darkMode: boolean;
        lang: Language;
        navBlur: number;
        notificationsEnabled: boolean;
      },
      debounceMs = 0
    ) => {
      if (settingsWriteTimerRef.current !== null) {
        window.clearTimeout(settingsWriteTimerRef.current);
        settingsWriteTimerRef.current = null;
      }

      const writeNow = () => {
        const currentUser = auth.currentUser;
        if (
          !currentUser ||
          !loggedInAccount ||
          currentUser.uid !== loggedInAccount.id ||
          !currentUser.emailVerified
        ) {
          return;
        }
        const uid = currentUser.uid;
        const settingsDocPath = `users/${uid}/preferences/settings`;
        const settingsRef = doc(db, "users", uid, "preferences", "settings");
        setDoc(settingsRef, {
          userId: uid,
          darkMode: Boolean(next.darkMode),
          lang: next.lang === "en" ? "en" : "ku",
          navBlur: Math.max(0, Math.min(45, Math.round(Number(next.navBlur) || 0))),
          notificationsEnabled: Boolean(next.notificationsEnabled),
          updatedAt: serverTimestamp()
        }).catch((err) => {
          try {
            handleFirestoreError(err, OperationType.WRITE, settingsDocPath);
          } catch {}
        });
      };

      if (debounceMs > 0) {
        settingsWriteTimerRef.current = window.setTimeout(() => {
          settingsWriteTimerRef.current = null;
          writeNow();
        }, debounceMs);
      } else {
        writeNow();
      }
    },
    [loggedInAccount]
  );

  useEffect(() => {
    return () => {
      if (settingsWriteTimerRef.current !== null) {
        window.clearTimeout(settingsWriteTimerRef.current);
      }
    };
  }, []);

  // Real-time cloud sync for user settings (darkMode, lang, navBlur, notificationsEnabled)
  useEffect(() => {
    if (!authReady || !loggedInAccount) return;
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.uid !== loggedInAccount.id || !currentUser.emailVerified) {
      return;
    }

    const uid = currentUser.uid;
    const settingsDocPath = `users/${uid}/preferences/settings`;
    const settingsRef = doc(db, "users", uid, "preferences", "settings");
    let initialSeedAttempted = false;

    const unsubscribe = onSnapshot(
      settingsRef,
      (snap) => {
        if (!snap.exists()) {
          if (!initialSeedAttempted) {
            initialSeedAttempted = true;
            const cur = settingsSnapshotRef.current;
            setDoc(settingsRef, {
              userId: uid,
              darkMode: Boolean(cur.darkMode),
              lang: cur.lang === "en" ? "en" : "ku",
              navBlur: Math.max(0, Math.min(45, Math.round(Number(cur.navBlur) || 0))),
              notificationsEnabled: Boolean(cur.notificationsEnabled),
              updatedAt: serverTimestamp()
            }).catch((err) => {
              try {
                handleFirestoreError(err, OperationType.CREATE, settingsDocPath);
              } catch {}
            });
          }
          return;
        }

        initialSeedAttempted = true;
        const data = snap.data() as {
          darkMode?: unknown;
          lang?: unknown;
          navBlur?: unknown;
          notificationsEnabled?: unknown;
        };

        if (typeof data.darkMode === "boolean") {
          setDarkMode(data.darkMode);
          try {
            localStorage.setItem("quran_dark_mode", data.darkMode.toString());
          } catch {}
        }

        if (data.lang === "ku" || data.lang === "en") {
          setLang(data.lang);
          try {
            localStorage.setItem("quran_language", data.lang);
          } catch {}
        }

        if (typeof data.navBlur === "number" && !Number.isNaN(data.navBlur)) {
          const clamped = Math.max(0, Math.min(45, Math.round(data.navBlur)));
          setNavBlur(clamped);
          try {
            localStorage.setItem("ownplus_nav_blur", clamped.toString());
          } catch {}
        }

        if (typeof data.notificationsEnabled === "boolean") {
          setNotificationsEnabled(data.notificationsEnabled);
          setNotificationsEnabledPref(data.notificationsEnabled);
        }
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.GET, settingsDocPath);
        } catch {}
      }
    );

    return () => unsubscribe();
  }, [authReady, loggedInAccount]);

  const handleLangChange = useCallback(
    (nextLang: Language) => {
      setLang(nextLang);
      try {
        localStorage.setItem("quran_language", nextLang);
      } catch {}
      persistSettingsToCloud({ ...settingsSnapshotRef.current, lang: nextLang });
    },
    [persistSettingsToCloud]
  );

  const handleDarkModeChange = useCallback(
    (nextDark: boolean) => {
      setDarkMode(nextDark);
      try {
        localStorage.setItem("quran_dark_mode", nextDark.toString());
      } catch {}
      persistSettingsToCloud({ ...settingsSnapshotRef.current, darkMode: nextDark });
    },
    [persistSettingsToCloud]
  );

  const handleNavBlurChange = useCallback(
    (nextBlur: number) => {
      const clamped = Math.max(0, Math.min(45, Math.round(nextBlur)));
      setNavBlur(clamped);
      try {
        localStorage.setItem("ownplus_nav_blur", clamped.toString());
      } catch {}
      persistSettingsToCloud({ ...settingsSnapshotRef.current, navBlur: clamped }, 320);
    },
    [persistSettingsToCloud]
  );

  const handleNotificationsPrefChange = useCallback(
    (nextEnabled: boolean) => {
      setNotificationsEnabled(nextEnabled);
      setNotificationsEnabledPref(nextEnabled);
      persistSettingsToCloud({
        ...settingsSnapshotRef.current,
        notificationsEnabled: nextEnabled
      });
    },
    [persistSettingsToCloud]
  );

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark");
      document.documentElement.classList.remove("light-theme");
    } else {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light-theme");
    }
  }, [darkMode]);

  // Sync favorites in real time with the signed-in user's Firestore account
  useEffect(() => {
    if (!authReady || !loggedInAccount) return;
    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.uid !== loggedInAccount.id || !currentUser.emailVerified) {
      return;
    }

    const uid = currentUser.uid;
    const favColPath = `users/${uid}/favorites`;
    const favQuery = query(
      collection(db, "users", uid, "favorites"),
      where("userId", "==", uid)
    );

    let initialMigrationDone = false;

    const unsubscribe = onSnapshot(
      favQuery,
      (snapshot) => {
        const cloudIds = snapshot.docs
          .map((d) => d.id)
          .filter((id) => isValidChannelId(id));

        // On first cloud load, if cloud is empty but user has local favorites, upload them once
        if (!initialMigrationDone) {
          initialMigrationDone = true;
          const localIds = favoritesRef.current.filter((id) => isValidChannelId(id));
          if (cloudIds.length === 0 && localIds.length > 0) {
            const batch = writeBatch(db);
            for (const chId of localIds) {
              batch.set(doc(db, "users", uid, "favorites", chId), {
                id: chId,
                userId: uid,
                createdAt: serverTimestamp()
              });
            }
            batch.commit().catch((err) => {
              try {
                handleFirestoreError(err, OperationType.WRITE, favColPath);
              } catch {}
            });
            return;
          }
        }

        setFavorites(cloudIds);
        try {
          localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(cloudIds));
        } catch {}
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, favColPath);
        } catch {}
      }
    );

    return () => unsubscribe();
  }, [authReady, loggedInAccount]);

  const handleToggleFavorite = (channelId: string) => {
    if (!isValidChannelId(channelId)) return;

    const wasFav = favoritesRef.current.includes(channelId);
    const next = wasFav
      ? favoritesRef.current.filter((id) => id !== channelId)
      : [...favoritesRef.current, channelId];

    setFavorites(next);
    try {
      localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(next));
    } catch {}

    const currentUser = auth.currentUser;
    if (currentUser && loggedInAccount && currentUser.uid === loggedInAccount.id && currentUser.emailVerified) {
      const favDocPath = `users/${currentUser.uid}/favorites/${channelId}`;
      const favRef = doc(db, "users", currentUser.uid, "favorites", channelId);
      if (wasFav) {
        deleteDoc(favRef).catch((err) => {
          try {
            handleFirestoreError(err, OperationType.DELETE, favDocPath);
          } catch {}
        });
      } else {
        setDoc(favRef, {
          id: channelId,
          userId: currentUser.uid,
          createdAt: serverTimestamp()
        }).catch((err) => {
          try {
            handleFirestoreError(err, OperationType.CREATE, favDocPath);
          } catch {}
        });
      }
    }
  };

  const recordRecentChannel = useCallback((channelId: string) => {
    if (!isValidChannelId(channelId)) return;
    setRecentChannelIds((prev) => {
      const next = [channelId, ...prev.filter((id) => id !== channelId)].slice(0, 8);
      try {
        localStorage.setItem("ownplus_recent_channels", JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  const handleClearRecentChannels = useCallback(() => {
    setRecentChannelIds([]);
    try {
      localStorage.removeItem("ownplus_recent_channels");
    } catch {}
  }, []);

  const handleSelectChannel = (channelId: string) => {
    setSelectedChannelId(channelId);
    localStorage.setItem("globaltv_selected_channel", channelId);
    recordRecentChannel(channelId);
  };

  const handleOpenChannelFromSearch = (channelId: string) => {
    handleSelectChannel(channelId);
    setTopCategory("all");
    setOpenChannelRequest({ id: channelId, tick: Date.now() });
    if (activeTab !== 0) {
      handleTabChange(0);
    }
  };

  // Handle Tab Switch with instant scroll preservation and native iOS re-tap behavior
  const handleTabChange = (index: number) => {
    if (index === activeTab) {
      if (window.scrollY > 24) {
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setPopToRootTicks((prev) => ({ ...prev, [index]: (prev[index] || 0) + 1 }));
      }
      return;
    }

    tabScrollPositionsRef.current[activeTab] = window.scrollY || 0;
    const isRtl = lang === "ku";
    const movingForward = index > activeTab;
    setTabSlideDir(
      isRtl
        ? movingForward
          ? "left"
          : "right"
        : movingForward
        ? "right"
        : "left"
    );
    setActiveTab(index);
    localStorage.setItem("noorabrr_active_tab", index.toString());

    const savedScroll = tabScrollPositionsRef.current[index] || 0;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: savedScroll, behavior: "auto" });
    });
  };

  const handleNavTabClick = (index: number, e: React.MouseEvent<HTMLButtonElement>) => {
    const navEl = navRef.current;
    if (navEl && e.clientY > 0) {
      const rect = navEl.getBoundingClientRect();
      if (e.clientY < rect.top - 14 || e.clientY > rect.bottom + 14) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }
    handleTabChange(index);
  };

  const navCategories: { id: ChannelCategory; labelKu: string; labelEn: string }[] = [
    { id: "all", labelKu: "هەموو کەناڵەکان", labelEn: "All Channels" },
    { id: "news", labelKu: "هەواڵ", labelEn: "News" },
    { id: "sports", labelKu: "وەرزشی", labelEn: "Sports" },
    { id: "general", labelKu: "گشتی و خێزانی", labelEn: "General & Family" },
    { id: "local", labelKu: "کەناڵە ناوخۆییەکان", labelEn: "Local Channels" },
    { id: "religious", labelKu: "ئایینی", labelEn: "Religious" },
    { id: "kids", labelKu: "منداڵان", labelEn: "Kids" },
    { id: "culture", labelKu: "کلتوری و موزیک", labelEn: "Culture & Music" }
  ];

  const activeTabTitle =
    activeTab === 0
      ? lang === "ku"
        ? "کەناڵەکان"
        : "Home"
      : activeTab === 1
      ? lang === "ku"
        ? "گەڕان"
        : "Search"
      : activeTab === 2
      ? lang === "ku"
        ? "دڵخوازەکان"
        : "Favorites"
      : lang === "ku"
      ? "زیاتر"
      : "More";

  const isMainShellVisible = Boolean(loggedInAccount);

  const navRatio = Math.max(0, Math.min(45, navBlur)) / 45;
  const navSat = Math.round(115 + navRatio * 105);
  const navAlphaLight = (0.28 + navRatio * 0.54).toFixed(2);
  const navAlphaDark = (0.34 + navRatio * 0.52).toFixed(2);
  const navGlassFilter = `blur(${navBlur}px) saturate(${navSat}%)`;

  return (
    <>
    <div 
      id="app-content" 
      className="min-h-screen w-full flex flex-col selection:bg-blue-100 select-none" 
      dir={lang === "ku" ? "rtl" : "ltr"}
    >
      {/* سپڵاش سکرینی گونجاو لەگەڵ دۆخی تاریک و ڕووناک بە جووڵەی مۆشنی لۆگۆ نوێیەکە */}
      <AnimatePresence mode="sync">
        {showSplash && (
          <motion.div
            key="splash-logo-screen"
            initial={{ opacity: 1 }}
            animate={{ opacity: splashFadingOut ? 0 : 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.85, ease: [0.4, 0, 0.2, 1] }}
            className={`fullscreen-splash-overlay ${
              darkMode ? "splash-dark bg-[#0b0f19]" : "bg-white"
            } flex items-center justify-center select-none will-change-[opacity] ${
              splashFadingOut ? "pointer-events-none" : ""
            }`}
            style={{ perspective: "1000px" }}
          >
            <div className="relative flex flex-col items-center justify-center">
              {/* شەپۆلێکی بازنەیی ناسکی ڕووناکی لە کاتی کرانەوەی کلیلەکە */}
              <motion.div
                initial={{ opacity: 0, scale: 0.55 }}
                animate={{
                  opacity: [0, 0.42, 0],
                  scale: [0.55, 1.45, 1.85]
                }}
                transition={{
                  duration: 1.35,
                  delay: 0.42,
                  ease: [0.22, 1, 0.36, 1]
                }}
                className={`pointer-events-none absolute w-40 h-40 sm:w-48 sm:h-48 rounded-full border-[1.5px] ${
                  darkMode ? "border-violet-400/35" : "border-violet-300/70"
                }`}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.65 }}
                animate={{
                  opacity: [0, 0.28, 0],
                  scale: [0.65, 1.7, 2.15]
                }}
                transition={{
                  duration: 1.5,
                  delay: 0.58,
                  ease: [0.22, 1, 0.36, 1]
                }}
                className={`pointer-events-none absolute w-40 h-40 sm:w-48 sm:h-48 rounded-full border ${
                  darkMode ? "border-sky-400/30" : "border-sky-300/60"
                }`}
              />

              {/* لۆگۆ 3Dـە نوێیەکە بە جووڵەی هاتنەناوەوە، سوڕانەوەی کلیل و درەوشانەوە */}
              <motion.div
                initial={{
                  opacity: 0,
                  scale: 0.62,
                  y: 22,
                  rotateZ: -14,
                  rotateY: -26
                }}
                animate={
                  splashFadingOut
                    ? {
                        opacity: 0,
                        scale: 1.08,
                        y: -4,
                        rotateZ: 0,
                        rotateY: 0,
                        transition: { duration: 0.72, ease: [0.4, 0, 0.2, 1] }
                      }
                    : {
                        opacity: [0, 1, 1, 1, 1],
                        scale: [0.62, 1.05, 0.99, 1.02, 1],
                        y: [22, -4, 0, -5, 0],
                        rotateZ: [-14, 4, -1.5, 1.5, 0],
                        rotateY: [-26, 6, 0, 0, 0],
                        transition: {
                          duration: 2.1,
                          times: [0, 0.34, 0.55, 0.8, 1],
                          ease: [0.22, 1, 0.36, 1]
                        }
                      }
                }
                className="relative w-36 sm:w-44 aspect-[771/512] flex items-center justify-center will-change-transform"
              >
                <img
                  src="/assets/aistudio/key-logo-3d.png"
                  alt="own+"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.src.includes("key-logo-header.png")) {
                      target.src = "/assets/aistudio/key-logo-header.png";
                    }
                  }}
                  className="w-full h-full object-contain select-none pointer-events-none"
                />

                {/* تیشکی بریقەدار تەنها لەسەر شێوەی خودی کلیلەکە تێدەپەڕێت */}
                <div
                  className="pointer-events-none absolute inset-0 overflow-hidden"
                  style={{
                    maskImage: "url(/assets/aistudio/key-logo-3d.png)",
                    WebkitMaskImage: "url(/assets/aistudio/key-logo-3d.png)",
                    maskSize: "contain",
                    WebkitMaskSize: "contain",
                    maskRepeat: "no-repeat",
                    WebkitMaskRepeat: "no-repeat",
                    maskPosition: "center",
                    WebkitMaskPosition: "center"
                  }}
                >
                  <motion.div
                    initial={{ x: "-140%" }}
                    animate={{ x: "180%" }}
                    transition={{
                      duration: 0.95,
                      delay: 0.72,
                      ease: [0.25, 0.1, 0.25, 1]
                    }}
                    className="w-1/2 h-[180%] -mt-[40%] bg-gradient-to-r from-transparent via-white/85 to-transparent rotate-24"
                  />
                </div>
              </motion.div>

              {/* سێبەرێکی نەرم لە ژێرەوە کە لەگەڵ بەرزبوونەوەی لۆگۆکە دەجووڵێت */}
              <motion.div
                initial={{ opacity: 0, scaleX: 0.4 }}
                animate={
                  splashFadingOut
                    ? { opacity: 0, scaleX: 0.7 }
                    : {
                        opacity: [0, 0.2, 0.16, 0.12, 0.16],
                        scaleX: [0.4, 1, 0.96, 0.86, 0.94]
                      }
                }
                transition={{
                  duration: 2.1,
                  times: [0, 0.34, 0.55, 0.8, 1],
                  ease: [0.22, 1, 0.36, 1]
                }}
                className={`mt-4 w-28 sm:w-32 h-2.5 rounded-full blur-md pointer-events-none ${
                  darkMode ? "bg-sky-400/25" : "bg-slate-900/20"
                }`}
              />
            </div>
          </motion.div>
        )}

        {authReady && !loggedInAccount && (
          <motion.div
            key="ownplus-login-screen"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.45, ease: "easeInOut" } }}
            className="fixed inset-0 z-[9998] bg-white dark:bg-[#0b0f19]"
          >
            <OwnPlusLoginScreen
              onSuccess={(acc) => {
                setLoggedInAccount(acc);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Ambient Fluid Wave Background */}
      <div className="liquid-wave pointer-events-none"></div>

      {/* Geometric Dot Overlay */}
      <div className="geometric-overlay pointer-events-none"></div>

      {/* 🎬 ناڤ باری سەرەوەی ستایلی شوشەیی */}
      {Boolean(loggedInAccount) && (
        <header
          className="app-top-header sticky top-0 z-50 w-full frosted-nav-bar border-b rounded-b-[28px] transition-colors duration-200"
          style={{
            paddingTop:
              typeof window !== "undefined" &&
              ((window.navigator as any).standalone === true ||
                window.matchMedia("(display-mode: standalone)").matches ||
                window.matchMedia("(display-mode: fullscreen)").matches ||
                (/(iPhone|iPad|iPod)/i.test(window.navigator.userAgent) &&
                  window.self === window.top &&
                  window.innerHeight >= window.screen.height - 45))
                ? "max(calc(env(safe-area-inset-top, 48px) + 18px), 64px)"
                : "calc(max(env(safe-area-inset-top, 0px), 14px) + 6px)",
            backdropFilter: navGlassFilter,
            WebkitBackdropFilter: navGlassFilter,
            backgroundColor: darkMode
              ? `rgba(15, 23, 42, ${navAlphaDark})`
              : `rgba(255, 255, 255, ${navAlphaLight})`
          }}
        >
          <div className="max-w-4xl mx-auto px-4 pb-2.5 flex flex-col">
            {/* ڕیزی یەکەم: لۆگۆی own+ و ناونیشانی بەش */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src="/assets/aistudio/key-logo-3d.png"
                  alt="own+"
                  onError={(e) => {
                    const target = e.currentTarget;
                    if (!target.src.includes("key-logo-header.png")) {
                      target.src = "/assets/aistudio/key-logo-header.png";
                    }
                  }}
                  className="h-7 sm:h-8 w-auto object-contain select-none pointer-events-none shrink-0"
                />
                <motion.h1
                  key={activeTabTitle}
                  initial={{ opacity: 0, x: tabSlideDir === "left" ? -16 : 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
                  className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight truncate kurdish-bold"
                >
                  {activeTabTitle}
                </motion.h1>
              </div>
            </div>

            {/* ڕیزی دووەم: فلتەری خێرا (هەواڵ، وەرزشی) بۆ تابی کەناڵەکان و دڵخوازەکان */}
            {(activeTab === 0 || activeTab === 2) && (
              <div className="overflow-visible">
                <div className="pt-2.5 pb-0.5 flex items-center gap-2 overflow-x-auto no-scrollbar">
                  {/* ١. هەواڵ (News) */}
                  <button
                    type="button"
                    onClick={() => {
                      setTopCategory((prev) => (prev === "news" ? "all" : "news"));
                    }}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap cursor-pointer ${
                      topCategory === "news"
                        ? "bg-blue-600 text-white border-blue-500 shadow-xs"
                        : "bg-white/65 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 border-slate-300/80 dark:border-white/15 hover:bg-white dark:hover:bg-slate-800"
                    }`}
                  >
                    {lang === "ku" ? "هەواڵ" : "News"}
                  </button>

                  {/* ٢. وەرزشی (Sports) */}
                  <button
                    type="button"
                    onClick={() => {
                      setTopCategory((prev) => (prev === "sports" ? "all" : "sports"));
                    }}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap cursor-pointer ${
                      topCategory === "sports"
                        ? "bg-blue-600 text-white border-blue-500 shadow-xs"
                        : "bg-white/65 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 border-slate-300/80 dark:border-white/15 hover:bg-white dark:hover:bg-slate-800"
                    }`}
                  >
                    {lang === "ku" ? "وەرزشی" : "Sports"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </header>
      )}

      {/* Main content body container with kept-alive native tab slots */}
      <main
        className="flex-1 w-full max-w-4xl mx-auto relative z-10 px-4 pt-3 pb-28 overflow-x-clip"
        id="main-content"
      >
        {isMainShellVisible && (
          <>
            {/* Tab 0: Channels */}
            <div
              className={`native-tab-panel w-full h-full ${activeTab === 0 ? "block" : "hidden"}`}
              data-active={activeTab === 0 ? "true" : "false"}
              data-slide={tabSlideDir}
            >
              <ChannelsView
                lang={lang}
                t={t}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
                onlyFavorites={false}
                selectedChannelId={selectedChannelId}
                onSelectChannel={handleSelectChannel}
                externalCategory={topCategory}
                onExternalCategoryChange={setTopCategory}
                externalSearchQuery=""
                isTabActive={activeTab === 0}
                popToRootTick={popToRootTicks[0]}
                openChannelRequest={openChannelRequest}
              />
            </div>

            {/* Tab 1: Search & Discover */}
            <div
              className={`native-tab-panel w-full h-full ${activeTab === 1 ? "block" : "hidden"}`}
              data-active={activeTab === 1 ? "true" : "false"}
              data-slide={tabSlideDir}
            >
              <SearchView
                lang={lang}
                recentChannelIds={recentChannelIds}
                onClearRecent={handleClearRecentChannels}
                onOpenChannel={handleOpenChannelFromSearch}
                isTabActive={activeTab === 1}
                popToRootTick={popToRootTicks[1]}
              />
            </div>

            {/* Tab 2: Favorites */}
            <div
              className={`native-tab-panel w-full h-full ${activeTab === 2 ? "block" : "hidden"}`}
              data-active={activeTab === 2 ? "true" : "false"}
              data-slide={tabSlideDir}
            >
              <ChannelsView
                lang={lang}
                t={t}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
                onlyFavorites={true}
                selectedChannelId={selectedChannelId}
                onSelectChannel={handleSelectChannel}
                externalCategory={topCategory}
                onExternalCategoryChange={setTopCategory}
                externalSearchQuery=""
                isTabActive={activeTab === 2}
                popToRootTick={popToRootTicks[2]}
              />
            </div>

            {/* Tab 3: More */}
            <div
              className={`native-tab-panel w-full h-full ${activeTab === 3 ? "block" : "hidden"}`}
              data-active={activeTab === 3 ? "true" : "false"}
              data-slide={tabSlideDir}
            >
              <MoreView
                lang={lang}
                setLang={handleLangChange}
                t={t}
                darkMode={darkMode}
                setDarkMode={handleDarkModeChange}
                navBlur={navBlur}
                setNavBlur={handleNavBlurChange}
                notificationsEnabled={notificationsEnabled}
                onNotificationsPrefChange={handleNotificationsPrefChange}
                account={loggedInAccount}
                onLoginSuccess={setLoggedInAccount}
                onLogout={() => setLoggedInAccount(null)}
                popToRootTick={popToRootTicks[3]}
              />
            </div>
          </>
        )}
      </main>
    </div>

    {/* 🧭 Floating Frosted Glass Bottom Navigation Bar (4 Balanced Tabs) */}
    <nav 
      ref={navRef}
      dir={lang === "ku" ? "rtl" : "ltr"}
      className="fixed bottom-5 left-4 right-4 max-w-md mx-auto h-[68px] z-50 rounded-full frosted-nav-bar flex items-center justify-around px-2 select-none"
      id="floating-navigation-bar"
      style={{
        borderRadius: "9999px",
        backdropFilter: navGlassFilter,
        WebkitBackdropFilter: navGlassFilter,
        backgroundColor: darkMode
          ? `rgba(15, 23, 42, ${navAlphaDark})`
          : `rgba(255, 255, 255, ${navAlphaLight})`
      }}
    >
      {/* Tab 0: Channels */}
      <button
        type="button"
        onClick={(e) => handleNavTabClick(0, e)}
        className={`relative flex flex-col items-center justify-center flex-1 h-full cursor-pointer transition-colors ${
          activeTab === 0
            ? "text-blue-600 dark:text-blue-400 font-black"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
        }`}
        id="nav-tab-ticket"
      >
        {activeTab === 0 && (
          <motion.div 
            layoutId="nav-pill"
            className="absolute inset-x-1 inset-y-1.5 rounded-full bg-blue-500/10 dark:bg-blue-500/20 -z-10 pointer-events-none"
            transition={{ type: "spring", stiffness: 320, damping: 30, mass: 0.9 }}
          />
        )}
        <TicketIcon className="w-5 h-5 transition-transform pointer-events-none" />
        <span className="text-[10px] mt-0.5 font-bold whitespace-nowrap pointer-events-none">{t.tabTakeTicket}</span>
      </button>

      {/* Tab 1: Search */}
      <button
        type="button"
        onClick={(e) => handleNavTabClick(1, e)}
        className={`relative flex flex-col items-center justify-center flex-1 h-full cursor-pointer transition-colors ${
          activeTab === 1
            ? "text-blue-600 dark:text-blue-400 font-black"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
        }`}
        id="nav-tab-search"
      >
        {activeTab === 1 && (
          <motion.div 
            layoutId="nav-pill"
            className="absolute inset-x-1 inset-y-1.5 rounded-full bg-blue-500/10 dark:bg-blue-500/20 -z-10 pointer-events-none"
            transition={{ type: "spring", stiffness: 320, damping: 30, mass: 0.9 }}
          />
        )}
        <Search className="w-5 h-5 transition-transform pointer-events-none" />
        <span className="text-[10px] mt-0.5 font-bold whitespace-nowrap pointer-events-none">
          {lang === "ku" ? "گەڕان" : "Search"}
        </span>
      </button>

      {/* Tab 2: Favorites */}
      <button
        type="button"
        onClick={(e) => handleNavTabClick(2, e)}
        className={`relative flex flex-col items-center justify-center flex-1 h-full cursor-pointer transition-colors ${
          activeTab === 2
            ? "text-blue-600 dark:text-blue-400 font-black"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
        }`}
        id="nav-tab-history"
      >
        {activeTab === 2 && (
          <motion.div 
            layoutId="nav-pill"
            className="absolute inset-x-1 inset-y-1.5 rounded-full bg-blue-500/10 dark:bg-blue-500/20 -z-10 pointer-events-none"
            transition={{ type: "spring", stiffness: 320, damping: 30, mass: 0.9 }}
          />
        )}
        <Heart className={`w-5 h-5 transition-transform pointer-events-none ${activeTab === 2 ? "fill-current" : ""}`} />
        <span className="text-[10px] mt-0.5 font-bold whitespace-nowrap pointer-events-none">{t.tabQueueList}</span>
      </button>

      {/* Tab 3: More (زیاتر) */}
      <button
        type="button"
        onClick={(e) => handleNavTabClick(3, e)}
        className={`relative flex flex-col items-center justify-center flex-1 h-full cursor-pointer transition-colors ${
          activeTab === 3
            ? "text-blue-600 dark:text-blue-400 font-black"
            : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
        }`}
        id="nav-tab-more"
      >
        {activeTab === 3 && (
          <motion.div 
            layoutId="nav-pill"
            className="absolute inset-x-1 inset-y-1.5 rounded-full bg-blue-500/10 dark:bg-blue-500/20 -z-10 pointer-events-none"
            transition={{ type: "spring", stiffness: 320, damping: 30, mass: 0.9 }}
          />
        )}
        <MoreVertical className="w-5 h-5 transition-transform pointer-events-none" />
        <span className="text-[10px] mt-0.5 font-bold whitespace-nowrap pointer-events-none">{t.tabSettings}</span>
      </button>
    </nav>
    </>
  );
}

