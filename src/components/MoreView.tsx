import React, { useState, useEffect, useRef } from "react";
import { ArrowRight, ArrowLeft, ExternalLink, Info } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { signOut } from "@firebase/auth";
import { auth } from "../firebase";
import { Language, Translations } from "../translations";
import ProfileView, { OwnPlusAccount, clearVerifiedSession } from "./ProfileView";
import QueueSettingsView from "./QueueSettingsView";
import EdgeSwipeBack from "./EdgeSwipeBack";

interface MoreViewProps {
  lang: Language;
  setLang: (lang: Language) => void;
  t: Translations;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  navBlur: number;
  setNavBlur: (val: number) => void;
  notificationsEnabled: boolean;
  onNotificationsPrefChange: (val: boolean) => void;
  account: OwnPlusAccount | null;
  onLoginSuccess: (account: OwnPlusAccount) => void;
  onLogout: () => void;
  popToRootTick?: number;
}

const IOS_PAGE_EASE = [0.32, 0.72, 0, 1] as const;

const clearZeroTransform = (_: unknown, generated: string) =>
  generated === "translateX(0px)" ||
  generated === "translateX(0%)" ||
  generated === "translate3d(0px, 0px, 0px)" ||
  generated === "none"
    ? "none"
    : generated;

export default function MoreView({
  lang,
  setLang,
  t,
  darkMode,
  setDarkMode,
  navBlur,
  setNavBlur,
  notificationsEnabled,
  onNotificationsPrefChange,
  account,
  onLoginSuccess,
  onLogout,
  popToRootTick = 0,
}: MoreViewProps) {
  const [subView, setSubView] = useState<"menu" | "profile" | "settings" | "about">("menu");
  const prevPopTickRef = useRef<number>(popToRootTick);
  const viaSwipeRef = useRef<boolean>(false);

  const isRtl = lang === "ku";
  const pushInX = isRtl ? "-100%" : "100%";
  const parentShiftX = isRtl ? "24%" : "-24%";

  useEffect(() => {
    if (popToRootTick !== prevPopTickRef.current) {
      prevPopTickRef.current = popToRootTick;
      if (subView !== "menu") {
        viaSwipeRef.current = false;
        setSubView("menu");
      }
    }
  }, [popToRootTick, subView]);

  const handleBackToMenu = () => {
    setSubView("menu");
  };

  const handleOpenSubView = (target: "profile" | "settings" | "about") => {
    viaSwipeRef.current = false;
    setSubView(target);
  };

  const handleLogoutClick = async () => {
    clearVerifiedSession();
    try {
      await signOut(auth).catch(() => {});
    } catch {}
    onLogout();
  };

  return (
    <div className="relative w-full overflow-x-clip">
      <AnimatePresence initial={false} mode="popLayout" custom={viaSwipeRef.current}>
        {subView === "profile" ? (
          <motion.div
            key="more-profile"
            custom={viaSwipeRef.current}
            transformTemplate={clearZeroTransform}
            initial={{ x: pushInX, opacity: 1 }}
            animate={{
              x: 0,
              opacity: 1,
              transition: { duration: 0.38, ease: IOS_PAGE_EASE },
            }}
            exit={(wasSwiped: boolean) =>
              wasSwiped
                ? { opacity: 0, transition: { duration: 0.01 } }
                : {
                    x: pushInX,
                    opacity: 0,
                    transition: { duration: 0.34, ease: IOS_PAGE_EASE },
                  }
            }
            className="tab-view w-full"
          >
            <EdgeSwipeBack
              onBeforeSwipePop={() => {
                viaSwipeRef.current = true;
              }}
              onBack={handleBackToMenu}
            >
              <div className="w-full flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      viaSwipeRef.current = false;
                      handleBackToMenu();
                    }}
                    className="px-4 py-2.5 rounded-2xl glass-card border border-white/70 dark:border-white/10 text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer hover:opacity-90 transition-all kurdish-bold"
                  >
                    {isRtl ? (
                      <ArrowRight className="w-4 h-4" />
                    ) : (
                      <ArrowLeft className="w-4 h-4" />
                    )}
                    <span>{lang === "ku" ? "گەڕانەوە" : "Back"}</span>
                  </button>
                </div>

                <ProfileView
                  lang={lang}
                  t={t}
                  account={account}
                  onLoginSuccess={onLoginSuccess}
                  onLogout={onLogout}
                />
              </div>
            </EdgeSwipeBack>
          </motion.div>
        ) : subView === "settings" ? (
          <motion.div
            key="more-settings"
            custom={viaSwipeRef.current}
            transformTemplate={clearZeroTransform}
            initial={{ x: pushInX, opacity: 1 }}
            animate={{
              x: 0,
              opacity: 1,
              transition: { duration: 0.38, ease: IOS_PAGE_EASE },
            }}
            exit={(wasSwiped: boolean) =>
              wasSwiped
                ? { opacity: 0, transition: { duration: 0.01 } }
                : {
                    x: pushInX,
                    opacity: 0,
                    transition: { duration: 0.34, ease: IOS_PAGE_EASE },
                  }
            }
            className="tab-view w-full"
          >
            <EdgeSwipeBack
              onBeforeSwipePop={() => {
                viaSwipeRef.current = true;
              }}
              onBack={handleBackToMenu}
            >
              <div className="w-full flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      viaSwipeRef.current = false;
                      handleBackToMenu();
                    }}
                    className="px-4 py-2.5 rounded-2xl glass-card border border-white/70 dark:border-white/10 text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer hover:opacity-90 transition-all kurdish-bold"
                  >
                    {isRtl ? (
                      <ArrowRight className="w-4 h-4" />
                    ) : (
                      <ArrowLeft className="w-4 h-4" />
                    )}
                    <span>{lang === "ku" ? "گەڕانەوە" : "Back"}</span>
                  </button>
                </div>

                <QueueSettingsView
                  lang={lang}
                  setLang={setLang}
                  t={t}
                  darkMode={darkMode}
                  setDarkMode={setDarkMode}
                  navBlur={navBlur}
                  setNavBlur={setNavBlur}
                  notificationsEnabled={notificationsEnabled}
                  onNotificationsPrefChange={onNotificationsPrefChange}
                  isAccountSynced={Boolean(account)}
                />
              </div>
            </EdgeSwipeBack>
          </motion.div>
        ) : subView === "about" ? (
          <motion.div
            key="more-about"
            custom={viaSwipeRef.current}
            transformTemplate={clearZeroTransform}
            initial={{ x: pushInX, opacity: 1 }}
            animate={{
              x: 0,
              opacity: 1,
              transition: { duration: 0.38, ease: IOS_PAGE_EASE },
            }}
            exit={(wasSwiped: boolean) =>
              wasSwiped
                ? { opacity: 0, transition: { duration: 0.01 } }
                : {
                    x: pushInX,
                    opacity: 0,
                    transition: { duration: 0.34, ease: IOS_PAGE_EASE },
                  }
            }
            className="tab-view w-full"
          >
            <EdgeSwipeBack
              onBeforeSwipePop={() => {
                viaSwipeRef.current = true;
              }}
              onBack={handleBackToMenu}
            >
              <div className="w-full flex flex-col gap-2.5 pb-28">
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      viaSwipeRef.current = false;
                      handleBackToMenu();
                    }}
                    className="px-4 py-2.5 rounded-2xl glass-card border border-white/70 dark:border-white/10 text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-black flex items-center gap-2 cursor-pointer hover:opacity-90 transition-all kurdish-bold"
                  >
                    {isRtl ? (
                      <ArrowRight className="w-4 h-4" />
                    ) : (
                      <ArrowLeft className="w-4 h-4" />
                    )}
                    <span>{lang === "ku" ? "گەڕانەوە" : "Back"}</span>
                  </button>
                </div>

                {/* کاردی دەربارەی ئەپەکە */}
                <section className="glass-card rounded-3xl p-5 sm:p-6 shadow-sm border border-white/60 dark:border-white/10 flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <Info className="w-5 h-5" />
                    </div>
                    <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 kurdish-bold">
                      {lang === "ku" ? "دەربارە" : "About"}
                    </h3>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {t.aboutText}
                  </p>

                  <div className="text-[11px] text-slate-400 pt-3 border-t border-slate-200/50 dark:border-slate-700/50 flex items-center justify-between">
                    <span>وەشانی سیستەم: own+ v2.0</span>
                    <span>دیزاینی شووشەیی (Ultra Glass)</span>
                  </div>
                </section>

                {/* 🌐 پەیوەندیکردن (فەیسبووک و وەتسئەپ) لە ناو بەشی دەربارە */}
                <section className="glass-card rounded-3xl p-4 sm:p-5 shadow-sm border border-white/60 dark:border-white/10 flex flex-col gap-3">
                  {/* فەیسبووک */}
                  <a
                    href="https://www.facebook.com/share/1FLfLCmV6A/?mibextid=wwXIfr"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-[#1877F2] to-[#166fe5] hover:from-[#166fe5] hover:to-[#1460c9] active:scale-[0.99] text-white shadow-md transition-all flex items-center justify-between gap-3 cursor-pointer no-underline"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                        <svg
                          className="w-6 h-6 fill-current text-white"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                        </svg>
                      </div>

                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-base font-black text-white leading-tight kurdish-bold">
                          {lang === "ku" ? "فەیسبووک" : "Facebook"}
                        </h3>
                        <p className="text-[11px] sm:text-xs text-blue-100 leading-snug mt-0.5">
                          {lang === "ku"
                            ? "سەردانی پڕۆفایلەکەمان بکە"
                            : "Visit our official profile"}
                        </p>
                      </div>
                    </div>

                    <div className="px-3 py-2 rounded-xl bg-white text-[#1877F2] text-xs font-black flex items-center gap-1.5 shrink-0 shadow-xs">
                      <span>{lang === "ku" ? "کردنەوە" : "Open"}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </div>
                  </a>

                  {/* وەتسئەپ */}
                  <a
                    href="https://wa.me/qr/IL3RWJUTQM7SG1?s=r"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-[#25D366] to-[#128C7E] hover:from-[#20bd5a] hover:to-[#0f7a6d] active:scale-[0.99] text-white shadow-md transition-all flex items-center justify-between gap-3 cursor-pointer no-underline"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                        <svg
                          className="w-6 h-6 fill-current text-white"
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path d="M12.031 2C6.498 2 2 6.498 2 12.031c0 1.772.463 3.501 1.341 5.025L2 22l5.069-1.329a9.983 9.983 0 0 0 4.962 1.309h.004c5.531 0 10.031-4.499 10.031-10.031C22.066 6.498 17.562 2 12.031 2zm5.847 14.228c-.246.693-1.437 1.325-1.993 1.409-.513.077-1.179.109-1.903-.121-.44-.14-1.006-.328-1.727-.639-3.038-1.312-5.022-4.38-5.174-4.583-.152-.203-1.236-1.644-1.236-3.136 0-1.492.78-2.226 1.057-2.529.277-.303.605-.379.806-.379.202 0 .403.002.58.011.186.009.436-.071.682.521.252.607.858 2.094.934 2.246.076.152.126.329.025.531-.101.202-.151.329-.303.506-.151.177-.318.395-.454.531-.151.151-.309.315-.133.619.177.303.786 1.298 1.689 2.103 1.16 1.035 2.138 1.356 2.441 1.508.303.152.48.126.656-.076.177-.202.757-.884.959-1.187.202-.303.404-.252.681-.151.278.101 1.766.833 2.069.985.303.151.505.227.58.353.076.127.076.733-.17 1.426z" />
                        </svg>
                      </div>

                      <div className="min-w-0">
                        <h3 className="text-sm sm:text-base font-black text-white leading-tight kurdish-bold">
                          {lang === "ku" ? "وەتسئەپ" : "WhatsApp"}
                        </h3>
                        <p className="text-[11px] sm:text-xs text-emerald-50 leading-snug mt-0.5">
                          {lang === "ku"
                            ? "پەیوەندی ڕاستەوخۆ"
                            : "Direct chat on WhatsApp"}
                        </p>
                      </div>
                    </div>

                    <div className="px-3 py-2 rounded-xl bg-white text-[#128C7E] text-xs font-black flex items-center gap-1.5 shrink-0 shadow-xs">
                      <span>{lang === "ku" ? "کردنەوە" : "Open"}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </div>
                  </a>
                </section>
              </div>
            </EdgeSwipeBack>
          </motion.div>
        ) : (
          <motion.div
            key="more-main-menu"
            transformTemplate={clearZeroTransform}
            initial={{ x: parentShiftX, opacity: 0.6 }}
            animate={{
              x: 0,
              opacity: 1,
              transition: { duration: 0.38, ease: IOS_PAGE_EASE },
            }}
            exit={{
              x: parentShiftX,
              opacity: 0,
              transition: { duration: 0.34, ease: IOS_PAGE_EASE },
            }}
            className="tab-view w-full flex flex-col pb-28 select-none"
          >
            {/* دیزاینی ناوەوەی بەشی زیاتر هاوشێوەی باکگراوندی ئەپەکە بە مەودای فراوانتر لە نێوان بەشەکان */}
            <div className="w-full rounded-3xl overflow-hidden glass-card text-slate-900 dark:text-slate-100 shadow-sm border border-white/60 dark:border-white/10">
              {/* سەرپەڕە */}
              <div className="px-6 py-5 bg-white/30 dark:bg-white/5 flex items-center justify-start border-b border-slate-200/60 dark:border-white/10">
                <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 kurdish-bold tracking-tight">
                  {lang === "ku" ? "زیاتر" : "More"}
                </h2>
              </div>

              {/* لیستی بەشەکان بە مەودای فراوانتر لە نێوانیان */}
              <div className="divide-y divide-slate-200/60 dark:divide-white/10 px-6 py-2">
                {/* ١. پڕۆفایل */}
                <button
                  type="button"
                  onClick={() => handleOpenSubView("profile")}
                  className="w-full py-6 px-2 flex items-center justify-start gap-5 text-slate-800 dark:text-slate-100 hover:bg-white/40 dark:hover:bg-white/5 active:bg-white/60 dark:active:bg-white/10 transition-colors cursor-pointer"
                >
                  <svg
                    className="w-6 h-6 text-slate-700 dark:text-slate-200 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="8" r="4" />
                    <path d="M5 20c0-3.866 3.134-7 7-7s7 3.134 7 7" />
                  </svg>
                  <span className="text-sm sm:text-base font-bold kurdish-bold">
                    {lang === "ku" ? "پڕۆفایل" : "Profile"}
                  </span>
                </button>

                {/* ٢. ڕێکخستنەکان */}
                <button
                  type="button"
                  onClick={() => handleOpenSubView("settings")}
                  className="w-full py-6 px-2 flex items-center justify-start gap-5 text-slate-800 dark:text-slate-100 hover:bg-white/40 dark:hover:bg-white/5 active:bg-white/60 dark:active:bg-white/10 transition-colors cursor-pointer"
                >
                  <svg
                    className="w-6 h-6 text-slate-700 dark:text-slate-200 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                  <span className="text-sm sm:text-base font-bold kurdish-bold">
                    {lang === "ku" ? "ڕێکخستنەکان" : "Settings"}
                  </span>
                </button>

                {/* ٣. دەربارە */}
                <button
                  type="button"
                  onClick={() => handleOpenSubView("about")}
                  className="w-full py-6 px-2 flex items-center justify-start gap-5 text-slate-800 dark:text-slate-100 hover:bg-white/40 dark:hover:bg-white/5 active:bg-white/60 dark:active:bg-white/10 transition-colors cursor-pointer"
                >
                  <svg
                    className="w-6 h-6 text-slate-700 dark:text-slate-200 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M3.85 8.62a4 4 0 0 1 4.78-4.77 4 4 0 0 1 6.74 0 4 4 0 0 1 4.78 4.78 4 4 0 0 1 0 6.74 4 4 0 0 1-4.77 4.78 4 4 0 0 1-6.75 0 4 4 0 0 1-4.78-4.77 4 4 0 0 1 0-6.76Z" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <span className="text-sm sm:text-base font-bold kurdish-bold">
                    {lang === "ku" ? "دەربارە" : "About"}
                  </span>
                </button>

                {/* ٤. چوونەدەرەوە */}
                <button
                  type="button"
                  onClick={handleLogoutClick}
                  className="w-full py-6 px-2 flex items-center justify-start gap-5 text-rose-600 dark:text-rose-400 hover:bg-rose-500/5 active:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <svg
                    className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h8" />
                    <polyline points="16 17 21 12 16 7" />
                    <line x1="21" y1="12" x2="9" y2="12" />
                  </svg>
                  <span className="text-sm sm:text-base font-bold kurdish-bold">
                    {lang === "ku" ? "چوونەدەرەوە" : "Log Out"}
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
