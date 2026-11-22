export type SystemNotificationStatus =
  | "granted"
  | "denied"
  | "default"
  | "ios-needs-homescreen"
  | "unsupported";

const NOTIF_ENABLED_KEY = "ownplus_notifications_enabled_v1";
const NOTIF_PROMPT_DISMISSED_KEY = "ownplus_notif_prompt_dismissed_v1";

export function isIosDevice(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent || "";
  const isIPhoneIPad = /iPhone|iPad|iPod/i.test(ua);
  const isIPadOs =
    window.navigator.platform === "MacIntel" &&
    typeof window.navigator.maxTouchPoints === "number" &&
    window.navigator.maxTouchPoints > 1;
  return isIPhoneIPad || isIPadOs;
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches
  );
}

export function getSystemNotificationStatus(): SystemNotificationStatus {
  if (typeof window === "undefined") return "unsupported";
  if (!("Notification" in window)) {
    if (isIosDevice() && !isStandalonePwa()) {
      return "ios-needs-homescreen";
    }
    return "unsupported";
  }
  return Notification.permission;
}

export function getNotificationsEnabledPref(): boolean {
  try {
    const saved = localStorage.getItem(NOTIF_ENABLED_KEY);
    if (saved === "false") return false;
    if (saved === "true") return true;
  } catch {}
  return getSystemNotificationStatus() === "granted";
}

export function setNotificationsEnabledPref(enabled: boolean): void {
  try {
    localStorage.setItem(NOTIF_ENABLED_KEY, enabled ? "true" : "false");
  } catch {}
}

export function isNotificationPromptDismissed(): boolean {
  try {
    return localStorage.getItem(NOTIF_PROMPT_DISMISSED_KEY) === "true";
  } catch {
    return false;
  }
}

export function markNotificationPromptDismissed(): void {
  try {
    localStorage.setItem(NOTIF_PROMPT_DISMISSED_KEY, "true");
  } catch {}
}

export async function registerAppServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return reg;
  } catch {
    return null;
  }
}

export async function sendExternalNotification(payload: {
  title: string;
  body: string;
  tag?: string;
  url?: string;
}): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return false;
  }
  if (Notification.permission !== "granted") {
    return false;
  }

  const options: NotificationOptions = {
    body: payload.body,
    icon: "/icon.png?v=12",
    badge: "/favicon.png?v=12",
    tag: payload.tag || "ownplus-alert",
    data: { url: payload.url || "/" }
  };

  try {
    if ("serviceWorker" in navigator) {
      let reg: ServiceWorkerRegistration | undefined | null =
        await navigator.serviceWorker.getRegistration("/");
      if (!reg) {
        reg = await registerAppServiceWorker();
      }
      if (reg && typeof reg.showNotification === "function") {
        await reg.showNotification(payload.title, options);
        return true;
      }
    }
  } catch {
    // Fall through to direct Notification API
  }

  try {
    new Notification(payload.title, options);
    return true;
  } catch {
    return false;
  }
}

export async function requestSystemNotificationPermission(
  lang: "ku" | "en" = "ku"
): Promise<{ status: SystemNotificationStatus; sentWelcome: boolean }> {
  const current = getSystemNotificationStatus();
  if (current === "unsupported" || current === "ios-needs-homescreen") {
    return { status: current, sentWelcome: false };
  }

  await registerAppServiceWorker();

  let permission: NotificationPermission = Notification.permission;
  if (permission === "default") {
    try {
      permission = await Notification.requestPermission();
    } catch {
      permission = Notification.permission;
    }
  }

  if (permission === "granted") {
    setNotificationsEnabledPref(true);
    markNotificationPromptDismissed();
    const sentWelcome = await sendExternalNotification({
      title: lang === "ku" ? "ئاگادارکردنەوەکانی own+ چالاککران" : "own+ Notifications Enabled",
      body:
        lang === "ku"
          ? "ئێستا هەموو ئاگادارکردنەوە گرنگەکان و کاتی پەخشەکان ڕاستەوخۆ دەگەنە مۆبایلەکەت."
          : "You will now receive live updates and important alerts directly on your device.",
      tag: "ownplus-welcome"
    });
    return { status: "granted", sentWelcome };
  }

  if (permission === "denied") {
    setNotificationsEnabledPref(false);
    markNotificationPromptDismissed();
  }

  return { status: permission, sentWelcome: false };
}
