import React, { useState, useEffect } from 'react';
import { Download, PlusSquare, Share, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface InstallPromptProps {
  lang: "ku" | "en";
}

export default function InstallPrompt({ lang }: InstallPromptProps) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);
    
    // If iOS and not installed, we can show a hint
    if (isIosDevice && !(window.navigator as any).standalone) {
       // Check if we should show the hint (maybe don't spam if they dismissed it before)
       const dismissed = localStorage.getItem('iosInstallPromptDismissed');
       if (!dismissed) {
         setShowIOSHint(true);
       }
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
      setShowIOSHint(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setDeferredPrompt(null);
    }
  };

  const dismissIOSHint = () => {
    setShowIOSHint(false);
    localStorage.setItem('iosInstallPromptDismissed', 'true');
  };

  const dismissAndroidPrompt = () => {
    setDeferredPrompt(null);
  };

  if (isInstalled) return null;

  if (deferredPrompt) {
    return (
      <AnimatePresence>
        <motion.div 
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          className="w-full bg-indigo-50 dark:bg-indigo-900/30 backdrop-blur-md border border-indigo-100 dark:border-indigo-500/30 rounded-2xl p-4 my-4 flex flex-col sm:flex-row items-center justify-between shadow-lg relative"
          dir={lang === "ku" ? "rtl" : "ltr"}
        >
          <button 
            onClick={dismissAndroidPrompt}
            className="absolute top-2 right-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white p-1"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="bg-indigo-100 dark:bg-indigo-500/20 p-2.5 rounded-xl text-indigo-600 dark:text-indigo-400">
              <PlusSquare size={24} />
            </div>
            <div>
              <h3 className="text-slate-800 dark:text-white font-bold text-sm md:text-base">
                {lang === "ku" ? "زیادکردن بۆ هۆم سکرین" : "Add to Home Screen"}
              </h3>
              <p className="text-slate-600 dark:text-slate-300 text-xs md:text-sm mt-0.5">
                {lang === "ku" 
                  ? "ئەپەکە بخە سەر شاشەی سەرەکی بۆ خێراتر کردنەوەی" 
                  : "Install app for faster access and offline use"}
              </p>
            </div>
          </div>
          <button 
            onClick={handleInstallClick}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors active:scale-95 shadow-md flex-shrink-0 flex items-center gap-2 mt-3 sm:mt-0 w-full sm:w-auto justify-center"
          >
            <span>{lang === "ku" ? "دابەزاندن" : "Install"}</span>
            <Download size={16} />
          </button>
        </motion.div>
      </AnimatePresence>
    );
  }

  if (isIOS && showIOSHint) {
    return (
      <AnimatePresence>
        <motion.div 
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          className="w-full bg-indigo-50 dark:bg-indigo-900/30 backdrop-blur-md border border-indigo-100 dark:border-indigo-500/30 rounded-2xl p-4 my-4 relative shadow-lg"
          dir={lang === "ku" ? "rtl" : "ltr"}
        >
          <button 
            onClick={dismissIOSHint}
            className="absolute top-2 right-2 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white p-1"
          >
            <X size={16} />
          </button>
          
          <div className="flex items-start gap-3 mt-1">
            <div className="bg-indigo-100 dark:bg-indigo-500/20 p-2.5 rounded-xl text-indigo-600 dark:text-indigo-400 shrink-0">
              <PlusSquare size={24} />
            </div>
            <div>
              <h3 className="text-slate-800 dark:text-white font-bold text-sm md:text-base">
                {lang === "ku" ? "زیادکردن بۆ هۆم سکرین" : "Add to Home Screen"}
              </h3>
              <p className="text-slate-600 dark:text-slate-300 text-xs md:text-sm mt-1 leading-relaxed">
                {lang === "ku" 
                  ? (
                    <>بۆ زیادکردنی ئەپەکە کرتە لە دوگمەی <Share size={14} className="inline mx-1" /> بکە، پاشان هەڵبژاردەی <b>"Add to Home Screen"</b> هەڵبژێرە.</>
                  )
                  : (
                    <>Tap <Share size={14} className="inline mx-1" /> and then <b>"Add to Home Screen"</b> to install.</>
                  )}
              </p>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    );
  }

  return null;
}
