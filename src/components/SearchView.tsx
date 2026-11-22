import React, { useState, useEffect, useRef } from "react";
import { Search, X, Clock, Flame, Trash2, Radio } from "lucide-react";
import { motion } from "motion/react";
import { KURDISH_CHANNELS, KurdishChannel, ChannelCategory } from "../data/kurdishChannels";
import { Language } from "../translations";

interface SearchViewProps {
  lang: Language;
  recentChannelIds: string[];
  onClearRecent: () => void;
  onOpenChannel: (channelId: string) => void;
  isTabActive?: boolean;
  popToRootTick?: number;
}

const POPULAR_CHANNEL_IDS = [
  "rudaw",
  "k24",
  "beintod1",
  "starzplay1",
  "ownplus",
  "amozhgary",
  "makkahquran",
  "kurdmax",
  "ava",
];

const SEARCH_CATEGORIES: { id: ChannelCategory; labelKu: string; labelEn: string }[] = [
  { id: "all", labelKu: "هەموو", labelEn: "All" },
  { id: "news", labelKu: "هەواڵ", labelEn: "News" },
  { id: "sports", labelKu: "وەرزشی", labelEn: "Sports" },
  { id: "general", labelKu: "گشتی", labelEn: "General" },
  { id: "local", labelKu: "ناوخۆیی", labelEn: "Local" },
  { id: "religious", labelKu: "ئایینی", labelEn: "Religious" },
  { id: "kids", labelKu: "منداڵان", labelEn: "Kids" },
  { id: "culture", labelKu: "کلتوری", labelEn: "Culture" },
];

function getLogoContainerClass(id: string): string {
  if (
    id.startsWith("alwansport") ||
    id === "fifaplus" ||
    id === "kurdmaxshow" ||
    id === "nrtsport" ||
    id === "starzplay1" ||
    id === "starzplay2"
  ) {
    return "bg-[#0f172a] p-0";
  }
  if (id === "newline1" || id === "newline2") return "bg-[#4b0060] p-0.5";
  if (id === "basktv") return "bg-[#09081b] p-0";
  if (id === "osnyahala" || id === "osnmoviesaction") return "bg-[#e51000] p-0";
  if (id === "thmanyah1" || id === "thmanyah2") return "bg-[#f23d13] p-0";
  if (id === "majd") return "bg-[#de2a28] p-0";
  if (id === "kurdmaxpepule") return "bg-[#bfe0f3] p-0";
  if (id === "boomerang") return "bg-[#1e1e20] p-1.5";
  if (id === "mbc3" || id === "cnarabia" || id === "cnn" || id === "acemovie") {
    return "bg-white p-0";
  }
  if (id === "makkahquran" || id === "madinahsunnah") {
    return "bg-white dark:bg-slate-800/90 p-2.5 sm:p-3";
  }
  return "bg-white dark:bg-slate-800/90 p-1.5";
}

function getLogoImgClass(id: string): string {
  if (id === "makkahquran" || id === "madinahsunnah") {
    return "rounded-none object-contain";
  }
  if (
    id === "fifaplus" ||
    id.startsWith("alwansport") ||
    id === "kurdmaxshow" ||
    id === "nrtsport" ||
    id === "starzplay1" ||
    id === "starzplay2" ||
    id === "basktv" ||
    id === "mbc3" ||
    id === "cnarabia" ||
    id === "cnn" ||
    id === "acemovie" ||
    id === "osnmoviesaction" ||
    id === "osnyahala" ||
    id === "thmanyah1" ||
    id === "thmanyah2" ||
    id === "kurdmaxpepule" ||
    id === "majd"
  ) {
    return "rounded-xl object-cover";
  }
  return "rounded-xl object-contain";
}

function handleLogoError(e: React.SyntheticEvent<HTMLImageElement>, channel: KurdishChannel) {
  const target = e.currentTarget;
  const stage = Number(target.getAttribute("data-fallback-stage") || "0");
  if (stage === 0) {
    target.setAttribute("data-fallback-stage", "1");
    if (channel.fallbackLogo && channel.fallbackLogo !== channel.logo) {
      target.src = channel.fallbackLogo;
      return;
    }
    target.src = `${channel.logo.split("?")[0]}?v=permanent`;
    return;
  }
  if (stage === 1) {
    target.setAttribute("data-fallback-stage", "2");
    target.src = "/assets/aistudio/key-logo-3d.png";
  }
}

