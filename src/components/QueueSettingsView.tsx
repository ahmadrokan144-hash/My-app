import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Language, Translations } from "../translations";
import {
  Moon,
  Sun,
  Globe,
  Bell,
  BellOff,
  Sliders,
  Send,
  Check,
  Smartphone
} from "lucide-react";
import {
  getSystemNotificationStatus,
  getNotificationsEnabledPref,
  setNotificationsEnabledPref,
  requestSystemNotificationPermission,
  sendExternalNotification,
  SystemNotificationStatus
} from "../utils/notifications";

interface QueueSettingsViewProps {
  lang: Language;
  setLang: (lang: Language) => void;
  t: Translations;
  darkMode: boolean;
  setDarkMode: (val: boolean) => void;
  navBlur: number;
  setNavBlur: (val: number) => void;
  notificationsEnabled: boolean;
  onNotificationsPrefChange: (val: boolean) => void;
  isAccountSynced?: boolean;
}

export default function QueueSettingsView({
  lang,
  setLang,
  t,
  darkMode,
  setDarkMode,
  navBlur,
  setNavBlur,
  notificationsEnabled,
  onNotificationsPrefChange,
  isAccountSynced = false
}: QueueSettingsViewProps) {
  const [notifStatus, setNotifStatus] = useState<SystemNotificationStatus>(() =>
    getSystemNotificationStatus()
  );
  const [notifEnabled, setNotifEnabled] = useState<boolean>(() => {
    const st = getSystemNotificationStatus();
    return st === "granted" && (notificationsEnabled ?? getNotificationsEnabledPref());
  });
  const [notifRequesting, setNotifRequesting] = useState(false);
  const [testSent, setTestSent] = useState(false);

  useEffect(() => {
    const syncStatus = () => {
      const st = getSystemNotificationStatus();
      setNotifStatus(st);
      if (st !== "granted") {
        setNotifEnabled(false);
      } else {
        setNotifEnabled(notificationsEnabled);
      }
    };
    syncStatus();
    window.addEventListener("focus", syncStatus);
    return () => window.removeEventListener("focus", syncStatus);
  }, [notificationsEnabled]);

  const handleToggleNotifications = async (nextChecked: boolean) => {
    if (!nextChecked) {
      setNotificationsEnabledPref(false);
      setNotifEnabled(false);
      onNotificationsPrefChange(false);
      return;
    }

    const current = getSystemNotificationStatus();
    if (current === "ios-needs-homescreen" || current === "unsupported") {
      setNotifStatus(current);
      setNotifEnabled(false);
      onNotificationsPrefChange(false);
      return;
    }

    if (current === "denied") {
      setNotifStatus("denied");
      setNotifEnabled(false);
      onNotificationsPrefChange(false);
      return;
    }

    if (current === "granted") {
      setNotificationsEnabledPref(true);
      setNotifEnabled(true);
      onNotificationsPrefChange(true);
      return;
    }

    setNotifRequesting(true);
    try {
      const result = await requestSystemNotificationPermission(lang);
      setNotifStatus(result.status);
      const granted = result.status === "granted";
      setNotifEnabled(granted);
      onNotificationsPrefChange(granted);
    } finally {
      setNotifRequesting(false);
    }
  };

  const handleSendTestNotification = async () => {
    const ok = await sendExternalNotification({
      title: lang === "ku" ? "تاقیکردنەوەی ئاگادارکردنەوەی own+" : "own+ Test Notification",
      body:
        lang === "ku"
          ? "نۆتفیکەیشنی دەرەکی بە سەرکەوتوویی لەسەر مۆبایلەکەت کار دەکات!"
          : "External system notifications are working properly on your device!",
      tag: `ownplus-test-${Date.now()}`
    });
    if (ok) {
      setTestSent(true);
      window.setTimeout(() => setTestSent(false), 2400);
    }
  };

  const handleBlurChange = (val: number) => {
    const clamped = Math.max(0, Math.min(45, val));
    setNavBlur(clamped);
    try {
      localStorage.setItem("ownplus_nav_blur", clamped.toString());
    } catch {}
  };

  const notificationSubtitle = (() => {
    if (notifStatus === "ios-needs-homescreen") {
      return lang === "ku"
        ? "لە ئایفۆن: ئەپەکە زیاد بکە بۆ شاشەی سەرەکی (Add to Home Screen)"
        : "On iPhone: Add app to Home Screen to enable OS notifications";
    }
    if (notifStatus === "denied") {
      return lang === "ku"
        ? "لە ڕێکخستنی مۆبایلەکەت ڕەتکراوەتەوە — لە Settings چالاکی بکەرەوە"
        : "Blocked in device settings — enable in system Settings";
    }
    if (notifStatus === "unsupported") {
      return lang === "ku"
        ? "ئەم وێبگەڕە پشتگیری نۆتفیکەیشنی دەرەکی ناکات"
        : "System notifications are not supported in this browser";
    }
    if (notifEnabled && notifStatus === "granted") {
      return lang === "ku"
        ? "نۆتفیکەیشنی دەرەکی چالاکە لەگەڵ سیستمی مۆبایلەکەدا"
        : "External device notifications are active";
    }
    return lang === "ku"
      ? "ئاگادارکردنەوەی دەرەکی بۆ کاتی یاری و پەخشە گرنگەکان"
      : "External alerts for live matches and updates";
  })();

  return (
    <div className="w-full flex flex-col gap-3.5 pb-28">
      {/* Header */}
      <section className="glass-card rounded-3xl p-5 shadow-sm border border-white/60 dark:border-white/10">
        <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-slate-100 kurdish-bold">
          {t.settingsTitle}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          {isAccountSynced
            ? lang === "ku"
              ? "ڕێکخستنەکان بە شێوەی خۆکار لەگەڵ هەژمارەکەت هاوتادەکرێن"
              : "Preferences are automatically synced with your account"
            : lang === "ku"
            ? "دەستکاریکردنی ڕووکار، ئاگادارکردنەوە و زمان"
            : "Configure appearance, notifications and language"}
        </p>
      </section>

      {/* Appearance, Language, Notifications & Blur Settings Card */}
      <section className="glass-card rounded-3xl p-5 shadow-sm border border-white/60 dark:border-white/10 flex flex-col gap-4">
        {/* Dark Mode Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              {darkMode ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
            </div>
            <div>
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 block">
                {darkMode ? t.darkMode : t.lightMode}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {t.appearance}
              </span>
            </div>
          </div>

          <label className="switch">
            <input
              type="checkbox"
              checked={darkMode}
              onChange={(e) => {
                setDarkMode(e.target.checked);
                localStorage.setItem("quran_dark_mode", e.target.checked.toString());
              }}
            />
            <span className="slider round"></span>
          </label>
        </div>

        <div className="h-[1px] bg-slate-200/50 dark:bg-slate-700/50" />

        {/* Language Selection */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 block">
                {t.languageSelect}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {lang === "ku" ? "کوردی" : "English"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => {
                setLang("ku");
                localStorage.setItem("quran_language", "ku");
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                lang === "ku"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              کوردی
            </button>
            <button
              type="button"
              onClick={() => {
                setLang("en");
                localStorage.setItem("quran_language", "en");
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                lang === "en"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
            >
              EN
            </button>
          </div>
        </div>

        <div className="h-[1px] bg-slate-200/50 dark:bg-slate-700/50" />

        {/* 🔔 External System Notifications (ئاگادارکردنەوەکان / Notifications) */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`p-2.5 rounded-2xl shrink-0 ${
                  notifEnabled
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    : "bg-slate-500/10 text-slate-600 dark:text-slate-400"
                }`}
              >
                {notifEnabled ? <Bell className="w-5 h-5" /> : <BellOff className="w-5 h-5" />}
              </div>
              <div className="min-w-0">
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 block">
                  {lang === "ku" ? "ئاگادارکردنەوەکان (نۆتفیکەیشن)" : "Notifications"}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block leading-relaxed">
                  {notificationSubtitle}
                </span>
              </div>
            </div>

            <label className="switch shrink-0">
              <input
                type="checkbox"
                checked={notifEnabled}
                disabled={notifRequesting || notifStatus === "unsupported"}
                onChange={(e) => handleToggleNotifications(e.target.checked)}
              />
              <span className="slider round"></span>
            </label>
          </div>

          {/* iPhone Safari Home Screen Helper Note */}
          {notifStatus === "ios-needs-homescreen" && (
            <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-start gap-2.5 text-[11px] text-blue-800 dark:text-blue-200 leading-relaxed">
              <Smartphone className="w-4 h-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
              <span>
                {lang === "ku"
                  ? "لەسەر ئایفۆن (iOS)، سەرەتا لە سەفاری کلیک لە Share بکە و «Add to Home Screen» هەڵبژێرە، دواتر ئەپەکە لە شاشەی سەرەکی بکەرەوە بۆ وەرگرتنی نۆتفیکەیشنی دەرەکی."
                  : "On iPhone (iOS), tap Share in Safari then 'Add to Home Screen', and open own+ from your Home Screen to allow system notifications."}
              </span>
            </div>
          )}

          {/* Test External Notification Button when Granted & Active */}
          <AnimatePresence>
            {notifEnabled && notifStatus === "granted" && (
              <motion.div
                key="test-notif-row"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <button
                  type="button"
                  onClick={handleSendTestNotification}
                  className="w-full py-2.5 px-4 rounded-2xl bg-amber-500/12 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/25 font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-[0.98]"
                >
                  {testSent ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                      <span>
                        {lang === "ku"
                          ? "نۆتفیکەیشن نێردرا بۆ سیستمی مۆبایلەکەت!"
                          : "Notification sent to your device!"}
                      </span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>
                        {lang === "ku"
                          ? "تاقیکردنەوەی نۆتفیکەیشنی دەرەکی"
                          : "Send Test System Notification"}
                      </span>
                    </>
                  )}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="h-[1px] bg-slate-200/50 dark:bg-slate-700/50" />

        {/* 🎛️ Bottom & Top Bar Glass Blur Control (تەڵخی شریتی خوارەوە) */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-[#1c69e3]/10 text-[#1c69e3] dark:text-blue-400">
                <Sliders className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 block">
                  {lang === "ku" ? "تەڵخی شریتی خوارەوە" : "Bottom Bar Blur"}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {navBlur === 0
                    ? lang === "ku"
                      ? "ڕوون (بێ تەڵخی)"
                      : "Clear (No blur)"
                    : navBlur <= 15
                    ? lang === "ku"
                      ? "تەڵخی کەم"
                      : "Light glass"
                    : navBlur <= 30
                    ? lang === "ku"
                      ? "تەڵخی مامناوەند"
                      : "Medium frosted"
                    : lang === "ku"
                    ? "تەڵخی زۆر"
                    : "Heavy frosted"}
                </span>
              </div>
            </div>

            <span
              className="px-2.5 py-1 rounded-xl bg-[#1c69e3]/10 text-[#1c69e3] dark:text-blue-300 text-xs font-black shrink-0"
              dir="ltr"
            >
              {navBlur}px
            </span>
          </div>

          <div className="px-1" dir="ltr">
            <input
              type="range"
              min={0}
              max={45}
              step={1}
              value={navBlur}
              onChange={(e) => handleBlurChange(Number(e.target.value))}
              onInput={(e) => handleBlurChange(Number((e.target as HTMLInputElement).value))}
              className="w-full h-2 rounded-full bg-slate-200 dark:bg-slate-700 accent-[#1c69e3] cursor-pointer"
            />
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 mt-1">
              <span>0px</span>
              <span>22px</span>
              <span>45px</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
