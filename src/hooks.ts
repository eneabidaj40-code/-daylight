import { useEffect, useRef, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { useStore } from "./store";
import { occurrences } from "./schedule";
import { addDays, dayKey } from "./time";

export function useClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 10000);
    const resume = () => setNow(new Date());
    window.addEventListener("focus", resume);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", resume);
    };
  }, []);
  return now;
}
export function useTheme() {
  const { state } = useStore();
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        state.settings.theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : state.settings.theme;
      document.documentElement.style.colorScheme =
        document.documentElement.dataset.theme;
    };
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [state.settings.theme]);
}
interface InstallEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
export function usePWA() {
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null),
    [online, setOnline] = useState(navigator.onLine),
    [swError, setSWError] = useState("");
  const sw = useRegisterSW({
    onRegisterError: () =>
      setSWError(
        "Offline caching could not start. Use HTTPS or localhost, then reload while online.",
      ),
  });
  useEffect(() => {
    const capture = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
    };
    const onOnline = () => setOnline(true),
      onOffline = () => setOnline(false);
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("beforeinstallprompt", capture);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);
  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };
  return {
    canInstall: !!installEvent,
    install,
    online,
    swError,
    offlineReady: sw.offlineReady[0],
    needRefresh: sw.needRefresh[0],
    refresh: () => sw.updateServiceWorker(true),
    dismissUpdate: () => sw.needRefresh[1](false),
  };
}
export type PWA = ReturnType<typeof usePWA>;
export function useReminders(now: Date) {
  const { state } = useStore(),
    seen = useRef(new Set<string>());
  useEffect(() => {
    if (
      !state.settings.reminders ||
      !("Notification" in window) ||
      Notification.permission !== "granted"
    )
      return;
    const today = dayKey(now, state.settings.timezone),
      lead = state.settings.reminderMinutes * 60000;
    const events = occurrences(state, today, addDays(today, 1)).filter(
      (a) => !a.completed && a.source !== "routine",
    );
    for (const a of events) {
      const delta = Date.parse(a.start) - now.getTime(),
        key = `${a.id}:${a.start}`;
      if (delta < -60000 || delta > lead || seen.current.has(key)) continue;
      seen.current.add(key);
      const options = {
        body:
          delta <= 0
            ? "Starting now. A little intention goes a long way."
            : `Starting in ${Math.ceil(delta / 60000)} minutes.`,
        icon: `${import.meta.env.BASE_URL}icons/icon-192.png`,
        tag: key,
      };
      if ("serviceWorker" in navigator)
        navigator.serviceWorker
          .getRegistration()
          .then(async (reg) => {
            if (reg) await reg.showNotification(a.title, options);
            else new Notification(a.title, options);
          })
          .catch(() => {});
      else
        try {
          new Notification(a.title, options);
        } catch {
          /* Unsupported notification contexts do not interrupt planning. */
        }
    }
  }, [now, state]);
}