export default function SearchView({
  lang,
  recentChannelIds,
  onClearRecent,
  onOpenChannel,
  popToRootTick = 0,
}: SearchViewProps) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ChannelCategory>("all");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const prevPopRef = useRef<number>(popToRootTick);

  useEffect(() => {
    if (popToRootTick !== prevPopRef.current) {
      prevPopRef.current = popToRootTick;
      setQuery("");
      setSelectedCategory("all");
      inputRef.current?.focus();
    }
  }, [popToRootTick]);

  const trimmedQuery = query.trim().toLowerCase();
  const isFiltering = Boolean(trimmedQuery) || selectedCategory !== "all";

  const filteredChannels = KURDISH_CHANNELS.filter((ch) => {
    if (selectedCategory !== "all") {
      if (selectedCategory === "local") {
        if (!ch.isLocal && ch.category !== "local") return false;
      } else if (ch.category !== selectedCategory) {
        return false;
      }
    }
    if (!trimmedQuery) return true;
    return (
      ch.nameKu.toLowerCase().includes(trimmedQuery) ||
      ch.nameEn.toLowerCase().includes(trimmedQuery) ||
      ch.cityKu.toLowerCase().includes(trimmedQuery) ||
      ch.cityEn.toLowerCase().includes(trimmedQuery) ||
      ch.categoryLabelKu.toLowerCase().includes(trimmedQuery) ||
      ch.categoryLabelEn.toLowerCase().includes(trimmedQuery)
    );
  });

  const recentChannels = recentChannelIds
    .map((id) => KURDISH_CHANNELS.find((c) => c.id === id))
    .filter((c): c is KurdishChannel => Boolean(c))
    .slice(0, 6);

  const popularChannels = POPULAR_CHANNEL_IDS.map((id) =>
    KURDISH_CHANNELS.find((c) => c.id === id)
  ).filter((c): c is KurdishChannel => Boolean(c));

  const renderChannelCard = (channel: KurdishChannel) => (
    <motion.button
      key={channel.id}
      type="button"
      whileTap={{ scale: 0.96, transition: { duration: 0.08 } }}
      onClick={() => onOpenChannel(channel.id)}
      className="channel-glass-card rounded-2xl sm:rounded-3xl px-2 py-3 sm:p-3.5 transition-colors cursor-pointer relative flex flex-col items-center text-center gap-2 border border-white/70 dark:border-white/10 select-none touch-manipulation"
    >
      <div
        className={`w-[74px] h-[74px] sm:w-[86px] sm:h-[86px] rounded-[20px] shadow-xs border border-slate-200/70 dark:border-slate-700/70 flex items-center justify-center overflow-hidden pointer-events-none ${getLogoContainerClass(
          channel.id
        )}`}
      >
        <img
          src={channel.logo}
          alt={channel.nameKu}
          loading="eager"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={(e) => handleLogoError(e, channel)}
          className={`w-full h-full ${getLogoImgClass(channel.id)}`}
        />
      </div>

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
    </motion.button>
  );

  return (
    <div className="tab-view flex flex-col gap-5 pb-28">
      {/* Search Bar & Quick Category Filters */}
      <section className="glass-card rounded-3xl p-3.5 sm:p-4 border border-white/70 dark:border-white/10 flex flex-col gap-3">
        <div className="relative flex items-center">
          <Search
            className={`w-4 h-4 text-slate-400 dark:text-slate-500 absolute pointer-events-none ${
              lang === "ku" ? "right-3.5" : "left-3.5"
            }`}
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              lang === "ku"
                ? "بگەڕێ بۆ ناوی کەناڵ، بەش یان وڵات..."
                : "Search channel name, category or country..."
            }
            className={`w-full py-3 rounded-2xl bg-white/80 dark:bg-slate-900/70 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 border border-slate-200/80 dark:border-white/10 focus:outline-none focus:ring-2 focus:ring-blue-500/40 font-bold text-sm transition-all ${
              lang === "ku" ? "pr-10 pl-10" : "pl-10 pr-10"
            }`}
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              aria-label="Clear search"
              className={`absolute p-1.5 rounded-full bg-slate-200/80 dark:bg-slate-700/80 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 cursor-pointer transition-colors ${
                lang === "ku" ? "left-2.5" : "right-2.5"
              }`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Filter Strip */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
          {SEARCH_CATEGORIES.map((cat) => {
            const active = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap cursor-pointer ${
                  active
                    ? "bg-blue-600 text-white border-blue-500 shadow-xs"
                    : "bg-white/65 dark:bg-slate-800/70 text-slate-700 dark:text-slate-200 border-slate-200/80 dark:border-white/10 hover:bg-white dark:hover:bg-slate-800"
                }`}
              >
                {lang === "ku" ? cat.labelKu : cat.labelEn}
              </button>
            );
          })}
        </div>
      </section>

      {isFiltering ? (
        <section className="flex flex-col gap-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm sm:text-base font-black text-slate-900 dark:text-white kurdish-bold">
              {lang === "ku"
                ? `ئەنجامەکان (${filteredChannels.length})`
                : `Results (${filteredChannels.length})`}
            </h3>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setSelectedCategory("all");
              }}
              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
            >
              {lang === "ku" ? "سڕینەوەی فلتەر" : "Reset"}
            </button>
          </div>

          {filteredChannels.length === 0 ? (
            <div className="glass-card rounded-3xl p-8 text-center border border-white/60 dark:border-white/10 flex flex-col items-center justify-center gap-2.5">
              <Radio className="w-8 h-8 text-slate-400" />
              <p className="text-sm font-bold text-slate-700 dark:text-slate-200">
                {lang === "ku"
                  ? "هیچ کەناڵێک بەم ناوە نەدۆزرایەوە"
                  : "No matching channels found"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
              {filteredChannels.map(renderChannelCard)}
            </div>
          )}
        </section>
      ) : (
        <>
          {/* Recently Watched */}
          {recentChannels.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white kurdish-bold">
                    {lang === "ku" ? "دوا سەیرکراوەکان" : "Recently Watched"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={onClearRecent}
                  className="text-xs font-bold text-rose-500 dark:text-rose-400 hover:text-rose-600 flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{lang === "ku" ? "پاککردنەوە" : "Clear"}</span>
                </button>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
                {recentChannels.map(renderChannelCard)}
              </div>
            </section>
          )}

          {/* Popular / Trending Channels */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-1">
              <Flame className="w-4 h-4 text-amber-500" />
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white kurdish-bold">
                {lang === "ku" ? "کەناڵە پڕبینەرەکان" : "Popular Channels"}
              </h3>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 gap-2.5 sm:gap-3">
              {popularChannels.map(renderChannelCard)}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
